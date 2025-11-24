"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PasswordCellProps {
  value: string | null
  className?: string
}

export function PasswordCell({ value, className }: PasswordCellProps) {
  const [isVisible, setIsVisible] = useState(false)

  if (!value) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        -
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      <span className="text-sm font-mono flex-1 truncate">
        {isVisible ? value : "••••••••"}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
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
    </div>
  )
}
