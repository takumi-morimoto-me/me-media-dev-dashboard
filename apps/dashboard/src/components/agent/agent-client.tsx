"use client";

import { useMemo, useTransition, useState } from "react";
import { toast } from "sonner";
import { deleteAsp, bulkDeleteAsps, updateAsp } from "@/actions/asp-actions";
import { useAgentContext } from "@/components/layout/dashboard-client-layout";
import { CsvImportClient } from "@/components/agent/csv-import-client";
import { AspsTable } from "@/components/agent/asps-table";
import { AspWithCredentials } from "@/components/agent/asps-table/constants";
import { AspForm } from "@/components/agent/asp-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AgentClient() {
  const { asps, media, credentials, selectedMediaId } = useAgentContext();
  const [isPending, startTransition] = useTransition();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAsp, setEditingAsp] = useState<AspWithCredentials | null>(null);

  // ASPデータと認証情報を結合
  const aspsWithCredentials = useMemo((): AspWithCredentials[] => {
    return asps.map((asp) => {
      // このASPに紐づく認証情報を取得
      const aspCredentials = credentials
        .filter((cred) => cred.asp_id === asp.id)
        .map((cred) => {
          // メディア情報を追加
          const mediaInfo = media.find((m) => m.id === cred.media_id);
          return {
            ...cred,
            media: {
              id: cred.media_id,
              name: mediaInfo?.name || "Unknown",
            },
          };
        });

      return {
        ...asp,
        credentials: aspCredentials,
      };
    });
  }, [asps, credentials, media]);

  // メディアフィルタリング
  const filteredAsps = useMemo(() => {
    if (!selectedMediaId) return aspsWithCredentials;

    return aspsWithCredentials.filter((asp) =>
      asp.credentials.some((cred) => cred.media_id === selectedMediaId)
    );
  }, [aspsWithCredentials, selectedMediaId]);

  // ASP削除ハンドラ
  const handleDelete = async (asp: AspWithCredentials) => {
    if (!confirm(`${asp.name}を削除しますか？`)) return;

    startTransition(async () => {
      const result = await deleteAsp(asp.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("ASPを削除しました");
      }
    });
  };

  // 一括削除ハンドラ
  const handleBulkDelete = async (aspIds: string[]) => {
    startTransition(async () => {
      const result = await bulkDeleteAsps(aspIds);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.data || "ASPを削除しました");
      }
    });
  };

  // 編集ハンドラ
  const handleEdit = (asp: AspWithCredentials) => {
    setEditingAsp(asp);
  };

  // 追加ハンドラ
  const handleAdd = () => {
    setIsAddDialogOpen(true);
  };

  // URL更新ハンドラ
  const handleUrlUpdate = async (aspId: string, newUrl: string) => {
    const result = await updateAsp(aspId, { login_url: newUrl });

    if (result.error) {
      toast.error(result.error);
      throw new Error(result.error);
    } else {
      toast.success("URLを更新しました");
    }
  };

  // サービス名更新ハンドラ
  const handleNameUpdate = async (aspId: string, newName: string) => {
    const result = await updateAsp(aspId, { name: newName });

    if (result.error) {
      toast.error(result.error);
      throw new Error(result.error);
    } else {
      toast.success("サービス名を更新しました");
    }
  };

  // 稼働状況トグルハンドラ
  const handleActiveToggle = async (aspId: string, isActive: boolean) => {
    const result = await updateAsp(aspId, { is_active: isActive });

    if (result.error) {
      toast.error(result.error);
      throw new Error(result.error);
    } else {
      toast.success(isActive ? "稼働中に変更しました" : "未稼働に変更しました");
    }
  };

  return (
    <div className="w-full h-full pr-6">
      {/* Table Area */}
      <div className="w-full space-y-4">
        {/* Header with Import Button */}
        <div className="flex justify-end">
          <CsvImportClient />
        </div>

        {/* Notion-like Table */}
        <AspsTable
          asps={filteredAsps}
          selectedMediaId={selectedMediaId}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onUrlUpdate={handleUrlUpdate}
          onNameUpdate={handleNameUpdate}
          onActiveToggle={handleActiveToggle}
        />
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ASPを追加</DialogTitle>
          </DialogHeader>
          <AspForm
            media={media}
            onSubmit={async (values) => {
              // TODO: createAsp実装
              console.log("Create ASP:", values);
              setIsAddDialogOpen(false);
            }}
            isPending={isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingAsp} onOpenChange={() => setEditingAsp(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ASPを編集</DialogTitle>
          </DialogHeader>
          {editingAsp && (
            <AspForm
              media={media}
              defaultValues={{
                name: editingAsp.name,
                login_url: editingAsp.login_url || "",
                credentials: editingAsp.credentials.map((cred) => ({
                  media_id: cred.media_id,
                  username_secret_key: cred.username_secret_key || "",
                  password_secret_key: cred.password_secret_key || "",
                })),
              }}
              onSubmit={async (values) => {
                startTransition(async () => {
                  const result = await updateAsp(editingAsp.id, {
                    name: values.name,
                    login_url: values.login_url,
                  });

                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    toast.success("ASPを更新しました");
                    setEditingAsp(null);
                  }
                });
              }}
              isPending={isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
