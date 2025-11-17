"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Upload, Download, FileText, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { bulkImportAspsFromCsv, exportAspsAsCsv, type CsvImportRow, type CsvImportResult } from "@/actions/asp-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CsvImportClientProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CsvImportClient({ open, onOpenChange }: CsvImportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSVファイルをパースする関数
  const parseCSV = (content: string): CsvImportRow[] => {
    const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

    if (lines.length === 0) {
      throw new Error('CSVファイルが空です');
    }

    // ヘッダー行をスキップ
    const dataLines = lines.slice(1);
    const rows: CsvImportRow[] = [];

    for (const line of dataLines) {
      const values = parseCSVLine(line);

      if (values.length < 2) {
        continue; // 不正な行はスキップ
      }

      rows.push({
        name: values[0] || '',
        login_url: values[1] || '',
        category: values[2] || '',
        prompt: values[3] || '',
        media_name: values[4] || '',
        username: values[5] || '',
        password: values[6] || '',
      });
    }

    return rows;
  };

  // CSV行をパースする関数（引用符対応）
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  // ファイル選択
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await processFile(file);
  };

  // ファイル処理
  const processFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('CSVファイルを選択してください');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;

      try {
        const rows = parseCSV(content);

        if (rows.length === 0) {
          toast.error('有効なデータが見つかりませんでした');
          return;
        }

        // インポート実行
        startTransition(async () => {
          const result = await bulkImportAspsFromCsv(rows);

          if (result.error) {
            toast.error(result.error);
          } else if (result.data) {
            setImportResult(result.data);
            toast.success(`${result.data.success + result.data.updated}件のASPを処理しました`);
          }
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(error.message);
        } else {
          toast.error('CSVの解析に失敗しました');
        }
      }
    };

    reader.readAsText(file);
  };

  // ドラッグ&ドロップ
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  // テンプレートダウンロード
  const handleDownloadTemplate = () => {
    const template = 'name,login_url,category,prompt,media_name,username,password\n# 例: A8.net,https://www.a8.net/,ASP,A8.netのデータを取得,ReRe,testuser,testpass\n# 例: もしもアフィリエイト,https://af.moshimo.com/,ASP,もしものデータを取得,,,\n# 同じASP名で複数行を書くことで、複数メディアの認証情報を登録できます\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'asps-template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('テンプレートをダウンロードしました');
  };

  // 既存データエクスポート
  const handleExportCurrent = async () => {
    startTransition(async () => {
      const result = await exportAspsAsCsv();

      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `asps-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSVをエクスポートしました');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>ASP一括登録</SheetTitle>
          <SheetDescription>
            CSVファイルからASPを一括で登録・更新できます
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* アクションボタン */}
          <div className="flex gap-3">
            <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              テンプレートをダウンロード
            </Button>
            <Button onClick={handleExportCurrent} variant="outline" size="sm" disabled={isPending}>
              <FileText className="h-4 w-4 mr-2" />
              既存データをエクスポート
            </Button>
          </div>

          {/* アップロードエリア */}
          <Card>
            <CardHeader>
              <CardTitle>CSVファイルをアップロード</CardTitle>
              <CardDescription>
                ドラッグ&ドロップまたはクリックしてファイルを選択
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                  ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                `}
              >
                <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-lg font-medium mb-2">
                  {isDragging ? 'ここにドロップ' : 'CSVファイルをドロップ'}
                </p>
                <p className="text-sm text-muted-foreground">
                  またはクリックしてファイルを選択
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* CSVフォーマット説明 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-5 w-5" />
                CSVフォーマット
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted p-4 rounded-md font-mono text-sm">
                name,login_url,category,prompt,media_name,username,password<br />
                A8.net,https://www.a8.net/,ASP,A8.netのデータを取得,ReRe,testuser,testpass<br />
                もしもアフィリエイト,https://af.moshimo.com/,ASP,もしものデータを取得,,,
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>name</strong> (必須): ASP名</li>
                <li><strong>login_url</strong> (必須): ログインページのURL</li>
                <li><strong>category</strong> (任意): カテゴリ</li>
                <li><strong>prompt</strong> (任意): AI操作プロンプト</li>
                <li><strong>media_name</strong> (任意): メディア名（例: ReRe, Mortorz）</li>
                <li><strong>username</strong> (任意): ログインユーザー名</li>
                <li><strong>password</strong> (任意): ログインパスワード</li>
              </ul>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>注意:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>同じASP名が既に存在する場合は更新されます</li>
                  <li>同じASP名で複数行書くことで、複数メディアの認証情報を登録できます</li>
                  <li>認証情報を登録する場合、media_nameは必須です</li>
                  <li>username, passwordは任意で、片方だけでも登録可能です</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* インポート結果 */}
          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  インポート結果
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{importResult.success}</p>
                    <p className="text-sm text-muted-foreground">新規登録</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">{importResult.updated}</p>
                    <p className="text-sm text-muted-foreground">更新</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-600">{importResult.skipped}</p>
                    <p className="text-sm text-muted-foreground">スキップ</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <p className="text-3xl font-bold text-red-600">{importResult.errors.length}</p>
                    <p className="text-sm text-muted-foreground">エラー</p>
                  </div>
                </div>

                {/* エラー詳細 */}
                {importResult.errors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <h3 className="font-semibold">エラー詳細</h3>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">行番号</TableHead>
                            <TableHead>ASP名</TableHead>
                            <TableHead>エラー内容</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importResult.errors.map((error, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <Badge variant="destructive">{error.row}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {error.data?.name || '-'}
                              </TableCell>
                              <TableCell className="text-red-600">
                                {error.message}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
