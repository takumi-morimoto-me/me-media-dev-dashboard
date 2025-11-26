"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Table, Bot, Settings } from "lucide-react"

// Icon mapping
const iconMap = {
  LayoutDashboard,
  Table,
  Bot,
  Settings,
} as const;

// Define types for props
interface NavLink {
  title: string;
  url: string;
  icon: keyof typeof iconMap;
}

interface AppSidebarClientProps {
  workspaceData: { shortName: string; name: string };
  navigationData: readonly NavLink[];
}

export function AppSidebarClient({ workspaceData, navigationData }: AppSidebarClientProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div
      className={cn(
        "h-screen bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out fixed left-0 top-0 z-50",
        isExpanded ? "w-64" : "w-12"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Workspace Logo */}
      <div className="h-12 flex items-center border-b border-border px-3">
        <div className="w-6 h-6 bg-primary rounded flex items-center justify-center flex-shrink-0">
          <span className="text-primary-foreground text-xs font-bold">{workspaceData.shortName}</span>
        </div>
        {isExpanded && (
          <span className="ml-3 font-medium text-xs truncate transition-opacity duration-200">
            {workspaceData.name}
          </span>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navigationData.map(({ icon, title, url }) => {
          const Icon = iconMap[icon];
          return (
            <Button
              key={title}
              variant="ghost"
              className={cn(
                "w-full h-10 rounded-lg transition-all duration-200",
                isExpanded ? "justify-start px-3" : "justify-center px-0",
                pathname === url ? "bg-accent text-accent-foreground" : ""
              )}
              onClick={() => router.push(url)}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {isExpanded && (
                <span className="ml-3 text-xs truncate transition-opacity duration-200">
                  {title}
                </span>
              )}
            </Button>
          );
        })}
      </nav>
    </div>
  )
}