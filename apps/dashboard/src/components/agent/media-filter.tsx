"use client";

import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type Media = {
  id: string;
  name: string;
};

type Asp = {
  id: string;
};

type AspCredential = {
  id: string;
  asp_id: string;
  media_id: string;
};

interface MediaFilterProps {
  media: Media[];
  asps: Asp[];
  credentials: AspCredential[];
  selectedMediaId: string | null;
  onSelectMedia: (mediaId: string | null) => void;
}

export function MediaFilter({ media, credentials, selectedMediaId, onSelectMedia }: MediaFilterProps) {
  // 各メディアごとのASP数をカウント（credentialsベース）
  const getAspCount = (mediaId: string | null) => {
    if (mediaId === null) {
      // 全てのメディア: ユニークなasp_idの数
      return new Set(credentials.map(c => c.asp_id)).size;
    }
    // 特定メディア: そのメディアに紐づくASPの数
    return credentials.filter(c => c.media_id === mediaId).length;
  };

  const allMediaOption = {
    id: null,
    name: '全てのメディア',
  };

  const mediaOptions = [allMediaOption, ...media.map(m => ({ id: m.id, name: m.name }))];

  return (
    <div className="h-screen bg-card border-r border-border flex flex-col w-[240px]">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
        <h2 className="font-semibold text-sm">メディア</h2>
      </div>

      {/* Media List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {mediaOptions.map((mediaOption) => {
            const count = getAspCount(mediaOption.id);
            return (
              <button
                key={mediaOption.id || 'all'}
                onClick={() => onSelectMedia(mediaOption.id)}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-left transition-colors text-sm flex items-center gap-3",
                  selectedMediaId === mediaOption.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "hover:bg-accent/50"
                )}
              >
                <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{mediaOption.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
