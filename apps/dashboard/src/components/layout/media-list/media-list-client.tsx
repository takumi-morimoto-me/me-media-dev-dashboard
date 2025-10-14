"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Building2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Media {
  id: string;
  name: string;
  slug: string;
}

interface MediaListClientProps {
  mediaData: Media[];
}

export function MediaListClient({ mediaData }: MediaListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedMedia = searchParams.get('media') || 'all'

  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [mediaName, setMediaName] = React.useState('')
  const [mediaSlug, setMediaSlug] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleMediaSelect = (mediaId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('media', mediaId)
    router.push(`?${params.toString()}`)
  }

  const handleCreateMedia = async () => {
    if (!mediaName.trim() || !mediaSlug.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mediaName, slug: mediaSlug }),
      })

      if (response.ok) {
        setIsDialogOpen(false)
        setMediaName('')
        setMediaSlug('')
        router.refresh() // Refresh to get updated media list
      } else {
        const error = await response.json()
        alert(`エラー: ${error.message}`)
      }
    } catch (error) {
      alert('メディアの作成に失敗しました')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const allMediaOption = {
    id: 'all',
    name: '全てのメディア',
    slug: 'all'
  }

  const mediaOptions = [allMediaOption, ...mediaData]

  return (
    <>
      <div className="h-screen bg-card border-r border-border flex flex-col w-[240px]">
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-sm">メディア</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Media List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {mediaOptions.map((media) => (
              <button
                key={media.id}
                onClick={() => handleMediaSelect(media.id)}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-left transition-colors text-sm flex items-center gap-3",
                  selectedMedia === media.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "hover:bg-accent/50"
                )}
              >
                <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate">{media.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Add Media Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいメディアを追加</DialogTitle>
            <DialogDescription>
              メディア名とスラッグを入力してください
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="media-name">メディア名</Label>
              <Input
                id="media-name"
                placeholder="例: メディアD"
                value={mediaName}
                onChange={(e) => setMediaName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="media-slug">スラッグ</Label>
              <Input
                id="media-slug"
                placeholder="例: media-d"
                value={mediaSlug}
                onChange={(e) => setMediaSlug(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCreateMedia}
              disabled={isSubmitting || !mediaName.trim() || !mediaSlug.trim()}
            >
              {isSubmitting ? '作成中...' : '作成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
