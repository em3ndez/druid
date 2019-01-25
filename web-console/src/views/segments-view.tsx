/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import axios from 'axios';
import * as React from 'react';
import * as classNames from 'classnames';
import ReactTable from "react-table";
import { Filter } from "react-table";
import { H5, Button } from "@blueprintjs/core";
import { addFilter, makeBooleanFilter, QueryManager, formatBytes, formatNumber, parseList, getErrorMessage } from "../utils";
import "./segments-view.scss";

export interface SegmentsViewProps extends React.Props<any> {
  goToSql: (initSql: string) => void;
  datasource: string | null;
  onlyUnavailable: boolean | null;
}

export interface SegmentsViewState {
  segmentsLoading: boolean;
  segments: any[] | null;
  segmentsError: string | null;
  segmentFilter: Filter[];
}

interface QueryAndSkip {
  query: string;
  skip: number;
}

export class SegmentsView extends React.Component<SegmentsViewProps, SegmentsViewState> {
  private segmentsQueryManager: QueryManager<QueryAndSkip, any[]>;

  constructor(props: SegmentsViewProps, context: any) {
    super(props, context);

    const segmentFilter: Filter[] = [];
    if (props.datasource) segmentFilter.push({ id: 'datasource', value: props.datasource });
    if (props.onlyUnavailable) segmentFilter.push({ id: 'is_available', value: 'false' });

    this.state = {
      segmentsLoading: true,
      segments: null,
      segmentsError: null,
      segmentFilter
    };

    this.segmentsQueryManager = new QueryManager({
      processQuery: async (query: QueryAndSkip) => {
        let sqlResp;
        try {
          sqlResp = await axios.post("/druid/v2/sql", { query: query.query });
        } catch (e) {
          throw new Error(getErrorMessage(e));
        }
        const results: any[] = sqlResp.data.slice(query.skip);
        results.forEach(result => {
          try {
            result.payload = JSON.parse(result.payload);
          } catch {
            result.payload = {};
          }
        });
        return results;
      },
      onStateChange: ({ result, loading, error }) => {
        this.setState({
          segments: result,
          segmentsLoading: loading,
          segmentsError: error
        });
      }
    })
  }

  componentWillUnmount(): void {
    this.segmentsQueryManager.terminate();
  }

  private fetchData = (state: any, instance: any) => {
    const { page, pageSize, filtered, sorted } = state;
    const totalQuerySize = (page + 1) * pageSize;

    let queryParts = [
      `SELECT "segment_id", "datasource", "start", "end", "size", "version", "partition_num", "num_replicas", "num_rows", "is_published", "is_available", "is_realtime", "payload"`,
      `FROM sys.segments`
    ];

    const whereParts = filtered.map((f: Filter) => {
      if (f.id.startsWith('is_')) {
        if (f.value === 'all') return null;
        return `${JSON.stringify(f.id)} = ${f.value === 'true' ? 1 : 0}`;
      } else {
        return `${JSON.stringify(f.id)} LIKE '%${f.value}%'`;
      }
    }).filter(Boolean);

    if (whereParts.length) {
      queryParts.push('WHERE ' + whereParts.join(' AND '))
    }

    if (sorted.length) {
      queryParts.push('ORDER BY ' + sorted.map((sort: any) => `${JSON.stringify(sort.id)} ${sort.desc ? 'DESC' : 'ASC'}`).join(', '));
    }

    queryParts.push(`LIMIT ${totalQuerySize}`);

    const query = queryParts.join('\n');

    this.segmentsQueryManager.runQuery({
      query,
      skip: totalQuerySize - pageSize
    });
  }

  renderSegmentsTable() {
    const { segments, segmentsLoading, segmentsError, segmentFilter } = this.state;

    return <ReactTable
      data={segments || []}
      pages={10}
      loading={segmentsLoading}
      noDataText={!segmentsLoading && segments && !segments.length ? 'No segments' : (segmentsError || '')}
      manual
      filterable
      filtered={segmentFilter}
      defaultSorted={[{id: "start", desc: true}]}
      onFilteredChange={(filtered, column) => {
        this.setState({ segmentFilter: filtered });
      }}
      onFetchData={this.fetchData}
      columns={[
        {
          Header: "Segment ID",
          accessor: "segment_id",
          width: 300
        },
        {
          Header: "Datasource",
          accessor: "datasource",
          Cell: row => {
            const value = row.value;
            return <a onClick={() => { this.setState({ segmentFilter: addFilter(segmentFilter, 'datasource', value) }) }}>{value}</a>
          }
        },
        {
          Header: "Start",
          accessor: "start",
          width: 120,
          defaultSortDesc: true,
          Cell: row => {
            const value = row.value;
            return <a onClick={() => { this.setState({ segmentFilter: addFilter(segmentFilter, 'start', value) }) }}>{value}</a>
          }
        },
        {
          Header: "End",
          accessor: "end",
          defaultSortDesc: true,
          width: 120,
          Cell: row => {
            const value = row.value;
            return <a onClick={() => { this.setState({ segmentFilter: addFilter(segmentFilter, 'end', value) }) }}>{value}</a>
          }
        },
        {
          Header: "Version",
          accessor: "version",
          defaultSortDesc: true,
          width: 120,
        },
        {
          Header: "Partition",
          accessor: "partition_num",
          width: 60,
          filterable: false
        },
        {
          Header: "Size",
          accessor: "size",
          filterable: false,
          defaultSortDesc: true,
          Cell: row => formatBytes(row.value)
        },
        {
          Header: "Num rows",
          accessor: "num_rows",
          filterable: false,
          defaultSortDesc: true,
          Cell: row => formatNumber(row.value)
        },
        {
          Header: "Replicas",
          accessor: "num_replicas",
          width: 60,
          filterable: false,
          defaultSortDesc: true
        },
        {
          Header: "Is published",
          id: "is_published",
          accessor: (row) => String(Boolean(row.is_published)),
          Filter: makeBooleanFilter()
        },
        {
          Header: "Is realtime",
          id: "is_realtime",
          accessor: (row) => String(Boolean(row.is_realtime)),
          Filter: makeBooleanFilter()
        },
        {
          Header: "Is available",
          id: "is_available",
          accessor: (row) => String(Boolean(row.is_available)),
          Filter: makeBooleanFilter()
        },
        {
          Header: "Dimensions",
          id: "dimensions",
          filterable: false,
          sortable: false,
          accessor: (row) => parseList(row.payload.dimensions).length
        },
        {
          Header: "Metrics",
          id: "metrics",
          filterable: false,
          sortable: false,
          accessor: (row) => parseList(row.payload.metrics).length
        }
      ]}
      defaultPageSize={50}
      className="-striped -highlight"
      SubComponent={rowInfo => {
        const { original } = rowInfo;
        const { payload } = rowInfo.original;
        return <div style={{ padding: "20px" }}>
          <H5>Segment ID</H5>
          <p>{original.segment_id}</p>
          <H5>Dimensions</H5>
          <p>{parseList(payload.dimensions).join(', ')}</p>
          <H5>Metrics</H5>
          <p>{parseList(payload.metrics).join(', ')}</p>
        </div>;
      }}
    />;
  }

  render() {
    const { goToSql } = this.props;

    return <div className="segments-view app-view">
      <div className="control-bar">
        <div className="control-label">Segments</div>
        <Button
          icon="refresh"
          text="Refresh"
          onClick={() => this.segmentsQueryManager.rerunLastQuery()}
        />
        <Button
          icon="console"
          text="Go to SQL"
          onClick={() => goToSql(this.segmentsQueryManager.getLastQuery().query)}
        />
      </div>
      {this.renderSegmentsTable()}
    </div>
  }
}