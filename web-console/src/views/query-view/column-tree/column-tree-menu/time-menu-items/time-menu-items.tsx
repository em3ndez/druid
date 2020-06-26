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

import { MenuDivider, MenuItem } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import {
  parseSqlExpression,
  SqlAlias,
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

const LATEST_HOUR: SqlExpression = parseSqlExpression(`? >= CURRENT_TIMESTAMP - INTERVAL '1' HOUR`);
const LATEST_DAY: SqlExpression = parseSqlExpression(`? >= CURRENT_TIMESTAMP - INTERVAL '1' DAY`);
const LATEST_WEEK: SqlExpression = parseSqlExpression(`? >= CURRENT_TIMESTAMP - INTERVAL '1' WEEK`);
const LATEST_MONTH: SqlExpression = parseSqlExpression(
  `? >= CURRENT_TIMESTAMP - INTERVAL '1' MONTH`,
);
const LATEST_YEAR: SqlExpression = parseSqlExpression(`? >= CURRENT_TIMESTAMP - INTERVAL '1' YEAR`);

const BETWEEN: SqlExpression = parseSqlExpression(`(? <= ? AND ? < ?)`);

// ------------------------------------

function fillWithColumn(b: SqlExpression, columnName: string): SqlExpression {
  return b.fillPlaceholders([SqlRef.factory(columnName)]) as SqlExpression;
}

function fillWithColumnStartEnd(columnName: string, start: Date, end: Date): SqlExpression {
  const ref = SqlRef.factory(columnName);
  return BETWEEN.fillPlaceholders([
    SqlLiteral.factory(start),
    ref,
    ref,
    SqlLiteral.factory(end),
  ]) as SqlExpression;
}

function timeFloorAlias(columnName: string, duration: string, alias: string) {
  return SqlAlias.factory(
    SqlFunction.factory('TIME_FLOOR', [SqlRef.factory(columnName), SqlLiteral.factory(duration)]),
    alias,
  );
}

// ------------------------------------

function floorHour(dt: Date): Date {
  dt = new Date(dt.valueOf());
  dt.setUTCMinutes(0, 0, 0);
  return dt;
}

function nextHour(dt: Date): Date {
  dt = new Date(dt.valueOf());
  dt.setUTCHours(dt.getUTCHours() + 1);
  return dt;
}

function floorDay(dt: Date): Date {
  dt = new Date(dt.valueOf());
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

function nextDay(dt: Date): Date {
  dt = new Date(dt.valueOf());
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt;
}

function floorMonth(dt: Date): Date {
  dt = new Date(dt.valueOf());
  dt.setUTCHours(0, 0, 0, 0);
  dt.setUTCDate(1);
  return dt;
}

function nextMonth(dt: Date): Date {
  dt = new Date(dt.valueOf());
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  return dt;
}

function floorYear(dt: Date): Date {
  dt = new Date(dt.valueOf());
  dt.setUTCHours(0, 0, 0, 0);
  dt.setUTCMonth(0, 1);
  return dt;
}

function nextYear(dt: Date): Date {
  dt = new Date(dt.valueOf());
  dt.setUTCFullYear(dt.getUTCFullYear() + 1);
  return dt;
}

export interface TimeMenuItemsProps {
  table: string;
  schema: string;
  columnName: string;
  parsedQuery: SqlQuery;
  onQueryChange: (queryString: SqlQuery, run?: boolean) => void;
}

export const TimeMenuItems = React.memo(function TimeMenuItems(props: TimeMenuItemsProps) {
  function renderFilterMenu(): JSX.Element | undefined {
    const { columnName, parsedQuery, onQueryChange } = props;
    const now = new Date();

    function filterMenuItem(label: string, clause: SqlExpression) {
      return (
        <MenuItem
          text={label}
          onClick={() => {
            onQueryChange(parsedQuery.removeColumnFromWhere(columnName).addToWhere(clause), true);
          }}
        />
      );
    }

    const hourStart = floorHour(now);
    const dayStart = floorDay(now);
    const monthStart = floorMonth(now);
    const yearStart = floorYear(now);
    return (
      <MenuItem icon={IconNames.FILTER} text={`Filter`}>
        {filterMenuItem(`Latest hour`, fillWithColumn(LATEST_HOUR, columnName))}
        {filterMenuItem(`Latest day`, fillWithColumn(LATEST_DAY, columnName))}
        {filterMenuItem(`Latest week`, fillWithColumn(LATEST_WEEK, columnName))}
        {filterMenuItem(`Latest month`, fillWithColumn(LATEST_MONTH, columnName))}
        {filterMenuItem(`Latest year`, fillWithColumn(LATEST_YEAR, columnName))}
        <MenuDivider />
        {filterMenuItem(
          `Current hour`,
          fillWithColumnStartEnd(columnName, hourStart, nextHour(hourStart)),
        )}
        {filterMenuItem(
          `Current day`,
          fillWithColumnStartEnd(columnName, dayStart, nextDay(dayStart)),
        )}
        {filterMenuItem(
          `Current month`,
          fillWithColumnStartEnd(columnName, monthStart, nextMonth(monthStart)),
        )}
        {filterMenuItem(
          `Current year`,
          fillWithColumnStartEnd(columnName, yearStart, nextYear(yearStart)),
        )}
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

    function groupByMenuItem(alias: SqlAlias) {
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
        {groupByMenuItem(timeFloorAlias(columnName, 'PT1H', `${columnName}_by_hour`))}
        {groupByMenuItem(timeFloorAlias(columnName, 'P1D', `${columnName}_by_day`))}
        {groupByMenuItem(timeFloorAlias(columnName, 'P7D', `${columnName}_by_week`))}
      </MenuItem>
    );
  }

  function renderAggregateMenu(): JSX.Element | undefined {
    const { columnName, parsedQuery, onQueryChange } = props;
    if (!parsedQuery.hasGroupBy()) return;

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
        {aggregateMenuItem(
          SqlFunction.factory('MAX', [SqlRef.factory(columnName)]).as(`max_${columnName}`),
        )}
        {aggregateMenuItem(
          SqlFunction.factory('MIN', [SqlRef.factory(columnName)]).as(`min_${columnName}`),
        )}
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
