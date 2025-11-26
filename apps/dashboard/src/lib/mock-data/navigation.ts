export const navigationData = [
  {
    title: "ダッシュボード",
    url: "/dashboard",
    icon: "LayoutDashboard",
  },
  {
    title: "テーブルビュー",
    url: "/dashboard/financials",
    icon: "Table",
  },
  {
    title: "エージェント",
    url: "/dashboard/agent",
    icon: "Bot",
  },
  {
    title: "設定",
    url: "/dashboard/settings",
    icon: "Settings",
  },
] as const;

export const workspaceData = {
  name: "メディア事業部",
  shortName: "M",
};