"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { AspWithCredentials } from "./constants"
import { PasswordCell, EditableUrlCell } from "./cells"

export interface GetColumnsOptions {
  selectedMediaId: string | null
  onEdit?: (asp: AspWithCredentials) => void
  onDelete?: (asp: AspWithCredentials) => void
  onUrlUpdate?: (aspId: string, newUrl: string) => Promise<void>
}

export function getColumns(options?: GetColumnsOptions): ColumnDef<AspWithCredentials>[] {
  const { selectedMediaId, onUrlUpdate } = options || {}

  return [
    // チェックボックス
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="全て選択"
          className="mx-auto block"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="行を選択"
          className="mx-auto block"
        />
      ),
      enableSorting: false,
      enableResizing: false,
      size: 40,
      minSize: 40,
      maxSize: 40,
    },
    // 稼働状況
    {
      id: "status",
      header: "稼働",
      cell: ({ row }) => {
        const hasPrompt = !!row.original.prompt
        return (
          <div className="flex items-center justify-center">
            {hasPrompt ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-xs">
                稼働中
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                未稼働
              </Badge>
            )}
          </div>
        )
      },
      enableSorting: false,
      size: 80,
      minSize: 80,
    },
    // サービス名
    {
      id: "name",
      accessorKey: "name",
      header: "サービス名",
      cell: ({ row }) => (
        <div className="font-medium px-2 truncate">
          {row.original.name}
        </div>
      ),
      enableSorting: true,
      size: 320,
      minSize: 160,
    },
    // メディア
    {
      id: "media",
      header: "メディア",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1 px-2 overflow-hidden">
          {row.original.credentials.length > 0 ? (
            row.original.credentials.map((cred) => (
              <Badge key={cred.id} variant="secondary" className="text-xs truncate">
                {cred.media.name}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </div>
      ),
      enableSorting: false,
      size: 160,
      minSize: 160,
    },
    // ログインURL
    {
      id: "loginUrl",
      accessorKey: "login_url",
      header: "ログインURL",
      cell: ({ row }) => (
        <EditableUrlCell
          value={row.original.login_url}
          onSave={async (newUrl) => {
            if (onUrlUpdate) {
              await onUrlUpdate(row.original.id, newUrl)
            }
          }}
        />
      ),
      enableSorting: false,
      size: 160,
      minSize: 160,
    },
    // ログインID（選択中のメディアの認証情報を表示）
    {
      id: "username",
      header: "ログインID",
      cell: ({ row }) => {
        // 選択中のメディアに一致する認証情報を取得
        const targetCred = selectedMediaId
          ? row.original.credentials.find(c => c.media_id === selectedMediaId)
          : row.original.credentials[0]

        return (
          <div className="px-2 truncate">
            <PasswordCell value={targetCred?.username_secret_key ?? null} />
          </div>
        )
      },
      enableSorting: false,
      size: 160,
      minSize: 160,
    },
    // パスワード（選択中のメディアの認証情報を表示）
    {
      id: "password",
      header: "パスワード",
      cell: ({ row }) => {
        // 選択中のメディアに一致する認証情報を取得
        const targetCred = selectedMediaId
          ? row.original.credentials.find(c => c.media_id === selectedMediaId)
          : row.original.credentials[0]

        return (
          <div className="px-2 truncate">
            <PasswordCell value={targetCred?.password_secret_key ?? null} />
          </div>
        )
      },
      enableSorting: false,
      size: 160,
      minSize: 160,
    },
    // プロンプト
    {
      id: "prompt",
      accessorKey: "prompt",
      header: "プロンプト",
      cell: ({ row }) => (
        <div className="px-2 truncate">
          {row.original.prompt ? (
            <span className="text-muted-foreground truncate">
              {row.original.prompt}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      enableSorting: false,
      size: 160,
      minSize: 160,
    },
  ]
}
