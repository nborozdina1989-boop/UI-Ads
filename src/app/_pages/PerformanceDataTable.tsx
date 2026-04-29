'use client';
/* eslint-disable react-hooks/incompatible-library */

import React, { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import type { TableDimension } from "@/query/types";

export type PerformanceTableRow = {
  id: number | string;
  name: string;
  parent: string;
  impressions: number;
  validImpressions: number;
  ivtImpressions: number;
  givtImpressions: number;
  sivtImpressions: number;
  validImpressionsRate: number;
  viewableImpressions: number;
  viewabilityRate: number;
  reach: number;
  frequency: number;
  clicks: number;
  validClicks: number;
  ivtClicks: number;
  givtClicks: number;
  sivtClicks: number;
  ivtClickRate: number;
  givtClickRate: number;
  sivtClickRate: number;
  ctr: number;
  ivtRate: number;
  givtRate: number;
  sivtRate: number;
  spend: number;
  cpm: number;
  cpr: number;
  cpc: number;
  cpa: number;
  plannedBudget: number;
  totalConversions: number;
  incrementalConversions: number;
  vcr100: number;
};

type DashboardSortingState = Array<{ id: string; desc: boolean }>;
type DashboardPaginationState = { pageIndex: number; pageSize: number };

type PerformanceDataTableProps = {
  rows: PerformanceTableRow[];
  tableDimension: TableDimension;
  pageCount: number;
  sorting: DashboardSortingState;
  columnVisibility: Record<string, boolean>;
  pagination: DashboardPaginationState;
  onSortingChange: React.Dispatch<React.SetStateAction<DashboardSortingState>>;
  onColumnVisibilityChange: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onPaginationChange: React.Dispatch<React.SetStateAction<DashboardPaginationState>>;
};

function fmtInt(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

function fmtPercent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function fmtFloat(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function fmtCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export function PerformanceDataTable(props: PerformanceDataTableProps) {
  const {
    rows,
    tableDimension,
    pageCount,
    sorting,
    columnVisibility,
    pagination,
    onSortingChange,
    onColumnVisibilityChange,
    onPaginationChange,
  } = props;

  const columns = useMemo<ColumnDef<PerformanceTableRow>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: (info) => <span className="font-mono">{String(info.getValue())}</span>,
      },
      {
        accessorKey: "name",
        header:
          tableDimension === "campaign"
            ? "Кампания"
            : tableDimension === "placement"
              ? "Размещение"
              : tableDimension === "supplier"
                ? "Поставщик"
                : tableDimension === "client"
                  ? "Клиент"
                  : tableDimension === "advertiser"
                    ? "Рекламодатель"
                    : "Дата",
        cell: (info) => <span>{String(info.getValue())}</span>,
      },
      {
        accessorKey: "parent",
        header: tableDimension === "placement" ? "Кампания" : "Родитель",
      },
      {
        accessorKey: "impressions",
        header: "Показы",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "validImpressions",
        header: "Засчитанные показы",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "ivtImpressions",
        header: "IVT показы",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "givtImpressions",
        header: "Показы GIVT",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "sivtImpressions",
        header: "Показы SIVT",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "viewableImpressions",
        header: "Видимые показы (IAB)",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "viewabilityRate",
        header: "Видимость (IAB), %",
        cell: (info) => fmtPercent(Number(info.getValue())),
      },
      {
        accessorKey: "reach",
        header: "Охват",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "frequency",
        header: "Частота",
        cell: (info) => fmtFloat(Number(info.getValue())),
      },
      {
        accessorKey: "clicks",
        header: "Клики",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "validClicks",
        header: "Засчитанные клики",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "ivtClicks",
        header: "IVT клики",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "givtClicks",
        header: "Клики GIVT",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "sivtClicks",
        header: "Клики SIVT",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "ctr",
        header: "CTR",
        cell: (info) => fmtPercent(Number(info.getValue())),
      },
      {
        accessorKey: "ivtClickRate",
        header: "IVT клики, %",
        cell: (info) => fmtPercent(Number(info.getValue())),
      },
      {
        accessorKey: "givtClickRate",
        header: "Клики GIVT %",
        cell: (info) => fmtPercent(Number(info.getValue())),
      },
      {
        accessorKey: "sivtClickRate",
        header: "Клики SIVT %",
        cell: (info) => fmtPercent(Number(info.getValue())),
      },
      {
        accessorKey: "ivtRate",
        header: "IVT показы, %",
        cell: (info) => fmtPercent(Number(info.getValue())),
      },
      {
        accessorKey: "validImpressionsRate",
        header: "Засчитано показов, %",
        cell: (info) => fmtPercent(Number(info.getValue())),
      },
      {
        accessorKey: "givtRate",
        header: "Показы GIVT %",
        cell: (info) => fmtPercent(Number(info.getValue())),
      },
      {
        accessorKey: "sivtRate",
        header: "Показы SIVT %",
        cell: (info) => fmtPercent(Number(info.getValue())),
      },
      {
        accessorKey: "spend",
        header: "Затраты",
        cell: (info) => fmtCurrency(Number(info.getValue())),
      },
      {
        accessorKey: "plannedBudget",
        header: "Плановый бюджет",
        cell: (info) => fmtCurrency(Number(info.getValue())),
      },
      {
        accessorKey: "cpm",
        header: "CPM",
        cell: (info) => (Number(info.row.original.impressions) > 0 ? fmtCurrency(Number(info.getValue())) : "—"),
      },
      {
        accessorKey: "cpr",
        header: "CPR",
        cell: (info) => (Number(info.row.original.reach) > 0 ? fmtCurrency(Number(info.getValue())) : "—"),
      },
      {
        accessorKey: "cpc",
        header: "CPC",
        cell: (info) => (Number(info.row.original.clicks) > 0 ? fmtCurrency(Number(info.getValue())) : "—"),
      },
      {
        accessorKey: "cpa",
        header: "CPA",
        cell: (info) =>
          Number(info.row.original.totalConversions) > 0 ? fmtCurrency(Number(info.getValue())) : "—",
      },
      {
        accessorKey: "totalConversions",
        header: "Всего конверсий",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "incrementalConversions",
        header: "Инкрементальные конверсии",
        cell: (info) => fmtInt(Number(info.getValue())),
      },
      {
        accessorKey: "vcr100",
        header: "Досмотры 100% (VCR100)",
        cell: (info) => fmtPercent(Number(info.getValue())),
      },
    ],
    [tableDimension]
  );

  const table = useReactTable({
    data: rows,
    columns,
    pageCount,
    state: {
      sorting: sorting as SortingState,
      columnVisibility,
      pagination: pagination as PaginationState,
    },
    onSortingChange: onSortingChange as React.Dispatch<React.SetStateAction<SortingState>>,
    onColumnVisibilityChange,
    onPaginationChange: onPaginationChange as React.Dispatch<React.SetStateAction<PaginationState>>,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <details className="mb-3 rounded-md border p-2">
        <summary className="cursor-pointer text-xs font-medium">Выбор колонок</summary>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {table.getAllLeafColumns().map((column) => {
            const id = column.id;
            const fallbackColumnLabels: Record<string, string> = {
              id: "ID",
              name: "Наименование",
              parent: tableDimension === "placement" ? "Кампания" : "Родитель",
              impressions: "Показы",
              validImpressions: "Засчитанные показы",
              ivtImpressions: "IVT показы",
              givtImpressions: "Показы GIVT",
              sivtImpressions: "Показы SIVT",
              validImpressionsRate: "Засчитано показов, %",
              viewableImpressions: "Видимые показы (IAB)",
              viewabilityRate: "Видимость (IAB), %",
              reach: "Охват",
              frequency: "Частота",
              clicks: "Клики",
              validClicks: "Засчитанные клики",
              ivtClicks: "IVT клики",
              givtClicks: "Клики GIVT",
              sivtClicks: "Клики SIVT",
              ivtClickRate: "IVT клики, %",
              givtClickRate: "Клики GIVT %",
              sivtClickRate: "Клики SIVT %",
              ctr: "CTR",
              ivtRate: "IVT показы, %",
              givtRate: "Показы GIVT %",
              sivtRate: "Показы SIVT %",
              spend: "Затраты",
              plannedBudget: "Плановый бюджет",
              cpm: "CPM",
              cpr: "CPR",
              cpc: "CPC",
              cpa: "CPA",
              totalConversions: "Всего конверсий",
              incrementalConversions: "Инкрементальные конверсии",
              vcr100: "Досмотры 100% (VCR100)",
            };
            const header = column.columnDef.header;
            const label =
              typeof header === "string" && header.trim().length > 0
                ? header
                : (fallbackColumnLabels[id] ?? id);
            return (
              <label key={id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={column.getToggleVisibilityHandler()}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </details>

      <div className="overflow-auto rounded-md border">
        <table className="w-full border-collapse text-xs">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-gray-100">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer border-b p-2 text-left"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-t p-2 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <div>
          Страница {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <button
            className="rounded border px-2 py-1 disabled:opacity-40"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Назад
          </button>
          <button
            className="rounded border px-2 py-1 disabled:opacity-40"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Далее
          </button>
        </div>
      </div>
    </>
  );
}
