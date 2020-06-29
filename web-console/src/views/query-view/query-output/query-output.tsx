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

import { Menu, MenuItem, Popover } from '@blueprintjs/core';
import { IconName, IconNames } from '@blueprintjs/icons';
import {
  HeaderRows,
  SqlExpression,
  SqlLiteral,
  SqlQuery,
  SqlRef,
  trimString,
} from 'druid-query-toolkit';
import React, { useState } from 'react';
import ReactTable from 'react-table';

import { TableCell } from '../../../components';
import { ShowValueDialog } from '../../../dialogs/show-value-dialog/show-value-dialog';
import { copyAndAlert } from '../../../utils';
import { BasicAction, basicActionsToMenu } from '../../../utils/basic-action';

import './query-output.scss';

export interface QueryOutputProps {
  loading: boolean;
  queryResult?: HeaderRows;
  parsedQuery?: SqlQuery;
  onQueryChange: (query: SqlQuery, run?: boolean) => void;
  error?: string;
  runeMode: boolean;
}

export const QueryOutput = React.memo(function QueryOutput(props: QueryOutputProps) {
  const { queryResult, parsedQuery, loading, error } = props;
  const [showValue, setShowValue] = useState();

  function getHeaderMenu(header: string) {
    const { parsedQuery, onQueryChange, runeMode } = props;
    const ref = SqlRef.factory(header);
    const trimmedRef = ref.prettyTrim(50);
    const descOrderBy = ref.toOrderByPart('DESC');
    const ascOrderBy = ref.toOrderByPart('ASC');

    if (parsedQuery) {
      const orderBy = parsedQuery.getOrderByForOutputColumn(header);

      const basicActions: BasicAction[] = [];
      if (orderBy) {
        const reverseOrderBy = orderBy.reverseDirection();
        const reverseOrderByDirection = reverseOrderBy.getEffectiveDirection();
        basicActions.push({
          icon: reverseOrderByDirection === 'ASC' ? IconNames.SORT_ASC : IconNames.SORT_DESC,
          title: `Order ${reverseOrderByDirection === 'ASC' ? 'ascending' : 'descending'}`,
          onAction: () => {
            onQueryChange(parsedQuery.changeOrderByParts([reverseOrderBy]), true);
          },
        });
      } else {
        basicActions.push(
          {
            icon: IconNames.SORT_DESC,
            title: `Order descending`,
            onAction: () => {
              onQueryChange(parsedQuery.changeOrderByParts([descOrderBy]), true);
            },
          },
          {
            icon: IconNames.SORT_ASC,
            title: `Order ascending`,
            onAction: () => {
              onQueryChange(parsedQuery.changeOrderByParts([ascOrderBy]), true);
            },
          },
        );
      }

      basicActions.push({
        icon: IconNames.CROSS,
        title: `Remove ${trimmedRef}`,
        onAction: () => {
          onQueryChange(parsedQuery.removeOutputColumn(header), true);
        },
      });

      return basicActionsToMenu(basicActions);
    } else {
      const descOrderByTrim = descOrderBy.prettyTrim(50);
      const ascOrderByTrim = descOrderBy.prettyTrim(50);
      return (
        <Menu>
          <MenuItem
            icon={IconNames.CLIPBOARD}
            text={`Copy: ${trimmedRef}`}
            onClick={() => {
              copyAndAlert(String(ref), `${trimmedRef}' copied to clipboard`);
            }}
          />
          {!runeMode && (
            <>
              <MenuItem
                icon={IconNames.CLIPBOARD}
                text={`Copy: ${descOrderByTrim}`}
                onClick={() =>
                  copyAndAlert(descOrderBy.toString(), `'${descOrderByTrim}' copied to clipboard`)
                }
              />
              <MenuItem
                icon={IconNames.CLIPBOARD}
                text={`Copy: ${ascOrderByTrim}`}
                onClick={() =>
                  copyAndAlert(ascOrderBy.toString(), `'${ascOrderByTrim}' copied to clipboard`)
                }
              />
            </>
          )}
        </Menu>
      );
    }
  }

  function filterOnMenuItem(icon: IconName, clause: SqlExpression, aggregate: boolean) {
    const { parsedQuery, onQueryChange } = props;
    if (!parsedQuery) return;

    return (
      <MenuItem
        icon={icon}
        text={`${aggregate ? 'Having' : 'Filter on'}: ${clause.prettyTrim(50)}`}
        onClick={() => {
          onQueryChange(
            aggregate ? parsedQuery.addToHaving(clause) : parsedQuery.addToWhere(clause),
            true,
          );
        }}
      />
    );
  }

  function clipboardMenuItem(clause: SqlExpression) {
    const trimmedLabel = clause.prettyTrim(50).toString();
    return (
      <MenuItem
        icon={IconNames.CLIPBOARD}
        text={`Copy: ${trimmedLabel}`}
        onClick={() => copyAndAlert(clause.toString(), `${trimmedLabel} copied to clipboard`)}
      />
    );
  }

  function getCellMenu(header: string, value: any) {
    const { parsedQuery, runeMode } = props;

    const showFullValueMenuItem =
      typeof value === 'string' ? (
        <MenuItem
          icon={IconNames.EYE_OPEN}
          text={`Show full value`}
          onClick={() => {
            setShowValue(value);
          }}
        />
      ) : (
        undefined
      );

    const ref = SqlRef.factory(header);
    const val = SqlLiteral.factory(value);

    if (parsedQuery) {
      const aggregate = parsedQuery.isAggregateOutputColumn(header);
      return (
        <Menu>
          {filterOnMenuItem(IconNames.FILTER_KEEP, ref.equal(val), aggregate)}
          {filterOnMenuItem(IconNames.FILTER_REMOVE, ref.unequal(val), aggregate)}
          {!isNaN(Number(value)) && (
            <>
              {filterOnMenuItem(IconNames.FILTER_KEEP, ref.greaterThanOrEqual(val), aggregate)}
              {filterOnMenuItem(IconNames.FILTER_KEEP, ref.lessThanOrEqual(val), aggregate)}
            </>
          )}
          {showFullValueMenuItem}
        </Menu>
      );
    } else {
      const trimmedValue = trimString(String(value), 50);
      return (
        <Menu>
          <MenuItem
            icon={IconNames.CLIPBOARD}
            text={`Copy: ${trimmedValue}`}
            onClick={() => copyAndAlert(value, `${trimmedValue} copied to clipboard`)}
          />
          {!runeMode && (
            <>
              {clipboardMenuItem(ref.equal(val))}
              {clipboardMenuItem(ref.unequal(val))}
            </>
          )}
          {showFullValueMenuItem}
        </Menu>
      );
    }
  }

  function getHeaderClassName(header: string) {
    const { parsedQuery } = props;
    if (!parsedQuery) return;

    const className = [];
    const orderBy = parsedQuery.getOrderByForOutputColumn(header);
    if (orderBy) {
      className.push(orderBy.getEffectiveDirection() === 'DESC' ? '-sort-desc' : '-sort-asc');
    }

    if (parsedQuery.isAggregateOutputColumn(header)) {
      className.push('aggregate-header');
    }

    return className.join(' ');
  }

  return (
    <div className="query-output">
      <ReactTable
        data={queryResult ? queryResult.rows : []}
        loading={loading}
        noDataText={
          !loading && queryResult && !queryResult.rows.length
            ? 'Query returned no data'
            : error || ''
        }
        sortable={false}
        columns={(queryResult ? queryResult.header : []).map((h: any, i) => {
          return {
            Header: () => {
              return (
                <Popover className={'clickable-cell'} content={getHeaderMenu(h)}>
                  <div>{h}</div>
                </Popover>
              );
            },
            headerClassName: getHeaderClassName(h),
            accessor: String(i),
            Cell: row => {
              const value = row.value;
              return (
                <div>
                  <Popover content={getCellMenu(h, value)}>
                    <TableCell value={value} unlimited />
                  </Popover>
                </div>
              );
            },
            className:
              parsedQuery && parsedQuery.isAggregateOutputColumn(h)
                ? 'aggregate-column'
                : undefined,
          };
        })}
      />
      {showValue && <ShowValueDialog onClose={() => setShowValue(undefined)} str={showValue} />}
    </div>
  );
});
