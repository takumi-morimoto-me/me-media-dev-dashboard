"use client";

import { usePathname } from "next/navigation";
import { useState, createContext, useContext, ReactNode } from "react";

type Media = {
  id: string;
  name: string;
  slug: string;
};

type Asp = {
  id: string;
  name: string;
  login_url: string | null;
  created_at: string;
  updated_at: string | null;
  category?: string | null;
  // 稼働状況
  is_active: boolean | null;
  // reCAPTCHA関連
  recaptcha_status: string | null;
  last_scrape_at: string | null;
  last_scrape_status: string | null;
  scrape_notes: string | null;
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

interface AgentContextType {
  selectedMediaId: string | null;
  setSelectedMediaId: (id: string | null) => void;
  asps: Asp[];
  media: Media[];
  credentials: AspCredential[];
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function useAgentContext() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgentContext must be used within DashboardClientLayout on agent page");
  }
  return context;
}

interface DashboardClientLayoutProps {
  children: ReactNode;
  mediaData: Media[];
  aspsData: Asp[];
  credentialsData: AspCredential[];
}

export function DashboardClientLayout({ children, mediaData, aspsData, credentialsData }: DashboardClientLayoutProps) {
  const pathname = usePathname();
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);

  // エージェントページの場合はContext Providerでラップ
  if (pathname === "/dashboard/agent") {
    return (
      <AgentContext.Provider
        value={{
          selectedMediaId,
          setSelectedMediaId,
          asps: aspsData,
          media: mediaData,
          credentials: credentialsData,
        }}
      >
        {children}
      </AgentContext.Provider>
    );
  }

  // その他のページはそのまま
  return <>{children}</>;
}
