"use client"

import { useState, useEffect } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnResizeMode,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { getColumns } from "./columns"
import {
  AspWithCredentials,
  DEFAULT_COLUMN_SIZES,
  MIN_COLUMN_WIDTH,
  CHECKBOX_WIDTH,
  NAME_MIN_WIDTH,
  PROMPT_MIN_WIDTH,
  STORAGE_KEY_COLUMN_SIZES,
} from "./constants"

interface AspsTableProps {
  asps: AspWithCredentials[]
  selectedMediaId: string | null
  onAdd?: () => void
  onEdit?: (asp: AspWithCredentials) => void
  onDelete?: (asp: AspWithCredentials) => void
  onBulkDelete?: (aspIds: string[]) => void
}

export function AspsTable({
  asps,
  selectedMediaId,
  onAdd,
  onEdit,
  onDelete,
  onBulkDelete,
}: AspsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useState(DEFAULT_COLUMN_SIZES)
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange")

  // LocalStorageからカラム幅を復元（チェックボックスは常に固定）
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_COLUMN_SIZES)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // selectカラムの幅は常にCHECKBOX_WIDTHに固定
          setColumnSizing({
            ...parsed,
            select: CHECKBOX_WIDTH,
          })
        } catch (e) {
          console.error("Failed to parse column sizes", e)
        }
      }
    }
  }, [])

  // カラム幅の変更をLocalStorageに保存（チェックボックスは常に固定）
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sizingToSave = {
        ...columnSizing,
        select: CHECKBOX_WIDTH, // selectカラムの幅は常にCHECKBOX_WIDTHに固定
      }
      localStorage.setItem(STORAGE_KEY_COLUMN_SIZES, JSON.stringify(sizingToSave))
    }
  }, [columnSizing])

  const columns = getColumns({
    selectedMediaId,
    onEdit,
    onDelete,
  })

  const table = useReactTable({
    data: asps,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
    defaultColumn: {
      minSize: MIN_COLUMN_WIDTH,
    },
    // カラムごとの最小幅と最大幅を設定
    columns: columns.map((col) => ({
      ...col,
      minSize: col.id === "select" ? CHECKBOX_WIDTH : col.id === "name" ? NAME_MIN_WIDTH : col.id === "prompt" ? PROMPT_MIN_WIDTH : MIN_COLUMN_WIDTH,
      maxSize: col.id === "select" ? CHECKBOX_WIDTH : undefined,
      size: col.id === "select" ? CHECKBOX_WIDTH : undefined,
    })),
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length

  const handleBulkDelete = () => {
    if (!onBulkDelete || selectedCount === 0) return
    if (!confirm(`${selectedCount}件のASPを削除しますか？`)) return

    const aspIds = selectedRows.map((row) => row.original.id)
    onBulkDelete(aspIds)
    setRowSelection({})
  }

  // 新規作成行のレンダリング
  const renderAddRow = () => (
    <div
      className="sticky bottom-0 bg-card cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onAdd}
    >
      <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors py-2 px-3">
        <Plus className="h-4 w-4" />
        <span className="text-sm">新規ASPを追加</span>
      </div>
    </div>
  )

  return (
    <div className="w-full space-y-3">
      {/* ヘッダーアクション */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {asps.length}件のASP
          {selectedCount > 0 && ` / ${selectedCount}件選択中`}
        </div>
        {selectedCount > 0 && onBulkDelete && (
          <Button
            onClick={handleBulkDelete}
            size="sm"
            variant="destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            選択した{selectedCount}件を削除
          </Button>
        )}
      </div>

      {/* テーブル */}
      <div className="w-full flex flex-col max-h-[calc(100vh-250px)] overflow-hidden border-t">
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-card">
          <Table
            style={{
              width: table.getTotalSize(),
            }}
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{
                        width: header.getSize(),
                        position: "relative",
                      }}
                      className="font-medium text-xs border-r overflow-hidden"
                    >
                      <div className="truncate">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </div>
                      {/* リサイザー */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-transparent hover:bg-blue-500 ${
                            header.column.getIsResizing() ? "bg-blue-500" : ""
                          }`}
                          style={{
                            transform: header.column.getIsResizing()
                              ? "translateX(1px)"
                              : "",
                          }}
                        />
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="w-10 min-w-10 p-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-full w-full rounded-none hover:bg-muted"
                      onClick={onAdd}
                    >
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableHead>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                        maxWidth: cell.column.getSize(),
                      }}
                      className="py-3 border-r overflow-hidden"
                    >
                      <div className="truncate">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="w-10 min-w-10 p-0" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {renderAddRow()}
      </div>
    </div>
  )
}
