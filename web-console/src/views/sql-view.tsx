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
import { SqlControl } from '../components/sql-control';
import { QueryManager, getErrorMessage } from '../utils';
import "./sql-view.scss";

export interface HeaderRows {
  header: string[];
  rows: any[][];
}

export interface SqlViewProps extends React.Props<any> {
  initSql: string | null;
}

export interface SqlViewState {
  loading: boolean;
  result: HeaderRows | null;
  error: string | null;
}

export class SqlView extends React.Component<SqlViewProps, SqlViewState> {
  static processRune(queryType: string, rune: any[]): HeaderRows {
    //console.log(rune);
    if (!rune.length) {
      return {
        header: [],
        rows: []
      };
    }

    switch (queryType) {
      case 'timeseries':
        const header = Object.keys(rune[0].result);
        return {
          header: ['timestamp'].concat(header),
          rows: rune.map((r: Record<string, any>) => {
            const { timestamp, result } = r;
            return [timestamp].concat(header.map(h => result[h]));
          })
        };

      default:
        throw new Error(`unsupported query type '${queryType}'`);
    }
  }

  private sqlQueryManager: QueryManager<string, HeaderRows>;

  constructor(props: SqlViewProps, context: any) {
    super(props, context);
    this.state = {
      loading: false,
      result: null,
      error: null
    };
  }

  componentDidMount(): void {
    this.sqlQueryManager = new QueryManager({
      processQuery: async (query: string) => {
        const trimmedQuery = query.trim();
        if (trimmedQuery.startsWith('{') && trimmedQuery.endsWith('}')) {
          // Secret way to issue a standard query
          const runeQuery = JSON.parse(query);
          const queryType = runeQuery.queryType;
          if (typeof queryType !== 'string') throw new Error('must have query type');
          const runeResp = await axios.post("/druid/v2", runeQuery);
          return SqlView.processRune(queryType, runeResp.data);

        } else {
          let respSql: any;
          try {
            respSql = await axios.post("/druid/v2/sql", {
              query,
              resultFormat: "array",
              header: true
            });
          } catch (e) {
            throw new Error(getErrorMessage(e));
          }

          const result = respSql.data;
          return {
            header: (result && result.length) ? result[0] : [],
            rows: (result && result.length) ? result.slice(1) : []
          };
        }
      },
      onStateChange: ({ result, loading, error }) => {
        this.setState({
          result,
          loading,
          error
        });
      }
    })
  }

  componentWillUnmount(): void {
    this.sqlQueryManager.terminate();
  }

  renderResultTable() {
    const { result, loading, error } = this.state;

    return <ReactTable
      data={result ? result.rows : []}
      loading={loading}
      noDataText={!loading && result && !result.rows.length ? 'No results' : (error || '')}
      sortable={false}
      columns={(result ? result.header : []).map((h, i) => ({ Header: h, accessor: String(i) }))}
      defaultPageSize={10}
      className="-striped -highlight"
    />;
  }

  render() {
    const { initSql } = this.props;

    return <div className="sql-view app-view">
      <SqlControl initSql={initSql} onRun={q => this.sqlQueryManager.runQuery(q)} />
      {this.renderResultTable()}
    </div>
  }
}
