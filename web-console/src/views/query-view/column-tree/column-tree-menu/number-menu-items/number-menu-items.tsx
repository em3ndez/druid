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
  SqlBase,
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
  onQueryChange: (query: SqlQuery, run?: boolean) => void;
}

export const NumberMenuItems = React.memo(function NumberMenuItems(props: NumberMenuItemsProps) {
  function renderFilterMenu(): JSX.Element {
    const { columnName, parsedQuery, onQueryChange } = props;
    const ref = SqlRef.column(columnName);

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
        {filterMenuItem(ref.greaterThan(NINE_THOUSAND))}
        {filterMenuItem(ref.lessThanOrEqual(NINE_THOUSAND))}
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
    const ref = SqlRef.column(columnName);

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
          SqlFunction.simple('TRUNC', [ref, SqlLiteral.factory(-1)]).as(`${columnName}_truncated`),
        )}
      </MenuItem>
    );
  }

  function renderAggregateMenu(): JSX.Element | undefined {
    const { columnName, parsedQuery, onQueryChange } = props;
    if (!parsedQuery.hasGroupBy()) return;
    const ref = SqlRef.column(columnName);

    function aggregateMenuItem(ex: SqlExpression, alias: string) {
      return (
        <MenuItem
          text={ex.prettyTrim(50).toString()}
          onClick={() => {
            onQueryChange(parsedQuery.addColumn(ex.as(alias)), true);
          }}
        />
      );
    }

    return (
      <MenuItem icon={IconNames.FUNCTION} text={`Aggregate`}>
        {aggregateMenuItem(SqlFunction.simple('SUM', [ref]), `sum_${columnName}`)}
        {aggregateMenuItem(SqlFunction.simple('MIN', [ref]), `min_${columnName}`)}
        {aggregateMenuItem(SqlFunction.simple('MAX', [ref]), `max_${columnName}`)}
        {aggregateMenuItem(SqlFunction.simple('AVG', [ref]), `avg_${columnName}`)}
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
                  SqlRef.column(table, schema).upgrade(),
                  SqlRef.column(columnName, table, 'lookup').equal(
                    SqlRef.column(
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
                  SqlRef.column(table, schema).upgrade(),
                  SqlRef.column(columnName, table, 'lookup').equal(
                    SqlRef.column(
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
