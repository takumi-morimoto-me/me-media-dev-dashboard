import { Suspense } from "react"
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar"
import { MediaListWrapper } from "@/components/layout/media-list/media-list-wrapper"
import { UserMenu } from "@/components/layout/header/user-menu"
import { ThemeToggle } from "@/components/layout/header/theme-toggle"
import { mockUser } from "@/lib/mock-data/users"
import { createClient } from "@/lib/supabase/server"
import { DynamicBreadcrumb } from "@/components/layout/header/dynamic-breadcrumb"
import { DashboardClientLayout } from "@/components/layout/dashboard-client-layout"

type Media = {
  id: string
  name: string
  slug: string
}

type Asp = {
  id: string
  name: string
  login_url: string | null
  prompt: string | null
  created_at: string
  updated_at: string | null
  // 稼働状況
  is_active: boolean | null
  // reCAPTCHA関連
  has_recaptcha: boolean | null
  recaptcha_status: string | null
  last_scrape_at: string | null
  last_scrape_status: string | null
  scrape_notes: string | null
}

type AspCredential = {
  id: string
  asp_id: string
  media_id: string
  username_secret_key: string | null
  password_secret_key: string | null
  created_at: string
  updated_at: string | null
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 環境変数チェック - ビルド時にも実行時にも必要
  const hasRequiredEnvVars =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY

  let mediaData: Media[] = []
  let aspsData: Asp[] = []
  let credentialsData: AspCredential[] = []

  if (hasRequiredEnvVars) {
    const supabase = await createClient()

    // メディア、ASP、認証情報を並行取得
    const [mediaResult, aspsResult, credentialsResult] = await Promise.all([
      supabase.from("media").select("id, name, slug").order("name"),
      supabase.from("asps").select("*").order("name"),
      supabase.from("asp_credentials").select("*"),
    ])

    // デバッグログ
    console.log("=== Dashboard Layout Data ===")
    console.log("Media count:", mediaResult.data?.length || 0)
    console.log("ASPs count:", aspsResult.data?.length || 0)
    console.log("Credentials count:", credentialsResult.data?.length || 0)
    if (mediaResult.error) {
      console.error("Media error:", JSON.stringify(mediaResult.error, null, 2))
    }
    if (aspsResult.error) {
      console.error("ASPs error:", JSON.stringify(aspsResult.error, null, 2))
    }
    if (credentialsResult.error) {
      console.error("Credentials error:", JSON.stringify(credentialsResult.error, null, 2))
    }
    // 詳細デバッグ: 最初のメディアを表示
    if (mediaResult.data && mediaResult.data.length > 0) {
      console.log("First media:", JSON.stringify(mediaResult.data[0]))
    } else {
      console.log("No media data returned!")
    }

    // slugがnullの場合は空文字にする
    mediaData = (mediaResult.data || []).map(m => ({
      ...m,
      slug: m.slug || ""
    }))
    aspsData = aspsResult.data || []
    credentialsData = credentialsResult.data || []
  } else {
    console.warn("⚠️  Supabase environment variables not set. Using empty data for build.")
    console.warn("Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Project Settings.")
  }

  return (
    <DashboardClientLayout mediaData={mediaData} aspsData={aspsData} credentialsData={credentialsData}>
      <div className="h-screen flex bg-background relative" suppressHydrationWarning>
        {/* 1st Column: Global Sidebar - Absolute positioned */}
        <AppSidebar />

        {/* 2nd Column: Media List - Add left margin for sidebar */}
        <div className="ml-12 flex-shrink-0">
          <Suspense fallback={<div>Loading...</div>}>
            <MediaListWrapper mediaData={mediaData} aspsData={aspsData} credentialsData={credentialsData} />
          </Suspense>
        </div>

        {/* 3rd Column: Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-background sticky top-0 flex shrink-0 items-center gap-4 border-b px-6 h-12">
            <Suspense fallback={<div>Loading...</div>}>
              <DynamicBreadcrumb mediaData={mediaData} />
            </Suspense>

            <div className="flex items-center gap-2 ml-auto">
              <ThemeToggle />
              <UserMenu user={mockUser} />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="pl-6 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardClientLayout>
  )
}
