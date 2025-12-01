"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Check, Edit2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface EditableNameCellProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  displayValue?: string  // Optional: 表示用の値（編集時はvalueを使用）
  onSave: (newValue: string) => Promise<void>
}

export function EditableNameCell({
  value,
  displayValue,
  onSave,
  className,
  ...props
}: EditableNameCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [currentValue, setCurrentValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(false)
    setCurrentValue(value)
  }

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentValue === value) {
      setIsEditing(false)
      return
    }

    if (!currentValue.trim()) {
      toast.error("サービス名を入力してください。")
      return
    }

    try {
      await onSave(currentValue.trim())
      setIsEditing(false)
    } catch {
      toast.error("サービス名の更新に失敗しました。")
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentValue(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveClick(e as unknown as React.MouseEvent)
    } else if (e.key === "Escape") {
      handleCancelClick(e as unknown as React.MouseEvent)
    }
  }

  if (isEditing) {
    return (
      <div
        className={cn(
          "flex w-full items-center space-x-2",
          className
        )}
        {...props}
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          ref={inputRef}
          value={currentValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="h-7 flex-grow"
          type="text"
          placeholder="サービス名を入力"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSaveClick}
          className="h-7 w-7 p-0.5"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancelClick}
          className="h-7 w-7 p-0.5"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group relative flex w-full items-center justify-between overflow-hidden px-2 py-1 text-sm",
        className
      )}
      {...props}
    >
      <span className="truncate font-medium">{displayValue ?? value}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleEditClick}
        className="absolute right-0 top-1/2 h-7 w-7 -translate-y-1/2 transform bg-background opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Edit2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
