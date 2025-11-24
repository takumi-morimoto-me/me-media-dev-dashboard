"use client"

import { useState } from "react"
import { Eye, EyeOff, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface PasswordCellProps {
  value: string | null
  className?: string
}

export function PasswordCell({ value, className }: PasswordCellProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setIsCopied(true)
      toast.success("コピーしました")

      setTimeout(() => {
        setIsCopied(false)
      }, 2000)
    } catch {
      toast.error("コピーに失敗しました")
    }
  }

  if (!value) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        -
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-1 group", className)}>
      <span className="text-sm font-mono flex-1 truncate">
        {isVisible ? value : "••••••••"}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation()
            setIsVisible(!isVisible)
          }}
        >
          {isVisible ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
        >
          {isCopied ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  )
}
