"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, Pencil } from "lucide-react"
import { AspWithCredentials } from "./constants"
import { PasswordCell } from "./cells"

export interface GetColumnsOptions {
  onEdit?: (asp: AspWithCredentials) => void
  onDelete?: (asp: AspWithCredentials) => void
}

export function getColumns(options?: GetColumnsOptions): ColumnDef<AspWithCredentials>[] {
  const { onEdit, onDelete } = options || {}

  return [
    // チェックボックス
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="全て選択"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="行を選択"
          />
        </div>
      ),
      enableSorting: false,
      enableResizing: false,
    },
    // サービス名
    {
      id: "name",
      accessorKey: "name",
      header: "サービス名",
      cell: ({ row }) => (
        <div className="font-medium px-2">
          {row.original.name}
        </div>
      ),
      enableSorting: true,
    },
    // メディア
    {
      id: "media",
      header: "メディア",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1 px-2">
          {row.original.credentials.length > 0 ? (
            row.original.credentials.map((cred) => (
              <Badge key={cred.id} variant="secondary" className="text-xs">
                {cred.media.name}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </div>
      ),
      enableSorting: false,
    },
    // ログインURL
    {
      id: "loginUrl",
      accessorKey: "login_url",
      header: "ログインURL",
      cell: ({ row }) => (
        <div className="px-2 text-sm">
          {row.original.login_url ? (
            <a
              href={row.original.login_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.login_url}
            </a>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      enableSorting: false,
    },
    // ログインID（最初のメディアの認証情報を表示）
    {
      id: "username",
      header: "ログインID",
      cell: ({ row }) => {
        const firstCred = row.original.credentials[0]
        return (
          <div className="px-2">
            <PasswordCell value={firstCred?.username_secret_key} />
          </div>
        )
      },
      enableSorting: false,
    },
    // パスワード（最初のメディアの認証情報を表示）
    {
      id: "password",
      header: "パスワード",
      cell: ({ row }) => {
        const firstCred = row.original.credentials[0]
        return (
          <div className="px-2">
            <PasswordCell value={firstCred?.password_secret_key} />
          </div>
        )
      },
      enableSorting: false,
    },
    // プロンプト
    {
      id: "prompt",
      accessorKey: "prompt",
      header: "プロンプト",
      cell: ({ row }) => (
        <div className="px-2 text-sm">
          {row.original.prompt ? (
            <span className="text-muted-foreground">
              {row.original.prompt}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      enableSorting: false,
    },
  ]
}
