"use client";

import { usePathname } from "next/navigation";
import { MediaListClient } from "./media-list-client";
import { MediaFilter } from "@/components/agent/media-filter";
import { useAgentContext } from "@/components/layout/dashboard-client-layout";

type Media = {
  id: string;
  name: string;
  slug: string;
};

type Asp = {
  id: string;
  name: string;
  login_url: string | null;
  prompt: string | null;
  created_at: string;
  updated_at: string | null;
  category?: string | null;
};

type AspCredential = {
  id: string;
  asp_id: string;
  media_id: string;
  username_secret_key: string | null;
  password_secret_key: string | null;
  created_at: string;
  updated_at: string | null;
};

interface MediaListWrapperProps {
  mediaData: Media[];
  aspsData: Asp[];
  credentialsData: AspCredential[];
}

function AgentMediaFilter({ mediaData, aspsData, credentialsData }: MediaListWrapperProps) {
  const { selectedMediaId, setSelectedMediaId } = useAgentContext();

  return (
    <MediaFilter
      media={mediaData}
      asps={aspsData}
      credentials={credentialsData}
      selectedMediaId={selectedMediaId}
      onSelectMedia={setSelectedMediaId}
    />
  );
}

export function MediaListWrapper({ mediaData, aspsData, credentialsData }: MediaListWrapperProps) {
  const pathname = usePathname();

  // エージェントページの場合はMediaFilterを表示
  if (pathname === "/dashboard/agent") {
    return <AgentMediaFilter mediaData={mediaData} aspsData={aspsData} credentialsData={credentialsData} />;
  }

  // それ以外のページは通常のMediaListを表示
  return <MediaListClient mediaData={mediaData} />;
}
