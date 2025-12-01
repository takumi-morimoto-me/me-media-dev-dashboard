"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// Types
interface AccountItemRow {
  id: string;
  name: string;
  parent_id: string | null;
  children: AccountItemRow[];
  display_order: number;
}

interface Header {
  key: string;
  label: string;
}

interface AggregatedData {
  [itemId: string]: {
    [headerKey: string]: {
      budget: number;
      actual: number;
    };
  };
}

type DisplayUnit = 'monthly' | 'weekly' | 'daily';

interface FinancialsTableProps {
  headers: Header[];
  rows: AccountItemRow[];
  data: AggregatedData;
  viewMode?: 'all' | 'budget' | 'actual';
  onDataChange?: () => void;
  mediaId?: string;
  displayUnit?: DisplayUnit;
}

const formatNumber = (num: number) => new Intl.NumberFormat('ja-JP').format(num);

// Editable Cell Component
const EditableCell: React.FC<{
  value: number;
  isEditable: boolean;
  onSave: (newValue: number) => Promise<void>;
  className?: string;
}> = ({ value, isEditable, onSave, className }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [isSaving, setIsSaving] = useState(false);

  const handleDoubleClick = () => {
    if (isEditable) {
      setIsEditing(true);
      setEditValue(value.toString());
    }
  };

  const handleSave = async () => {
    const newValue = parseInt(editValue.replace(/,/g, ''), 10) || 0;
    if (newValue !== value) {
      setIsSaving(true);
      try {
        await onSave(newValue);
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value.toString());
    }
  };

  if (isEditing) {
    return (
      <Input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-6 w-20 text-right font-mono text-xs p-1"
        autoFocus
        disabled={isSaving}
      />
    );
  }

  return (
    <span
      onDoubleClick={handleDoubleClick}
      className={`${isEditable ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded' : ''} ${className || ''}`}
      title={isEditable ? 'ダブルクリックで編集' : undefined}
    >
      {formatNumber(value)}
    </span>
  );
};

const DataRow: React.FC<{
  item: AccountItemRow;
  headers: Header[];
  data: AggregatedData;
  viewMode: 'all' | 'budget' | 'actual';
  level: number;
  expandedRows: Set<string>;
  toggleRow: (id: string) => void;
  selectedItems: Set<string>;
  toggleItemSelection: (id: string) => void;
  handleDeleteItem: (id: string, name: string) => void;
  isDeleting: boolean;
  mediaId?: string;
  displayUnit?: DisplayUnit;
  onCellSave?: (itemId: string, headerKey: string, type: 'budget' | 'actual', value: number) => Promise<void>;
}> = ({ item, headers, data, viewMode, level, expandedRows, toggleRow, selectedItems, toggleItemSelection, handleDeleteItem, isDeleting, mediaId, displayUnit, onCellSave }) => {
  const isExpanded = expandedRows.has(item.id);

  // Check if this item is editable (not affiliate-related and has no children)
  const isAffiliate = item.name.includes('アフィリエイト');
  const hasChildren = item.children.length > 0;
  const isEditable = !isAffiliate && !hasChildren && mediaId && mediaId !== 'all';

  return (
    <React.Fragment>
      <TableRow className={level === 0 ? "font-bold bg-muted hover:bg-muted/90" : "hover:bg-muted/50"}>
        <TableCell
          className={`sticky left-0 z-10 whitespace-nowrap ${level === 0 ? 'bg-muted' : 'bg-background'}`}
          style={{ paddingLeft: `${1 + level * 1.5}rem` }}
        >
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedItems.has(item.id)}
              onCheckedChange={() => toggleItemSelection(item.id)}
            />
            {item.children.length > 0 ? (
              <Button variant="ghost" size="icon" onClick={() => toggleRow(item.id)} className="h-8 w-8">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : (
              <span className="w-8 h-8" /> // Placeholder for alignment
            )}
            <span>{item.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-60 hover:opacity-100"
              onClick={() => handleDeleteItem(item.id, item.name)}
              disabled={isDeleting}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
        {headers.map(header => {
          const cellData = data[item.id]?.[header.key] || { budget: 0, actual: 0 };
          const budget = cellData.budget;
          const actual = cellData.actual;
          const difference = actual - budget;
          const achievementRate = budget === 0 ? 0 : (actual / budget) * 100;

          const handleBudgetSave = async (newValue: number) => {
            if (onCellSave) {
              await onCellSave(item.id, header.key, 'budget', newValue);
            }
          };

          const handleActualSave = async (newValue: number) => {
            if (onCellSave) {
              await onCellSave(item.id, header.key, 'actual', newValue);
            }
          };

          return (
            <React.Fragment key={header.key}>
              {(viewMode === 'all' || viewMode === 'budget') && (
                <TableCell className="text-right font-mono border-l whitespace-nowrap px-2">
                  <EditableCell
                    value={budget}
                    isEditable={!!isEditable}
                    onSave={handleBudgetSave}
                  />
                </TableCell>
              )}
              {(viewMode === 'all' || viewMode === 'actual') && (
                <TableCell className={`text-right font-mono whitespace-nowrap px-2 ${viewMode === 'actual' ? 'border-l' : ''}`}>
                  <EditableCell
                    value={actual}
                    isEditable={!!isEditable}
                    onSave={handleActualSave}
                  />
                </TableCell>
              )}
              {viewMode === 'all' && (
                <>
                  <TableCell className="text-right font-mono whitespace-nowrap px-2">{formatNumber(difference)}</TableCell>
                  <TableCell className="text-right font-mono border-r whitespace-nowrap px-2">{achievementRate.toFixed(0)}%</TableCell>
                </>
              )}
            </React.Fragment>
          );
        })}
      </TableRow>
      {isExpanded && item.children.map(child => (
        <DataRow
          key={child.id}
          item={child}
          headers={headers}
          data={data}
          viewMode={viewMode}
          level={level + 1}
          expandedRows={expandedRows}
          toggleRow={toggleRow}
          selectedItems={selectedItems}
          toggleItemSelection={toggleItemSelection}
          handleDeleteItem={handleDeleteItem}
          isDeleting={isDeleting}
          mediaId={mediaId}
          displayUnit={displayUnit}
          onCellSave={onCellSave}
        />
      ))}
    </React.Fragment>
  );
};

export default function FinancialsTable({
  headers,
  rows,
  data,
  viewMode = 'all',
  onDataChange,
  mediaId,
  displayUnit = 'monthly',
}: FinancialsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set(rows.map(r => r.id)));
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Parse header key to get date information
  const parseHeaderKeyToDate = useCallback((headerKey: string): string => {
    // headerKey format: 'm-YYYY-MM' for monthly, 'w-YYYY-WW' for weekly, 'd-YYYY-MM-DD' for daily
    if (headerKey.startsWith('m-')) {
      const [, year, month] = headerKey.split('-');
      return `${year}-${month.padStart(2, '0')}-01`;
    } else if (headerKey.startsWith('d-')) {
      return headerKey.substring(2); // Remove 'd-' prefix
    } else if (headerKey.startsWith('w-')) {
      // For weekly, return the first day of the week
      const [, year, week] = headerKey.split('-');
      // Simple approximation: week 1 = Jan 1-7, etc.
      const d = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
      return d.toISOString().split('T')[0];
    }
    return headerKey;
  }, []);

  const handleCellSave = useCallback(async (itemId: string, headerKey: string, type: 'budget' | 'actual', value: number) => {
    if (!mediaId || mediaId === 'all') {
      toast.error('メディアを選択してください');
      return;
    }

    const date = parseHeaderKeyToDate(headerKey);

    try {
      const response = await fetch('/api/financials/update-cell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountItemId: itemId,
          mediaId,
          date,
          amount: value,
          type,
          displayUnit,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      toast.success('保存しました');
      onDataChange?.();
    } catch (error) {
      console.error('Cell save error:', error);
      toast.error('保存に失敗しました');
    }
  }, [mediaId, displayUnit, onDataChange, parseHeaderKeyToDate]);

  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    const collectIds = (items: AccountItemRow[]) => {
      items.forEach(item => {
        ids.add(item.id);
        if (item.children.length > 0) {
          collectIds(item.children);
        }
      });
    };
    collectIds(rows);
    return ids;
  }, [rows]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(allItemIds);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return toast.error("削除する項目を選択してください。");
    if (!confirm(`選択した${selectedItems.size}件の項目を削除しますか？`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/account-items/delete', { /* API endpoint might need review */
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: Array.from(selectedItems) }),
      });
      if (!response.ok) throw new Error('Delete failed');
      toast.success("項目を削除しました。");
      setSelectedItems(new Set());
      onDataChange?.();
    } catch {
      toast.error("削除に失敗しました。");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    // Similar logic to handleDeleteSelected
  };

  const getColSpan = () => {
    if (viewMode === 'all') return 4;
    if (viewMode === 'budget' || viewMode === 'actual') return 1;
    return 4;
  };

  return (
    <div className="bg-background rounded-lg overflow-x-auto">
      {selectedItems.size > 0 && (
        <div className="p-4 bg-muted flex items-center justify-between">
          <span className="text-sm font-medium">{selectedItems.size}件選択中</span>
          <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={isDeleting}>
            <Trash2 className="h-4 w-4 mr-2" />
            選択項目を削除
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2} className="w-[250px] min-w-[250px] sticky left-0 bg-background z-10 align-middle border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedItems.size > 0 && selectedItems.size === allItemIds.size}
                  onCheckedChange={toggleSelectAll}
                />
                勘定項目
              </div>
            </TableHead>
            {headers.map(header => (
              <TableHead key={header.key} colSpan={getColSpan()} className="text-center border-l font-bold">
                {header.label}
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            {headers.map(header => (
              <React.Fragment key={header.key}>
                {(viewMode === 'all' || viewMode === 'budget') && <TableHead className="min-w-[100px] text-right font-normal text-xs border-l whitespace-nowrap px-2">予算</TableHead>}
                {(viewMode === 'all' || viewMode === 'actual') && <TableHead className={`min-w-[100px] text-right font-normal text-xs whitespace-nowrap px-2 ${viewMode === 'actual' ? 'border-l' : ''}`}>実績</TableHead>}
                {viewMode === 'all' && (
                  <>
                    <TableHead className="min-w-[100px] text-right font-normal text-xs whitespace-nowrap px-2">差異</TableHead>
                    <TableHead className="min-w-[100px] text-right font-normal text-xs border-r whitespace-nowrap px-2">達成率</TableHead>
                  </>
                )}
              </React.Fragment>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(item => (
            <DataRow
              key={item.id}
              item={item}
              headers={headers}
              data={data}
              viewMode={viewMode}
              level={0}
              expandedRows={expandedRows}
              toggleRow={toggleRow}
              selectedItems={selectedItems}
              toggleItemSelection={toggleItemSelection}
              handleDeleteItem={handleDeleteItem}
              isDeleting={isDeleting}
              mediaId={mediaId}
              displayUnit={displayUnit}
              onCellSave={handleCellSave}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}