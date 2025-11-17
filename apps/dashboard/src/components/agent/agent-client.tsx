"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Trash2, Plus, PlusCircle, ChevronDown } from "lucide-react";
import { createAsp, updateAsp, deleteAsp, bulkDeleteAsps, updateAspMedias } from "@/actions/asp-actions";
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAgentContext } from "@/components/layout/dashboard-client-layout";
import { CsvImportClient } from "@/components/agent/csv-import-client";

// aspsテーブルの型
type Asp = {
  id: string;
  name: string;
  login_url: string | null;
  prompt: string | null;
  created_at: string;
  updated_at: string | null;
  category?: string | null;
};

// type AspCredential = {
//   id: string;
//   asp_id: string;
//   media_id: string;
//   username_secret_key: string | null;
//   password_secret_key: string | null;
// };

type EditingAsp = {
  id: string;
  name: string;
  login_url: string;
  media_ids: string[];
  isNew: boolean;
  displayIndex: number;
};

// 動作確認済みASP一覧（データ取得可能）
const WORKING_ASPS = new Set([
  'a8app',
  'a8net',
  'accesstrade',
  'afb',
  'castalk',
  'imobile',
  'ultiga',
  'valuecommerce',
  'linkag',
  'moshimo'
]);

export function AgentClient() {
  const { asps, media, credentials, selectedMediaId } = useAgentContext();
  const [editingRows, setEditingRows] = useState<EditingAsp[]>([]);
  const [editingPrompts, setEditingPrompts] = useState<{ [key: string]: string }>({});
  const [isPending, startTransition] = useTransition();
  const [selectedAsp, setSelectedAsp] = useState<Asp | null>(null);
  const [editingCell, setEditingCell] = useState<{ aspId: string; field: keyof Asp } | null>(null);
  const [editingValues, setEditingValues] = useState<{ [key: string]: string }>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingMedias, setEditingMedias] = useState<{ aspId: string; mediaIds: string[] } | null>(null);

  // ASPが動作しているかチェック
  const isWorking = (aspName: string): boolean => {
    return WORKING_ASPS.has(aspName.toLowerCase().replace(/[^a-z0-9]/g, ''));
  };

  // フィルタリングされたASPリスト（credentialsベース）
  const filteredAsps = selectedMediaId === null
    ? asps
    : asps.filter(asp => credentials.some(c => c.asp_id === asp.id && c.media_id === selectedMediaId));

  // ASPに紐づくメディアIDリストを取得
  const getMediaIdsForAsp = (aspId: string): string[] => {
    return credentials.filter(c => c.asp_id === aspId).map(c => c.media_id);
  };

  // メディアIDリストからメディア名リストを取得
  const getMediaNames = (mediaIds: string[]): string[] => {
    return mediaIds.map(id => {
      const foundMedia = media.find(m => m.id === id);
      return foundMedia?.name || "-";
    });
  };

  // インライン編集の開始
  const startEditing = (aspId: string, field: keyof Asp, currentValue: string | null) => {
    setEditingCell({ aspId, field });
    setEditingValues({ ...editingValues, [`${aspId}-${field}`]: currentValue || "" });
  };

  // インライン編集の保存（楽観的更新）
  const saveInlineEdit = async (aspId: string, field: keyof Asp) => {
    const newValue = editingValues[`${aspId}-${field}`];
    const asp = asps.find(a => a.id === aspId);

    if (!asp || asp[field] === newValue) {
      // 値が変更されていない場合は何もしない
      setEditingCell(null);
      return;
    }

    // 1. 編集モードを終了
    setEditingCell(null);

    // 2. バックグラウンドでSupabaseに保存
    startTransition(async () => {
      const result = await updateAsp(aspId, { [field]: newValue });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("更新しました");
      }
    });
  };

  // インライン編集のキャンセル
  const cancelInlineEdit = () => {
    setEditingCell(null);
  };

  // メディア編集を開始
  const startEditingMedias = (aspId: string) => {
    const currentMediaIds = getMediaIdsForAsp(aspId);
    setEditingMedias({ aspId, mediaIds: currentMediaIds });
  };

  // メディア編集を保存
  const saveMediaEdit = async (aspId: string, mediaIds: string[]) => {
    setEditingMedias(null);

    startTransition(async () => {
      const result = await updateAspMedias(aspId, mediaIds);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("メディアを更新しました");
      }
    });
  };

  // チェックボックスのトグル
  const toggleRowSelection = (aspId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(aspId)) {
      newSelected.delete(aspId);
    } else {
      newSelected.add(aspId);
    }
    setSelectedRows(newSelected);
  };

  // 全選択/全解除
  const toggleAllSelection = () => {
    if (selectedRows.size === filteredAsps.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredAsps.map(asp => asp.id)));
    }
  };

  // 単一行を削除
  const handleDeleteRow = async (aspId: string) => {
    if (!confirm("本当に削除しますか？")) return;

    startTransition(async () => {
      const result = await deleteAsp(aspId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("削除しました");
        // 選択状態からも削除
        const newSelected = new Set(selectedRows);
        newSelected.delete(aspId);
        setSelectedRows(newSelected);
      }
    });
  };

  // 選択された行を一括削除
  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    if (!confirm(`${selectedRows.size}件のサービスを削除しますか？`)) return;

    const aspIds = Array.from(selectedRows);

    startTransition(async () => {
      const result = await bulkDeleteAsps(aspIds);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.data || "削除しました");
        setSelectedRows(new Set());
      }
    });
  };

  // 指定した位置に新しい編集行を挿入
  const handleInsertRow = (index: number) => {
    const newRow: EditingAsp = {
      id: `temp-${Date.now()}`,
      name: "",
      login_url: "",
      media_ids: [],
      isNew: true,
      displayIndex: index,
    };
    setEditingRows([...editingRows, newRow]);
  };

  // 基本情報を保存（ASP名、URL、メディア）
  const handleSaveBasicInfo = (row: EditingAsp) => {
    if (!row.name || !row.login_url || row.media_ids.length === 0) {
      toast.error("サービス名、ログインURL、メディアを入力してください");
      return;
    }

    startTransition(async () => {
      const result = await createAsp({
        name: row.name,
        login_url: row.login_url,
        prompt: "", // プロンプトは後で編集
        credentials: row.media_ids.map(media_id => ({
          media_id,
          username_secret_key: "",
          password_secret_key: "",
        })),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("サービスを作成しました。");
        setEditingRows(editingRows.filter((r) => r.id !== row.id));
      }
    });
  };

  // プロンプトを保存
  const handleSavePrompt = (aspId: string) => {
    const prompt = editingPrompts[aspId];
    if (prompt === undefined) {
      return;
    }

    startTransition(async () => {
      const result = await updateAsp(aspId, { prompt });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("プロンプトを保存しました");
      }
    });
  };

  // 編集をキャンセル
  const handleCancelEdit = (rowId: string) => {
    setEditingRows(editingRows.filter((r) => r.id !== rowId));
  };

  // 行の値を更新
  const handleUpdateRow = (rowId: string, field: keyof EditingAsp, value: string | string[]) => {
    setEditingRows(
      editingRows.map((r) =>
        r.id === rowId ? { ...r, [field]: value } : r
      )
    );
  };

  const renderEditingRow = (row: EditingAsp) => (
    <TableRow key={row.id} className="bg-muted/30">
      <TableCell></TableCell>
      <TableCell></TableCell>
      <TableCell className="sticky left-0 z-10 bg-muted/30">
        <Input
          placeholder="サービス名を入力"
          value={row.name}
          onChange={(e) => handleUpdateRow(row.id, "name", e.target.value)}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="h-8 w-full justify-between"
            >
              {row.media_ids.length === 0 ? (
                "メディアを選択"
              ) : (
                <div className="flex gap-1 flex-wrap">
                  {row.media_ids.map((id) => {
                    const mediaName = media.find((m) => m.id === id)?.name;
                    return (
                      <Badge key={id} variant="secondary" className="text-xs">
                        {mediaName}
                      </Badge>
                    );
                  })}
                </div>
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-3">
            <div className="space-y-2">
              {media.map((m) => (
                <div key={m.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${row.id}-${m.id}`}
                    checked={row.media_ids.includes(m.id)}
                    onCheckedChange={(checked) => {
                      const newMediaIds = checked
                        ? [...row.media_ids, m.id]
                        : row.media_ids.filter((id) => id !== m.id);
                      handleUpdateRow(row.id, "media_ids", newMediaIds);
                    }}
                  />
                  <label
                    htmlFor={`${row.id}-${m.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {m.name}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>
      <TableCell>
        <Input
          placeholder="https://..."
          value={row.login_url}
          onChange={(e) => handleUpdateRow(row.id, "login_url", e.target.value)}
          className="h-8"
        />
      </TableCell>
      <TableCell colSpan={3} className="text-right">
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleCancelEdit(row.id)}
            disabled={isPending}
          >
            キャンセル
          </Button>
          <Button
            size="sm"
            onClick={() => handleSaveBasicInfo(row)}
            disabled={isPending}
          >
            {isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="flex gap-4 h-full">
      {/* Table Area */}
      <div className="flex-1 space-y-4 pr-6 -ml-2">
        {/* Header with Import Button */}
        <div className="flex justify-end">
          <CsvImportClient />
        </div>

        <div className="rounded-lg overflow-visible">
        <div className="overflow-x-auto" style={{ overflowY: 'visible' }}>
          <Table className="overflow-visible">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] p-0"></TableHead>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedRows.size === filteredAsps.length && filteredAsps.length > 0}
                    onCheckedChange={toggleAllSelection}
                  />
                </TableHead>
                <TableHead className="sticky left-0 z-10 bg-muted min-w-[200px]">サービス名</TableHead>
                <TableHead className="min-w-[120px]">メディア</TableHead>
                <TableHead className="min-w-[250px]">ログインURL</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editingRows.filter(r => r.displayIndex === 0).map(renderEditingRow)}
              {filteredAsps.map((asp, index) => (
                <React.Fragment key={asp.id}>
                  <TableRow className="group hover:bg-muted/50" style={{ overflow: 'visible' }}>
                    <TableCell className="relative p-1 overflow-visible">
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1/2 -translate-y-1/2 left-[-20px] h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-background shadow-sm border"
                          onClick={() => handleInsertRow(index + 1)}
                        >
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>

                    {/* チェックボックス */}
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.has(asp.id)}
                        onCheckedChange={() => toggleRowSelection(asp.id)}
                      />
                    </TableCell>

                    {/* ASP名 - ホバーで開くボタン表示 */}
                    <TableCell className="sticky left-0 z-10 bg-background font-medium group/name relative">
                      {editingCell?.aspId === asp.id && editingCell?.field === "name" ? (
                        <Input
                          value={editingValues[`${asp.id}-name`]}
                          onChange={(e) => setEditingValues({ ...editingValues, [`${asp.id}-name`]: e.target.value })}
                          className="h-8"
                          autoFocus
                          onBlur={() => saveInlineEdit(asp.id, "name")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveInlineEdit(asp.id, "name");
                            if (e.key === "Escape") cancelInlineEdit();
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-between group/name-cell">
                          <div className="flex items-center gap-2 flex-1">
                            {isWorking(asp.name) ? (
                              <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs">
                                動作中
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                未動作
                              </Badge>
                            )}
                            <span onClick={() => startEditing(asp.id, "name", asp.name)} className="cursor-pointer">
                              {asp.name}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover/name-cell:opacity-100 transition-opacity h-6 px-2 ml-2"
                            onClick={() => setSelectedAsp(asp)}
                          >
                            開く
                          </Button>
                        </div>
                      )}
                    </TableCell>

                    {/* メディア - クリックで編集 */}
                    <TableCell>
                      <Popover
                        open={editingMedias?.aspId === asp.id}
                        onOpenChange={(open) => {
                          if (open) {
                            startEditingMedias(asp.id);
                          } else {
                            setEditingMedias(null);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <div className="flex flex-wrap gap-1 cursor-pointer hover:bg-accent/50 p-1 rounded transition-colors">
                            {getMediaNames(getMediaIdsForAsp(asp.id)).map((name, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-[250px] p-3">
                          <div className="space-y-3">
                            <div className="text-sm font-medium">メディアを選択</div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {media.map((m) => (
                                <div key={m.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`edit-${asp.id}-${m.id}`}
                                    checked={editingMedias?.mediaIds.includes(m.id) || false}
                                    onCheckedChange={(checked) => {
                                      if (!editingMedias) return;
                                      const newMediaIds = checked
                                        ? [...editingMedias.mediaIds, m.id]
                                        : editingMedias.mediaIds.filter((id) => id !== m.id);
                                      setEditingMedias({ ...editingMedias, mediaIds: newMediaIds });
                                    }}
                                  />
                                  <label
                                    htmlFor={`edit-${asp.id}-${m.id}`}
                                    className="text-sm cursor-pointer flex-1"
                                  >
                                    {m.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingMedias(null)}
                              >
                                キャンセル
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (editingMedias) {
                                    saveMediaEdit(editingMedias.aspId, editingMedias.mediaIds);
                                  }
                                }}
                                disabled={isPending || !editingMedias || editingMedias.mediaIds.length === 0}
                              >
                                保存
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>

                    {/* ログインURL - クリックで編集 */}
                    <TableCell onClick={() => startEditing(asp.id, "login_url", asp.login_url)} className="cursor-pointer">
                      {editingCell?.aspId === asp.id && editingCell?.field === "login_url" ? (
                        <Input
                          value={editingValues[`${asp.id}-login_url`]}
                          onChange={(e) => setEditingValues({ ...editingValues, [`${asp.id}-login_url`]: e.target.value })}
                          className="h-8"
                          autoFocus
                          onBlur={() => saveInlineEdit(asp.id, "login_url")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveInlineEdit(asp.id, "login_url");
                            if (e.key === "Escape") cancelInlineEdit();
                          }}
                        />
                      ) : (
                        asp.login_url ? (
                          <a
                            href={asp.login_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm truncate block max-w-[250px]"
                            title={asp.login_url}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {asp.login_url}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )
                      )}
                    </TableCell>

                    {/* ゴミ箱ボタン */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteRow(asp.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {editingRows.filter(r => r.displayIndex === index + 1).map(renderEditingRow)}
                </React.Fragment>
              ))}
            </TableBody>
            <TableFooter>
              {selectedRows.size > 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {selectedRows.size}件選択中
                      </span>
                      <Button
                        onClick={handleBulkDelete}
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        選択した項目を削除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Button onClick={() => handleInsertRow(filteredAsps.length)} size="sm" variant="ghost" className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-2" />
                      新規サービスを追加
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableFooter>
          </Table>
        </div>
        </div>
      </div>

      {/* Notion-style Sidebar */}
      <Sheet open={!!selectedAsp} onOpenChange={(open) => !open && setSelectedAsp(null)}>
        <SheetContent className="w-[50vw] sm:max-w-[50vw] overflow-y-auto">
          {selectedAsp && (
            <>
              <SheetHeader>
                <SheetTitle className="text-2xl">{selectedAsp.name}</SheetTitle>
                <SheetDescription>サービスの詳細情報</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 p-6">
                {/* メディア */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">メディア</label>
                  <div className="flex flex-wrap gap-1">
                    {getMediaNames(getMediaIdsForAsp(selectedAsp.id)).map((name, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* ログインURL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">ログインURL</label>
                  {selectedAsp.login_url ? (
                    <a
                      href={selectedAsp.login_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      {selectedAsp.login_url}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">-</p>
                  )}
                </div>

                <Separator />

                {/* 最終実行 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">最終実行</label>
                  <p className="text-sm text-muted-foreground">-</p>
                </div>

                <Separator />

                {/* ステータス */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">ステータス</label>
                  <p className="text-sm text-muted-foreground">-</p>
                </div>

                <Separator />

                {/* プロンプト */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">プロンプト</label>
                  <Textarea
                    placeholder="例:&#10;1. {login_url}にアクセスする&#10;2. ユーザー名フィールドに{SECRET:ASP_USERNAME}を入力..."
                    value={editingPrompts[selectedAsp.id] ?? selectedAsp.prompt ?? ""}
                    onChange={(e) =>
                      setEditingPrompts({
                        ...editingPrompts,
                        [selectedAsp.id]: e.target.value,
                      })
                    }
                    className="min-h-[300px] font-mono text-sm p-4"
                  />
                  <p className="text-xs text-muted-foreground">
                    AIへの操作指示を記述します。シークレットは {`{SECRET:KEY}`} 形式で参照します。
                  </p>
                  <Button onClick={() => handleSavePrompt(selectedAsp.id)} size="sm" className="w-full">
                    プロンプトを保存
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
