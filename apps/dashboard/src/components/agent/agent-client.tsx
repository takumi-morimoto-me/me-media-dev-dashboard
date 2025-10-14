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
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { AspForm, aspFormSchema } from "./asp-form";
import { createAsp } from "@/actions/asp-actions";
import { z } from "zod";

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
};

type EditingPrompt = {
  aspId: string;
  prompt: string;
};

export function AgentClient({ asps, media }: AgentClientProps) {
  const [editingRows, setEditingRows] = useState<EditingAsp[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<EditingPrompt | null>(null);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // メディアIDからメディア名を取得するヘルパー関数
  const getMediaName = (mediaId: string | null) => {
    if (!mediaId) return "-";
    const foundMedia = media.find((m) => m.id === mediaId);
    return foundMedia?.name || "-";
  };

  // 新しい行を追加
  const handleAddNew = () => {
    const newRow: EditingAsp = {
      id: `temp-${Date.now()}`,
      name: "",
      login_url: "",
      media_id: "",
      isNew: true,
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
        prompt: "", // 一旦空で保存、後でプロンプトを編集
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("ASPを作成しました。プロンプトを設定してください。");
        // 編集中の行を削除
        setEditingRows(editingRows.filter((r) => r.id !== row.id));
      }
    });
  };

  // プロンプト編集を開く
  const handleOpenPromptEdit = (aspId: string, currentPrompt: string) => {
    setEditingPrompt({ aspId, prompt: currentPrompt });
    setIsPromptDialogOpen(true);
  };

  // プロンプトを保存
  const handleSavePrompt = () => {
    if (!editingPrompt || !editingPrompt.prompt.trim()) {
      toast.error("プロンプトを入力してください");
      return;
    }

    // TODO: プロンプト更新のAPI呼び出し
    toast.success("プロンプトを保存しました");
    setIsPromptDialogOpen(false);
    setEditingPrompt(null);
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

  return (
    <>
      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">ASP名</TableHead>
              <TableHead className="min-w-[120px]">所属メディア</TableHead>
              <TableHead className="min-w-[200px]">ログインURL</TableHead>
              <TableHead className="w-[120px]">最終実行</TableHead>
              <TableHead className="w-[80px]">ステータス</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 既存のASP一覧 */}
            {asps.map((asp) => (
              <TableRow key={asp.id}>
                <TableCell className="font-medium">{asp.name}</TableCell>
                <TableCell>{getMediaName(asp.media_id)}</TableCell>
                <TableCell>
                  {asp.login_url ? (
                    <a
                      href={asp.login_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm truncate block max-w-[200px]"
                      title={asp.login_url}
                    >
                      {asp.login_url}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenPromptEdit(asp.id, asp.prompt || "")}
                    className="h-8"
                  >
                    プロンプト編集
                  </Button>
                </TableCell>
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
                      <DropdownMenuItem className="text-red-500">削除</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}

            {/* 編集中の新規行 */}
            {editingRows.map((row) => (
              <TableRow key={row.id} className="bg-muted/30">
                <TableCell>
                  <Input
                    placeholder="ASP名"
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
                      <SelectValue placeholder="選択" />
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
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add new button outside table - Notion style */}
      <button
        onClick={handleAddNew}
        className="mt-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded flex items-center gap-2 transition-colors"
      >
        <PlusCircle className="h-4 w-4" />
        <span>新規</span>
      </button>

      {/* Prompt Edit Dialog */}
      <Dialog open={isPromptDialogOpen} onOpenChange={setIsPromptDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>プロンプトを編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="例:&#10;1. {login_url}にアクセスする&#10;2. ユーザー名フィールドに{SECRET:ASP_USERNAME}を入力&#10;3. パスワードフィールドに{SECRET:ASP_PASSWORD}を入力&#10;4. 「ログイン」ボタンをクリック&#10;5. 「レポート」メニューをクリック&#10;6. 「成果報酬」のテーブルから昨日の確定報酬額を取得"
              value={editingPrompt?.prompt || ""}
              onChange={(e) =>
                setEditingPrompt(
                  editingPrompt ? { ...editingPrompt, prompt: e.target.value } : null
                )
              }
              className="min-h-[400px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              AIエージェントへの操作指示を自然言語で記述してください。
              シークレット情報は {`{SECRET:KEY_NAME}`} 形式で記述します。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsPromptDialogOpen(false);
                  setEditingPrompt(null);
                }}
              >
                キャンセル
              </Button>
              <Button onClick={handleSavePrompt}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
