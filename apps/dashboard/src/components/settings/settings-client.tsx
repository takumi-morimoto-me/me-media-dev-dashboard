"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface SettingsClientProps {
  fiscalYearStartMonth: number;
}

const months = [
  { value: 1, label: "1月" },
  { value: 2, label: "2月" },
  { value: 3, label: "3月" },
  { value: 4, label: "4月" },
  { value: 5, label: "5月" },
  { value: 6, label: "6月" },
  { value: 7, label: "7月" },
  { value: 8, label: "8月" },
  { value: 9, label: "9月" },
  { value: 10, label: "10月" },
  { value: 11, label: "11月" },
  { value: 12, label: "12月" },
];

export function SettingsClient({ fiscalYearStartMonth }: SettingsClientProps) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(fiscalYearStartMonth.toString());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/fiscal-year-start-month", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: parseInt(selectedMonth) }),
      });

      if (!response.ok) {
        throw new Error("Failed to save setting");
      }

      toast.success("設定を保存しました");
      router.refresh();
    } catch {
      toast.error("設定の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = parseInt(selectedMonth) !== fiscalYearStartMonth;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">会計設定</h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fiscal-year-start">会計年度開始月</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="fiscal-year-start" className="w-[200px]">
                <SelectValue placeholder="月を選択" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              会計年度が始まる月を設定します。日本企業の多くは4月始まりです。
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
