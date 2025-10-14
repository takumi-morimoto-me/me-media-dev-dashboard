"use client"

import React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { navigationData } from "@/lib/mock-data/navigation"

interface Media {
  id: string
  name: string
}

interface DynamicBreadcrumbProps {
  mediaData: Media[]
}

export function DynamicBreadcrumb({ mediaData }: DynamicBreadcrumbProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mediaId = searchParams.get("media")

  const getMediaName = () => {
    if (!mediaId || mediaId === "all") {
      return "全体"
    }
    return mediaData.find((m) => m.id === mediaId)?.name || "不明なメディア"
  }

  const getPageTitle = (url: string) => {
    const navItem = navigationData.find((item) => item.url === url)
    return navItem?.title || "不明なページ"
  }

  const renderFinancialsBreadcrumb = () => (
    <>
      <BreadcrumbItem>
        <BreadcrumbLink asChild>
          <Link href="/dashboard">ダッシュボード</Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>{getPageTitle(pathname)}</BreadcrumbPage>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>{getMediaName()}</BreadcrumbPage>
      </BreadcrumbItem>
    </>
  )

  const renderDashboardBreadcrumb = () => (
    <>
      <BreadcrumbItem>
        <BreadcrumbLink asChild>
          <Link href="/dashboard">ダッシュボード</Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>全体</BreadcrumbPage>
      </BreadcrumbItem>
    </>
  )

  const renderAgentBreadcrumb = () => (
    <>
      <BreadcrumbItem>
        <BreadcrumbLink asChild>
          <Link href="/dashboard">ダッシュボード</Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>ASP管理</BreadcrumbPage>
      </BreadcrumbItem>
    </>
  )

  const renderDefaultBreadcrumb = () => (
      <BreadcrumbItem>
        <BreadcrumbPage>ダッシュボード</BreadcrumbPage>
      </BreadcrumbItem>
  )


  return (
    <Breadcrumb>
      <BreadcrumbList>
        {pathname === "/dashboard/financials" && renderFinancialsBreadcrumb()}
        {pathname === "/dashboard/agent" && renderAgentBreadcrumb()}
        {pathname === "/dashboard" && renderDashboardBreadcrumb()}
        {pathname !== "/dashboard" && pathname !== "/dashboard/financials" && pathname !== "/dashboard/agent" && renderDefaultBreadcrumb()}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
