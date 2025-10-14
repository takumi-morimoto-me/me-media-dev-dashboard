"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { FinancialSummary } from "@/lib/mock-data/financial-summary";

type TransformedDataItem = {
  id: string;
  name: string;
  parentId: string | null;
  displayOrder: number;
  children: TransformedDataItem[];
  monthlyData: { [month: number]: { budget: number; actual: number } };
};

const transformDataForExport = (data: FinancialSummary[]): TransformedDataItem[] => {
  const itemsById = new Map<string, TransformedDataItem>();
  const rootItems: TransformedDataItem[] = [];

  if (!data) return [];

  data.forEach(item => {
    if (!itemsById.has(item.account_item_id)) {
      itemsById.set(item.account_item_id, {
        id: item.account_item_id,
        name: item.account_item_name,
        parentId: item.parent_id,
        displayOrder: item.display_order,
        children: [],
        monthlyData: {},
      });
    }
    const currentItem = itemsById.get(item.account_item_id)!;
    currentItem.monthlyData[item.month] = {
      budget: item.total_budget,
      actual: item.total_actual,
    };
  });

  itemsById.forEach((item) => {
    if (item.parentId && itemsById.has(item.parentId)) {
      const parent = itemsById.get(item.parentId)!;
      parent.children.push(item);
    } else {
      rootItems.push(item);
    }
  });
  
  rootItems.forEach(item => {
    item.children.sort((a, b) => a.displayOrder - b.displayOrder);
  });

  return rootItems.sort((a, b) => a.displayOrder - b.displayOrder);
};


interface ParsedCSVData {
  mode: 'both' | 'budget' | 'actual';
  months: number[];
  items: {
    parent: string;
    account_item: string;
    values: { year: number; month: number; budget: number | null; actual: number | null }[];
  }[];
}

interface AccountItemsImportProps {
  mediaId: string;
  onImportComplete: () => void;
  dataToExport: FinancialSummary[];
  selectedYear: number;
  fiscalYearStartMonth: number;
}

export default function AccountItemsImport({ mediaId, onImportComplete, dataToExport, selectedYear, fiscalYearStartMonth }: AccountItemsImportProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedCSVData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'budget' | 'actual'>('budget');

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, type: 'budget' | 'actual') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadType(type);

    try {
      const text = await file.text();
      const lines = text.trim().split('\n');

      if (lines.length < 2) {
        toast.error("ファイルが空です。");
        return;
      }

      const isTSV = file.name.endsWith('.tsv') || lines[0].includes('\t');
      const delimiter = isTSV ? '\t' : ',';

      if (!isTSV) {
        toast.warning("CSV形式を検出しました。数値にカンマ（,）が含まれていないか確認してください。推奨形式: TSV", {
          duration: 5000,
        });
      }

      const headers = lines[0].split(delimiter).map(s => s.trim());
      const dataLines = lines.slice(1);

      let mode: 'both' | 'budget' | 'actual' = 'budget';
      const months: number[] = [];

      const hasBudget = headers.some(h => h.includes('予算'));
      const hasActual = headers.some(h => h.includes('実績'));

      if (hasBudget && hasActual) {
        mode = 'both';
        headers.slice(2).forEach(h => {
          const match = h.match(/(\d+)月/);
          if (match && !months.includes(parseInt(match[1]))) {
            months.push(parseInt(match[1]));
          }
        });
      } else {
        mode = type;
        headers.slice(2).forEach(h => {
          const match = h.match(/(\d+)月/);
          if (match) {
            months.push(parseInt(match[1]));
          }
        });
      }

      const items = dataLines.map(line => {
        const cells = line.split(delimiter).map(s => s.trim());
        const parent = cells[0];
        const account_item = cells[1];
        const values: { year: number; month: number; budget: number | null; actual: number | null }[] = [];

        if (mode === 'both') {
          months.forEach((month, idx) => {
            const year = month < fiscalYearStartMonth ? selectedYear + 1 : selectedYear;
            const budgetValue = parseFloat(cells[2 + idx * 2]?.replace(/,/g, '') || '0') || 0;
            const actualValue = parseFloat(cells[2 + idx * 2 + 1]?.replace(/,/g, '') || '0') || 0;
            values.push({ year, month, budget: budgetValue, actual: actualValue });
          });
        } else {
          months.forEach((month, idx) => {
            const year = month < fiscalYearStartMonth ? selectedYear + 1 : selectedYear;
            const value = parseFloat(cells[2 + idx]?.replace(/,/g, '') || '0') || 0;
            if (mode === 'budget') {
              values.push({ year, month, budget: value, actual: null });
            } else {
              values.push({ year, month, budget: null, actual: value });
            }
          });
        }
        return { parent, account_item, values };
      });

      const errors = items.filter(item => !item.account_item || !item.parent);
      if (errors.length > 0) {
        toast.error("ファイルの形式が正しくありません。勘定項目名と親項目は必須です。");
        return;
      }

      setParsedData({ mode, months, items });
      setIsDialogOpen(true);
    } catch (error) {
      console.error("File parse error:", error);
      toast.error("ファイルの読み込みに失敗しました。");
    }

    event.target.value = '';
  };

  const handleDownloadTemplate = (type: 'both' | 'budget' | 'actual') => {
    let tsvContent = '';

    if (type === 'both') {
      tsvContent = `parent\taccount_item\t4月予算\t4月実績\t5月予算\t5月実績\t6月予算\t6月実績\n売上\t広告収入\t1,000,000\t950,000\t1,200,000\t1,100,000\t1,100,000\t1,050,000\n売上\t制作収入\t500,000\t480,000\t550,000\t520,000\t600,000\t580,000\n費用\t人件費\t800,000\t800,000\t800,000\t800,000\t800,000\t800,000\n費用\t広告費\t300,000\t280,000\t350,000\t320,000\t400,000\t380,000`;
    } else if (type === 'budget') {
      tsvContent = `parent\taccount_item\t4月\t5月\t6月\t7月\t8月\t9月\n売上\t広告収入\t1,000,000\t1,200,000\t1,100,000\t1,300,000\t1,400,000\t1,500,000\n売上\t制作収入\t500,000\t550,000\t600,000\t650,000\t700,000\t750,000\n費用\t人件費\t800,000\t800,000\t800,000\t800,000\t800,000\t800,000\n費用\t広告費\t300,000\t350,000\t400,000\t450,000\t500,000\t550,000`;
    } else {
      tsvContent = `parent\taccount_item\t4月\t5月\t6月\t7月\t8月\t9月\n売上\t広告収入\t950,000\t1,100,000\t1,050,000\t1,250,000\t1,350,000\t1,450,000\n売上\t制作収入\t480,000\t520,000\t580,000\t620,000\t680,000\t720,000\n費用\t人件費\t800,000\t800,000\t800,000\t800,000\t800,000\t800,000\n費用\t広告費\t280,000\t320,000\t380,000\t420,000\t480,000\t520,000`;
    }

    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filename = type === 'both'
      ? 'budget_actual_template.tsv'
      : type === 'budget'
        ? 'budget_template.tsv'
        : 'actual_template.tsv';

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (mediaId === 'all') {
      toast.error("メディアを選択してください。");
      return;
    }

    if (!parsedData) {
      toast.error("データがありません。");
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch('/api/financials/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId,
          items: parsedData.items,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      toast.success("データをインポートしました。");

      setIsDialogOpen(false);
      setParsedData(null);
      onImportComplete();
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error instanceof Error ? error.message : "インポートに失敗しました。");
    } finally {
      setIsUploading(false);
    }
  };

  const handleExportCurrentData = () => {
    if (!dataToExport || dataToExport.length === 0) {
      toast.error("エクスポートするデータがありません。");
      return;
    }

    const transformedData = transformDataForExport(dataToExport);
    
    const allMonths = [...new Set(dataToExport.map(d => d.month))].sort((a, b) => a - b);

    const header = [
      "parent",
      "account_item",
      ...allMonths.flatMap(month => [`${month}月予算`, `${month}月実績`])
    ].join('\t');

    const rows = transformedData.flatMap(parent => {
      const parentRow = [
        "",
        parent.name,
        ...allMonths.flatMap(month => {
          const data = parent.monthlyData[month] || { budget: 0, actual: 0 };
          return [data.budget, data.actual];
        })
      ].join('\t');

      const childRows = parent.children.map(child => {
        return [
          parent.name,
          child.name,
          ...allMonths.flatMap(month => {
            const data = child.monthlyData[month] || { budget: 0, actual: 0 };
            return [data.budget, data.actual];
          })
        ].join('\t');
      });

      return [parentRow, ...childRows];
    });

    const tsvContent = [header, ...rows].join('\n');

    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = `financial_data_${mediaId}_${new Date().toISOString().split('T')[0]}.tsv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    toast.success("データのエクスポートが完了しました。");
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Template Downloads & Export */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <Download className="h-4 w-4" />
              ダウンロード
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60" align="start">
            <div className="space-y-1">
              <h4 className="font-medium text-sm px-2 pt-1.5 pb-1">現在のデータをエクスポート</h4>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={handleExportCurrentData}
              >
                TSV形式でエクスポート
              </Button>

              <hr className="my-2" />

              <h4 className="font-medium text-sm px-2 pt-1.5 pb-1">空のテンプレート</h4>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleDownloadTemplate('both')}
              >
                予算・実績両方 (TSV)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleDownloadTemplate('budget')}
              >
                予算のみ (TSV)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleDownloadTemplate('actual')}
              >
                実績のみ (TSV)
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Upload Buttons */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <Upload className="h-4 w-4" />
              インポート
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <div className="space-y-2">
              <h4 className="font-medium text-sm mb-2">インポート種類</h4>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => document.getElementById('csv-upload-budget')?.click()}
              >
                予算データ
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => document.getElementById('csv-upload-actual')?.click()}
              >
                実績データ
              </Button>
              <p className="text-xs text-muted-foreground mt-2 px-2">
                ※TSV/CSV両方対応
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Hidden file inputs */}
      <input
        id="csv-upload-budget"
        type="file"
        accept=".tsv,.csv"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'budget')}
      />
      <input
        id="csv-upload-actual"
        type="file"
        accept=".tsv,.csv"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'actual')}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>データインポート確認</DialogTitle>
            <DialogDescription>
              以下の内容でインポートします。同じ親項目配下のデータは部分更新されます。
              <br />
              <span className="text-xs text-muted-foreground">※TSV形式推奨（カンマ入り数値対応）</span>
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            {parsedData && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">親項目</TableHead>
                    <TableHead>勘定項目</TableHead>
                    {parsedData.months.map(month => (
                      <React.Fragment key={month}>
                        {(parsedData.mode === 'both' || parsedData.mode === 'budget') && (
                          <TableHead className="text-right">{month}月予算</TableHead>
                        )}
                        {(parsedData.mode === 'both' || parsedData.mode === 'actual') && (
                          <TableHead className="text-right">{month}月実績</TableHead>
                        )}
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {item.parent}
                      </TableCell>
                      <TableCell>{item.account_item}</TableCell>
                      {parsedData.months.map(month => {
                        const value = item.values.find(v => v.month === month);
                        return (
                          <React.Fragment key={month}>
                            {(parsedData.mode === 'both' || parsedData.mode === 'budget') && (
                              <TableCell className="text-right font-mono">
                                {value?.budget?.toLocaleString() ?? '-'}
                              </TableCell>
                            )}
                            {(parsedData.mode === 'both' || parsedData.mode === 'actual') && (
                              <TableCell className="text-right font-mono">
                                {value?.actual?.toLocaleString() ?? '-'}
                              </TableCell>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isUploading}>
              キャンセル
            </Button>
            <Button onClick={handleImport} disabled={isUploading}>
              {isUploading ? 'インポート中...' : 'インポート'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}