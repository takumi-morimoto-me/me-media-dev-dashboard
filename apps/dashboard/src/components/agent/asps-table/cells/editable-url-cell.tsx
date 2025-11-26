"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Check, Edit2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface EditableUrlCellProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | null
  onSave: (newValue: string) => Promise<void>
}

export function EditableUrlCell({
  value,
  onSave,
  className,
  ...props
}: EditableUrlCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [currentValue, setCurrentValue] = useState(value || "")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(false)
    setCurrentValue(value || "") // 元のURLに戻す
  }

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentValue === (value || "")) {
      // 変更がない場合は保存せずに編集モードを終了
      setIsEditing(false)
      return
    }
    
    // URLのバリデーション
    try {
      new URL(currentValue)
    } catch (error) {
      toast.error("有効なURLを入力してください。")
      return
    }

    try {
      await onSave(currentValue)
      setIsEditing(false)
    } catch (error) {
      // onSave内でtoastが表示される想定だが、念のため
      toast.error("URLの更新に失敗しました。")
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
        onClick={(e) => e.stopPropagation()} // 親要素へのイベント伝播を停止
      >
        <Input
          ref={inputRef}
          value={currentValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="h-7 flex-grow"
          type="url"
          placeholder="URLを入力"
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
      {value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ) : (
        <span className="text-muted-foreground">-</span>
      )}
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