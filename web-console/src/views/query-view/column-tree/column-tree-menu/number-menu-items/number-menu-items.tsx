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

import { MenuItem } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import {
  SqlAlias,
  SqlBase,
  SqlComparison,
  SqlExpression,
  SqlFunction,
  SqlJoinPart,
  SqlLiteral,
  SqlQuery,
  SqlRef,
} from 'druid-query-toolkit';
import React from 'react';

import { getCurrentColumns } from '../../column-tree';

const NINE_THOUSAND = SqlLiteral.factory(9000);

export interface NumberMenuItemsProps {
  table: string;
  schema: string;
  columnName: string;
  parsedQuery: SqlQuery;
  onQueryChange: (queryString: SqlQuery, run?: boolean) => void;
}

export const NumberMenuItems = React.memo(function NumberMenuItems(props: NumberMenuItemsProps) {
  function renderFilterMenu(): JSX.Element {
    const { columnName, parsedQuery, onQueryChange } = props;
    const ref = SqlRef.factory(columnName);

    function filterMenuItem(clause: SqlExpression) {
      return (
        <MenuItem
          text={clause.prettyTrim(50).toString()}
          onClick={() => {
            onQueryChange(parsedQuery.addToWhere(clause));
          }}
        />
      );
    }

    return (
      <MenuItem icon={IconNames.FILTER} text={`Filter`}>
        {filterMenuItem(SqlComparison.greaterThan(ref, NINE_THOUSAND))}
        {filterMenuItem(SqlComparison.lessThanOrEqual(ref, NINE_THOUSAND))}
      </MenuItem>
    );
  }

  function renderRemoveFilter(): JSX.Element | undefined {
    const { columnName, parsedQuery, onQueryChange } = props;
    if (!parsedQuery.getWhereExpression().containsColumn(columnName)) return;

    return (
      <MenuItem
        icon={IconNames.FILTER_REMOVE}
        text={`Remove filter`}
        onClick={() => {
          onQueryChange(parsedQuery.removeColumnFromWhere(columnName), true);
        }}
      />
    );
  }

  function renderRemoveGroupBy(): JSX.Element | undefined {
    const { columnName, parsedQuery, onQueryChange } = props;
    if (!parsedQuery.hasGroupByOnColumn(columnName)) return;

    return (
      <MenuItem
        icon={IconNames.UNGROUP_OBJECTS}
        text={'Remove group by'}
        onClick={() => {
          onQueryChange(parsedQuery.removeFromGroupBy(columnName), true);
        }}
      />
    );
  }

  function renderGroupByMenu(): JSX.Element | undefined {
    const { columnName, parsedQuery, onQueryChange } = props;
    if (!parsedQuery.hasGroupBy()) return;
    const ref = SqlRef.factory(columnName);

    function groupByMenuItem(alias: SqlBase) {
      return (
        <MenuItem
          text={alias.prettyTrim(50).toString()}
          onClick={() => {
            onQueryChange(parsedQuery.addToGroupBy(alias), true);
          }}
        />
      );
    }

    return (
      <MenuItem icon={IconNames.GROUP_OBJECTS} text={`Group by`}>
        {groupByMenuItem(ref)}
        {groupByMenuItem(
          SqlFunction.factory('TRUNC', [ref, SqlLiteral.factory(-1)]).as(`${columnName}_truncated`),
        )}
      </MenuItem>
    );
  }

  function renderAggregateMenu(): JSX.Element | undefined {
    const { columnName, parsedQuery, onQueryChange } = props;
    if (!parsedQuery.hasGroupBy()) return;
    const ref = SqlRef.factory(columnName);

    function aggregateMenuItem(alias: SqlAlias) {
      return (
        <MenuItem
          text={alias.prettyTrim(50).toString()}
          onClick={() => {
            onQueryChange(parsedQuery.addColumn(alias), true);
          }}
        />
      );
    }

    return (
      <MenuItem icon={IconNames.FUNCTION} text={`Aggregate`}>
        {aggregateMenuItem(SqlFunction.factory('SUM', [ref]).as(`sum_${columnName}`))}
        {aggregateMenuItem(SqlFunction.factory('MIN', [ref]).as(`min_${columnName}`))}
        {aggregateMenuItem(SqlFunction.factory('MAX', [ref]).as(`max_${columnName}`))}
        {aggregateMenuItem(SqlFunction.factory('AVG', [ref]).as(`avg_${columnName}`))}
      </MenuItem>
    );
  }

  function renderJoinMenu(): JSX.Element | undefined {
    const { schema, table, columnName, parsedQuery, onQueryChange } = props;
    if (schema !== 'lookup' || !parsedQuery) return;

    const { originalTableColumn, lookupColumn } = getCurrentColumns(parsedQuery, table);

    return (
      <MenuItem icon={IconNames.JOIN_TABLE} text={parsedQuery.joinParts ? `Replace join` : `Join`}>
        <MenuItem
          icon={IconNames.LEFT_JOIN}
          text={`Left join`}
          onClick={() => {
            onQueryChange(
              parsedQuery.addJoin(
                SqlJoinPart.factory(
                  'LEFT',
                  SqlRef.factory(table, schema).upgrade(),
                  SqlComparison.equal(
                    SqlRef.factory(columnName, table, 'lookup'),
                    SqlRef.factory(
                      lookupColumn === columnName ? originalTableColumn : 'XXX',
                      parsedQuery.getFirstTableName(),
                    ),
                  ),
                ),
              ),
              false,
            );
          }}
        />
        <MenuItem
          icon={IconNames.INNER_JOIN}
          text={`Inner join`}
          onClick={() => {
            onQueryChange(
              parsedQuery.addJoin(
                SqlJoinPart.factory(
                  'INNER',
                  SqlRef.factory(table, schema).upgrade(),
                  SqlComparison.equal(
                    SqlRef.factory(columnName, table, 'lookup'),
                    SqlRef.factory(
                      lookupColumn === columnName ? originalTableColumn : 'XXX',
                      parsedQuery.getFirstTableName(),
                    ),
                  ),
                ),
              ),
              false,
            );
          }}
        />
      </MenuItem>
    );
  }

  function renderRemoveJoin(): JSX.Element | undefined {
    const { parsedQuery, onQueryChange } = props;
    if (!parsedQuery.joinParts) return;

    return (
      <MenuItem
        icon={IconNames.EXCHANGE}
        text={`Remove join`}
        onClick={() => onQueryChange(parsedQuery.removeAllJoins())}
      />
    );
  }

  return (
    <>
      {renderFilterMenu()}
      {renderRemoveFilter()}
      {renderGroupByMenu()}
      {renderRemoveGroupBy()}
      {renderAggregateMenu()}
      {renderJoinMenu()}
      {renderRemoveJoin()}
    </>
  );
});
