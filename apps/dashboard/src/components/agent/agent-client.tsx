"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronsUpDown, MoreHorizontal, Trash2, Plus, PlusCircle } from "lucide-react";
import { createAsp } from "@/actions/asp-actions";
import React from "react";

// aspsテーブルの型
type Asp = {
  id: string;
  name: string;
  login_url: string | null;
  media_id: string | null;
  prompt: string | null;
  created_at: string;
  updated_at: string | null;
  category?: string | null;
};

type Media = {
  id: string;
  name: string;
};

interface AgentClientProps {
  asps: Asp[];
  media: Media[];
}

type EditingAsp = {
  id: string;
  name: string;
  login_url: string;
  media_id: string;
  isNew: boolean;
  displayIndex: number;
};

export function AgentClient({ asps, media }: AgentClientProps) {
  const [editingRows, setEditingRows] = useState<EditingAsp[]>([]);
  const [editingPrompts, setEditingPrompts] = useState<{ [key: string]: string }>({});
  const [isPending, startTransition] = useTransition();

  // メディアIDからメディア名を取得するヘルパー関数
  const getMediaName = (mediaId: string | null) => {
    if (!mediaId) return "-";
    const foundMedia = media.find((m) => m.id === mediaId);
    return foundMedia?.name || "-";
  };

  // 指定した位置に新しい編集行を挿入
  const handleInsertRow = (index: number) => {
    const newRow: EditingAsp = {
      id: `temp-${Date.now()}`,
      name: "",
      login_url: "",
      media_id: "",
      isNew: true,
      displayIndex: index,
    };
    setEditingRows([...editingRows, newRow]);
  };

  // 基本情報を保存（ASP名、URL、メディア）
  const handleSaveBasicInfo = (row: EditingAsp) => {
    if (!row.name || !row.login_url || !row.media_id) {
      toast.error("ASP名、ログインURL、メディアを入力してください");
      return;
    }

    startTransition(async () => {
      const result = await createAsp({
        name: row.name,
        login_url: row.login_url,
        media_id: row.media_id,
        prompt: "", // プロンプトは後で編集
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("ASPを作成しました。");
        setEditingRows(editingRows.filter((r) => r.id !== row.id));
      }
    });
  };

  // プロンプトを保存
  const handleSavePrompt = (aspId: string) => {
    const prompt = editingPrompts[aspId];
    if (prompt === undefined || !prompt.trim()) {
      toast.error("プロンプトを入力してください");
      return;
    }
    // TODO: プロンプト更新のAPI呼び出し
    console.log("Saving prompt for", aspId, prompt);
    toast.success("プロンプトを保存しました");
  };

  // 編集をキャンセル
  const handleCancelEdit = (rowId: string) => {
    setEditingRows(editingRows.filter((r) => r.id !== rowId));
  };

  // 行の値を更新
  const handleUpdateRow = (rowId: string, field: keyof EditingAsp, value: string) => {
    setEditingRows(
      editingRows.map((r) =>
        r.id === rowId ? { ...r, [field]: value } : r
      )
    );
  };

  const renderEditingRow = (row: EditingAsp) => (
    <TableRow key={row.id} className="bg-muted/30">
      <TableCell></TableCell>
      <TableCell className="sticky left-0 z-10 bg-muted/30">
        <Input
          placeholder="ASP名を入力"
          value={row.name}
          onChange={(e) => handleUpdateRow(row.id, "name", e.target.value)}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Select
          value={row.media_id}
          onValueChange={(value) => handleUpdateRow(row.id, "media_id", value)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="メディアを選択" />
          </SelectTrigger>
          <SelectContent>
            {media.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
    <div className="space-y-4 pr-6">
      {/* Table */}
      <div className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] p-0"></TableHead>
                <TableHead className="sticky left-0 z-10 bg-muted min-w-[200px]">ASP名</TableHead>
                <TableHead className="min-w-[120px]">所属メディア</TableHead>
                <TableHead className="min-w-[250px]">ログインURL</TableHead>
                <TableHead className="w-[100px]">最終実行</TableHead>
                <TableHead className="w-[100px]">ステータス</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editingRows.filter(r => r.displayIndex === 0).map(renderEditingRow)}
              {asps.map((asp, index) => (
                <React.Fragment key={asp.id}>
                  <Collapsible asChild>
                    <>
                      <TableRow className="group hover:bg-muted/50">
                        <TableCell className="relative p-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1/2 -translate-y-1/2 left-[-14px] h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-background"
                            onClick={() => handleInsertRow(index + 1)}
                          >
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ChevronsUpDown className="h-4 w-4" />
                              <span className="sr-only">詳細を開閉</span>
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                          {asp.name}
                        </TableCell>
                        <TableCell>{getMediaName(asp.media_id)}</TableCell>
                        <TableCell>
                          {asp.login_url ? (
                            <a
                              href={asp.login_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm truncate block max-w-[250px]"
                              title={asp.login_url}
                            >
                              {asp.login_url}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">-</TableCell>
                        <TableCell className="text-sm text-muted-foreground">-</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">メニューを開く</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>今すぐ実行</DropdownMenuItem>
                              <DropdownMenuItem>編集</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-500" onClick={() => toast.error("削除機能は未実装です")}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                削除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <tr className="bg-muted/20 hover:bg-muted/40">
                          <td colSpan={7} className="p-0">
                            <div className="p-4 space-y-2">
                              <label className="text-sm font-medium">プロンプト</label>
                              <Textarea
                                placeholder="例:&#10;1. {login_url}にアクセスする&#10;2. ユーザー名フィールドに{SECRET:ASP_USERNAME}を入力..."
                                value={editingPrompts[asp.id] ?? asp.prompt ?? ""}
                                onChange={(e) =>
                                  setEditingPrompts({
                                    ...editingPrompts,
                                    [asp.id]: e.target.value,
                                  })
                                }
                                className="min-h-[200px] font-mono text-sm bg-background"
                              />
                              <div className="flex items-center justify-between">
                                 <p className="text-xs text-muted-foreground">
                                  AIへの操作指示を記述します。シークレットは {`{SECRET:KEY}`} 形式で参照します。
                                 </p>
                                <Button onClick={() => handleSavePrompt(asp.id)} size="sm">
                                  プロンプトを保存
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                  {editingRows.filter(r => r.displayIndex === index + 1).map(renderEditingRow)}
                </React.Fragment>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7}>
                  <Button onClick={() => handleInsertRow(asps.length)} size="sm" variant="ghost" className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    新規ASPを追加
                  </Button>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
