"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { AspWithCredentials, RecaptchaStatus, ScrapeStatus } from "./constants"
import { PasswordCell, EditableUrlCell, EditableNameCell } from "./cells"
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// ASP名から（）とその中身を除去するヘルパー関数
const cleanAspName = (name: string): string => {
  return name
    .replace(/[（(][^）)]*[）)]/g, '')  // Remove parentheses and content
    .replace(/\s*=\s*\w+$/g, '')         // Remove " =A8app" suffixes
    .trim()
}

// reCAPTCHAステータスの表示設定
const recaptchaStatusConfig: Record<RecaptchaStatus, { icon: typeof Shield; color: string; label: string }> = {
  not_applicable: { icon: Shield, color: "text-gray-400", label: "reCAPTCHAなし" },
  bypassed: { icon: ShieldCheck, color: "text-green-500", label: "突破成功" },
  unstable: { icon: ShieldAlert, color: "text-yellow-500", label: "不安定" },
  blocked: { icon: ShieldX, color: "text-red-500", label: "ブロック中" },
  unknown: { icon: ShieldQuestion, color: "text-gray-400", label: "未確認" },
}

// スクレイピングステータスの表示設定
const scrapeStatusConfig: Record<ScrapeStatus, { variant: "default" | "secondary" | "destructive"; label: string }> = {
  success: { variant: "default", label: "成功" },
  failed: { variant: "destructive", label: "失敗" },
  partial: { variant: "secondary", label: "一部成功" },
}

export interface GetColumnsOptions {
  selectedMediaId: string | null
  onEdit?: (asp: AspWithCredentials) => void
  onDelete?: (asp: AspWithCredentials) => void
  onUrlUpdate?: (aspId: string, newUrl: string) => Promise<void>
  onNameUpdate?: (aspId: string, newName: string) => Promise<void>
  onActiveToggle?: (aspId: string, isActive: boolean) => Promise<void>
}

export function getColumns(options?: GetColumnsOptions): ColumnDef<AspWithCredentials>[] {
  const { selectedMediaId, onUrlUpdate, onNameUpdate, onActiveToggle } = options || {}

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
        const isActive = row.original.is_active ?? false
        const handleClick = () => {
          if (onActiveToggle) {
            onActiveToggle(row.original.id, !isActive)
          }
        }
        return (
          <div className="flex items-center justify-center">
            <Badge
              variant={isActive ? "default" : "secondary"}
              className={`text-xs cursor-pointer transition-colors ${
                isActive
                  ? "bg-green-600 hover:bg-green-700"
                  : "hover:bg-muted-foreground/20"
              }`}
              onClick={handleClick}
            >
              {isActive ? "稼働中" : "未稼働"}
            </Badge>
          </div>
        )
      },
      enableSorting: false,
      enableResizing: false,
      size: 80,
      minSize: 80,
      maxSize: 80,
    },
    // サービス名
    {
      id: "name",
      accessorKey: "name",
      header: "サービス名",
      cell: ({ row }) => {
        const cleanedName = cleanAspName(row.original.name)

        return (
          <div className="max-w-[320px] overflow-hidden">
            <EditableNameCell
              value={row.original.name}
              displayValue={cleanedName}
              onSave={async (newName) => {
                if (onNameUpdate) {
                  await onNameUpdate(row.original.id, newName)
                }
              }}
            />
          </div>
        )
      },
      enableSorting: true,
      size: 320,
      minSize: 320,
      maxSize: 320,
    },
    // メディア
    {
      id: "media",
      header: "メディア",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1 px-2 overflow-hidden max-w-[160px]">
          {row.original.credentials.length > 0 ? (
            row.original.credentials.map((cred) => (
              <Badge key={cred.id} variant="secondary" className="text-xs truncate max-w-[140px]">
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
      maxSize: 160,
    },
    // ログインURL
    {
      id: "loginUrl",
      accessorKey: "login_url",
      header: "ログインURL",
      cell: ({ row }) => (
        <div className="max-w-[160px] overflow-hidden">
          <EditableUrlCell
            value={row.original.login_url}
            onSave={async (newUrl) => {
              if (onUrlUpdate) {
                await onUrlUpdate(row.original.id, newUrl)
              }
            }}
          />
        </div>
      ),
      enableSorting: false,
      size: 160,
      minSize: 160,
      maxSize: 160,
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
          <div className="px-2 truncate max-w-[160px]">
            <PasswordCell value={targetCred?.username_secret_key ?? null} />
          </div>
        )
      },
      enableSorting: false,
      size: 160,
      minSize: 160,
      maxSize: 160,
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
          <div className="px-2 truncate max-w-[160px]">
            <PasswordCell value={targetCred?.password_secret_key ?? null} />
          </div>
        )
      },
      enableSorting: false,
      size: 160,
      minSize: 160,
      maxSize: 160,
    },
    // reCAPTCHA状況
    {
      id: "recaptcha",
      header: "reCAPTCHA",
      cell: ({ row }) => {
        const status = row.original.recaptcha_status as RecaptchaStatus | null
        const notes = row.original.scrape_notes

        // not_applicable または null の場合は「-」を表示
        if (!status || status === 'not_applicable') {
          return (
            <div className="flex items-center justify-center">
              <span className="text-muted-foreground text-sm">-</span>
            </div>
          )
        }

        const config = recaptchaStatusConfig[status] || recaptchaStatusConfig.unknown
        const Icon = config.icon

        return (
          <div className="flex items-center justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className={`text-xs ${config.color}`}>{config.label}</span>
                </div>
              </TooltipTrigger>
              {notes && (
                <TooltipContent>
                  <p className="max-w-xs">{notes}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )
      },
      enableSorting: false,
      size: 120,
      minSize: 120,
      maxSize: 120,
    },
    // 最終スクレイピング
    {
      id: "lastScrape",
      header: "最終実行",
      cell: ({ row }) => {
        const lastScrapeAt = row.original.last_scrape_at
        const lastScrapeStatus = row.original.last_scrape_status as ScrapeStatus | null

        if (!lastScrapeAt) {
          return (
            <div className="flex items-center justify-center">
              <span className="text-muted-foreground text-sm">-</span>
            </div>
          )
        }

        const date = new Date(lastScrapeAt)
        const formattedDate = date.toLocaleDateString('ja-JP', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

        const statusConfig = lastScrapeStatus ? scrapeStatusConfig[lastScrapeStatus] : null

        return (
          <div className="flex flex-col items-center gap-0.5 px-2">
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
            {statusConfig && (
              <Badge variant={statusConfig.variant} className="text-xs px-1.5 py-0">
                {statusConfig.label}
              </Badge>
            )}
          </div>
        )
      },
      enableSorting: true,
      size: 160,
      minSize: 160,
      maxSize: 160,
    },
  ]
}
