import { AppSidebar } from "@/components/layout/sidebar/app-sidebar"
import { MediaList } from "@/components/layout/media-list/media-list"
import { UserMenu } from "@/components/layout/header/user-menu"
import { ThemeToggle } from "@/components/layout/header/theme-toggle"
import { mockUser } from "@/lib/mock-data/users"
import { createClient } from "@/lib/supabase/server"
import { DynamicBreadcrumb } from "@/components/layout/header/dynamic-breadcrumb"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: mediaData } = await supabase
    .from("media")
    .select("id, name")

  return (
    <div className="h-screen flex bg-background relative">
      {/* 1st Column: Global Sidebar - Absolute positioned */}
      <AppSidebar />

      {/* 2nd Column: Media List - Add left margin for sidebar */}
      <div className="ml-12 flex-shrink-0">
        <MediaList />
      </div>

      {/* 3rd Column: Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-background sticky top-0 flex shrink-0 items-center gap-4 border-b px-6 h-12">
          <DynamicBreadcrumb mediaData={mediaData || []} />

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
  )
}
