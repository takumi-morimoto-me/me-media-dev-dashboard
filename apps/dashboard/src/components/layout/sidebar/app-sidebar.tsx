import { AppSidebarClient } from "./app-sidebar-client";
import { navigationData, workspaceData } from "@/lib/mock-data/navigation";

export function AppSidebar() {
  // Data fetching is no longer needed here.
  return (
    <AppSidebarClient
      workspaceData={workspaceData}
      navigationData={navigationData}
    />
  );
}
