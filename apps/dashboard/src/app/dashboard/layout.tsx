import { AppSidebar } from "@/components/layout/sidebar/app-sidebar"
import { MediaListWrapper } from "@/components/layout/media-list/media-list-wrapper"
import { UserMenu } from "@/components/layout/header/user-menu"
import { ThemeToggle } from "@/components/layout/header/theme-toggle"
import { mockUser } from "@/lib/mock-data/users"
import { createClient } from "@/lib/supabase/server"
import { DynamicBreadcrumb } from "@/components/layout/header/dynamic-breadcrumb"
import { DashboardClientLayout } from "@/components/layout/dashboard-client-layout"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // メディア、ASP、認証情報を並行取得
  const [mediaResult, aspsResult, credentialsResult] = await Promise.all([
    supabase.from("media").select("id, name, slug").order("name"),
    supabase.from("asps").select("*").order("name"),
    supabase.from("asp_credentials").select("*"),
  ])

  // slugがnullの場合は空文字にする
  const mediaData = (mediaResult.data || []).map(m => ({
    ...m,
    slug: m.slug || ""
  }))
  const aspsData = aspsResult.data || []
  const credentialsData = credentialsResult.data || []

  return (
    <DashboardClientLayout mediaData={mediaData} aspsData={aspsData} credentialsData={credentialsData}>
      <div className="h-screen flex bg-background relative" suppressHydrationWarning>
        {/* 1st Column: Global Sidebar - Absolute positioned */}
        <AppSidebar />

        {/* 2nd Column: Media List - Add left margin for sidebar */}
        <div className="ml-12 flex-shrink-0">
          <MediaListWrapper mediaData={mediaData} aspsData={aspsData} credentialsData={credentialsData} />
        </div>

        {/* 3rd Column: Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-background sticky top-0 flex shrink-0 items-center gap-4 border-b px-6 h-12">
            <DynamicBreadcrumb mediaData={mediaData} />

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
