"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FinancialsTable from "@/components/financials/financials-table";
import AspFinancialsTable from "@/components/financials/asp-financials-table";
import AccountItemsImport from "@/components/financials/account-items-import";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Types
interface MonthlyData {
  item_year: number;
  item_month: number;
  account_item_id: string;
  budget: number;
  actual: number;
}

interface DailyData {
  item_date: string;
  account_item_id: string;
  budget: number;
  actual: number;
}

interface AspMonthlyData {
  item_year: number;
  item_month: number;
  asp_id: string;
  asp_name: string;
  actual: number;
}

interface AspDailyData {
  item_date: string;
  asp_id: string;
  asp_name: string;
  actual: number;
}

interface AccountItem {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
  media_id?: string;
  media?: { name: string } | { name: string }[] | null;
}

interface ClientAccountItem extends AccountItem {
  children: ClientAccountItem[];
}

interface FinancialsClientProps {
  monthlyData: MonthlyData[];
  dailyData: DailyData[];
  aspMonthlyData: AspMonthlyData[];
  aspDailyData: AspDailyData[];
  accountItems: AccountItem[];
  fiscalYearStartMonth: number;
}

type DisplayUnit = 'monthly' | 'weekly' | 'daily';
type ViewMode = 'all' | 'budget' | 'actual';

// --- Date Helpers ---
const getWeek = (d: Date) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
};

const getStartOfWeek = (year: number, week: number) => {
  const d = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  d.setUTCDate(d.getUTCDate() + 1 - d.getUTCDay());
  return d;
};

const getEndOfWeek = (year: number, week: number) => {
  const startOfWeek = getStartOfWeek(year, week);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
  return endOfWeek;
};

export default function FinancialsClient({ monthlyData, dailyData, aspMonthlyData, aspDailyData, accountItems, fiscalYearStartMonth }: FinancialsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>('monthly');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const mediaId = searchParams.get('media') || 'all';
  const currentYear = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<ViewMode>('actual');

  const currentYearNum = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYearNum - 5 + i);

  const handleApplyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', selectedYear.toString());
    router.push(`?${params.toString()}`);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    setSelectedYear(currentYearNum);
    setViewMode('all');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('year');
    router.push(`?${params.toString()}`);
  };

  const handleImportComplete = () => router.refresh();

  const tableData = useMemo(() => {
    const hierarchy = accountItems.reduce((acc, item) => {
      acc[item.id] = { ...item, children: [] };
      return acc;
    }, {} as { [id: string]: ClientAccountItem });

    const rootItems: ClientAccountItem[] = [];
    Object.values(hierarchy).forEach(item => {
      if (item.parent_id && hierarchy[item.parent_id]) {
        hierarchy[item.parent_id].children.push(item);
      } else {
        rootItems.push(item);
      }
    });
    rootItems.forEach(r => r.children.sort((a, b) => a.display_order - b.display_order));
    rootItems.sort((a, b) => a.display_order - b.display_order);

    // Helper to get media name from either object or array
    const getMediaName = (media: AccountItem['media']): string => {
      if (!media) return '不明';
      if (Array.isArray(media)) return media[0]?.name || '不明';
      return media.name || '不明';
    };

    // When viewing all media, group by media
    let finalRootItems: ClientAccountItem[] = rootItems;
    if (mediaId === 'all') {
      // Group root items by media
      const mediaGroups = new Map<string, { name: string; items: ClientAccountItem[] }>();
      rootItems.forEach(item => {
        const mediaName = getMediaName(item.media);
        const mediaKey = item.media_id || 'unknown';
        if (!mediaGroups.has(mediaKey)) {
          mediaGroups.set(mediaKey, { name: mediaName, items: [] });
        }
        mediaGroups.get(mediaKey)!.items.push(item);
      });

      // Create virtual media group items
      finalRootItems = Array.from(mediaGroups.entries()).map(([key, group]) => ({
        id: `media-group-${key}`,
        name: group.name,
        parent_id: null,
        display_order: 0,
        media_id: key,
        children: group.items.map(item => ({ ...item, parent_id: `media-group-${key}` })),
      }));
      finalRootItems.sort((a, b) => a.name.localeCompare(b.name));
    }

    const dataByItemId = dailyData.reduce((acc, day) => {
      if (!acc[day.account_item_id]) acc[day.account_item_id] = [];
      acc[day.account_item_id].push(day);
      return acc;
    }, {} as { [id: string]: DailyData[] });

    const headers: { key: string; label: string }[] = [];
    const aggregatedData: { [itemId: string]: { [headerKey: string]: { budget: number; actual: number } } } = {};

    const processItem = (item: ClientAccountItem) => {
      const childrenData = item.children?.flatMap(c => dataByItemId[c.id] || []) || [];
      const selfData = dataByItemId[item.id] || [];
      return [...selfData, ...childrenData];
    };
    
    const fiscalStartDate = new Date(selectedYear, fiscalYearStartMonth - 1, 1);
    const fiscalEndDate = new Date(selectedYear + 1, fiscalYearStartMonth - 1, 0);

    if (displayUnit === 'monthly') {
      // Generate 12 months for the selected fiscal year
      for (let i = 0; i < 12; i++) {
        let month = fiscalYearStartMonth + i;
        let year = selectedYear;
        if (month > 12) {
          month -= 12;
          year += 1;
        }
        const yearPrefix = String(year).slice(-2);
        headers.push({
          key: `m-${year}-${month}`,
          label: `${yearPrefix}/${month}月`,
        });
      }

      // Group monthly data by account item
      const monthlyByItemId = monthlyData.reduce((acc, data) => {
        if (!acc[data.account_item_id]) acc[data.account_item_id] = [];
        acc[data.account_item_id].push(data);
        return acc;
      }, {} as { [id: string]: MonthlyData[] });

      Object.values(hierarchy).forEach(item => {
        aggregatedData[item.id] = {};
        const childrenData = item.children?.flatMap(c => monthlyByItemId[c.id] || []) || [];
        const selfData = monthlyByItemId[item.id] || [];
        const relevantData = [...selfData, ...childrenData];

        headers.forEach(h => {
          const [, yearStr, monthStr] = h.key.split('-');
          const year = parseInt(yearStr);
          const month = parseInt(monthStr);
          const monthData = relevantData.filter(d => d.item_month === month && d.item_year === year);
          aggregatedData[item.id][h.key] = {
            budget: monthData.reduce((sum, d) => sum + d.budget, 0),
            actual: monthData.reduce((sum, d) => sum + d.actual, 0),
          };
        });
      });
    } else if (displayUnit === 'weekly') {
      const weekMap = new Map<string, { year: number, week: number, start: Date, end: Date }>();
      const weekLoopDate = new Date(fiscalStartDate);
      while (weekLoopDate <= fiscalEndDate) {
        const { year, week } = getWeek(weekLoopDate);
        const key = `w-${year}-${week}`;
        if (!weekMap.has(key)) {
          const startOfWeek = getStartOfWeek(year, week);
          const endOfWeek = getEndOfWeek(year, week);
          weekMap.set(key, { year, week, start: startOfWeek, end: endOfWeek });
        }
        weekLoopDate.setDate(weekLoopDate.getDate() + 1);
      }
      Array.from(weekMap.values()).sort((a,b) => a.year - b.year || a.week - b.week).forEach(({ year, week, start, end }) => {
        headers.push({ key: `w-${year}-${week}`, label: `${start.getMonth()+1}/${start.getDate()}-${end.getMonth()+1}/${end.getDate()}` });
      });

      Object.values(hierarchy).forEach(item => {
        aggregatedData[item.id] = {};
        const relevantData = processItem(item);
        headers.forEach(h => {
          const [, year, week] = h.key.split('-').map(Number);
          const startOfWeek = getStartOfWeek(year, week);
          const endOfWeek = getEndOfWeek(year, week);
          const weekData = relevantData.filter(d => {
            const itemDate = new Date(d.item_date);
            return itemDate >= startOfWeek && itemDate <= endOfWeek;
          });
          aggregatedData[item.id][h.key] = {
            budget: weekData.reduce((sum, d) => sum + d.budget, 0),
            actual: weekData.reduce((sum, d) => sum + d.actual, 0),
          };
        });
      });
    } else if (displayUnit === 'daily') {
      const currentDate = new Date(fiscalStartDate);
      while (currentDate <= fiscalEndDate) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        headers.push({ key: `d-${dateKey}`, label: `${currentDate.getMonth()+1}/${currentDate.getDate()}` });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      Object.values(hierarchy).forEach(item => {
        aggregatedData[item.id] = {};
        const relevantData = processItem(item);
        headers.forEach(h => {
          const dateKey = h.key.substring(2);
          const dayData = relevantData.filter(d => d.item_date === dateKey);
          aggregatedData[item.id][h.key] = {
            budget: dayData.reduce((sum, d) => sum + d.budget, 0),
            actual: dayData.reduce((sum, d) => sum + d.actual, 0),
          };
        });
      });
    }

    // If viewing all media, aggregate data for media group items
    if (mediaId === 'all') {
      finalRootItems.forEach(mediaGroup => {
        aggregatedData[mediaGroup.id] = {};
        headers.forEach(h => {
          let totalBudget = 0;
          let totalActual = 0;
          // Only sum immediate children (root items like 売上, 費用)
          // These already include their children's values, so no recursive traversal needed
          mediaGroup.children.forEach(item => {
            const itemData = aggregatedData[item.id]?.[h.key];
            if (itemData) {
              totalBudget += itemData.budget;
              totalActual += itemData.actual;
            }
          });
          aggregatedData[mediaGroup.id][h.key] = { budget: totalBudget, actual: totalActual };
        });
      });
    }

    return { headers, rows: finalRootItems, data: aggregatedData };

  }, [monthlyData, dailyData, accountItems, displayUnit, fiscalYearStartMonth, selectedYear, mediaId]);

  const aspTableData = useMemo(() => {
    // Extract unique ASPs (excluding "日次" suffix ASPs)
    const aspMap = new Map<string, { asp_id: string; asp_name: string }>();
    [...aspMonthlyData, ...aspDailyData].forEach(item => {
      // Skip ASPs with "日次" in their name (these are duplicates)
      if (item.asp_name.includes('日次')) return;
      if (!aspMap.has(item.asp_id)) {
        aspMap.set(item.asp_id, { asp_id: item.asp_id, asp_name: item.asp_name });
      }
    });
    const rows = Array.from(aspMap.values()).sort((a, b) => a.asp_name.localeCompare(b.asp_name));

    const headers: { key: string; label: string }[] = [];
    const aggregatedData: { [aspId: string]: { [headerKey: string]: number } } = {};

    const fiscalStartDate = new Date(selectedYear, fiscalYearStartMonth - 1, 1);
    const fiscalEndDate = new Date(selectedYear + 1, fiscalYearStartMonth - 1, 0);

    if (displayUnit === 'monthly') {
      // Generate 12 months for the selected fiscal year
      for (let i = 0; i < 12; i++) {
        let month = fiscalYearStartMonth + i;
        let year = selectedYear;
        if (month > 12) {
          month -= 12;
          year += 1;
        }
        const yearPrefix = String(year).slice(-2);
        headers.push({
          key: `m-${year}-${month}`,
          label: `${yearPrefix}/${month}月`,
        });
      }

      rows.forEach(asp => {
        aggregatedData[asp.asp_id] = {};
        headers.forEach(h => {
          const [, yearStr, monthStr] = h.key.split('-');
          const year = parseInt(yearStr);
          const month = parseInt(monthStr);
          const monthData = aspMonthlyData.filter(d => d.asp_id === asp.asp_id && d.item_month === month && d.item_year === year);
          aggregatedData[asp.asp_id][h.key] = monthData.reduce((sum, d) => sum + d.actual, 0);
        });
      });
    } else if (displayUnit === 'weekly') {
      const weekMap = new Map<string, { year: number, week: number, start: Date, end: Date }>();
      const weekLoopDate = new Date(fiscalStartDate);
      while (weekLoopDate <= fiscalEndDate) {
        const { year, week } = getWeek(weekLoopDate);
        const key = `w-${year}-${week}`;
        if (!weekMap.has(key)) {
          const startOfWeek = getStartOfWeek(year, week);
          const endOfWeek = getEndOfWeek(year, week);
          weekMap.set(key, { year, week, start: startOfWeek, end: endOfWeek });
        }
        weekLoopDate.setDate(weekLoopDate.getDate() + 1);
      }
      Array.from(weekMap.values()).sort((a,b) => a.year - b.year || a.week - b.week).forEach(({ year, week, start, end }) => {
        headers.push({ key: `w-${year}-${week}`, label: `${start.getMonth()+1}/${start.getDate()}-${end.getMonth()+1}/${end.getDate()}` });
      });

      rows.forEach(asp => {
        aggregatedData[asp.asp_id] = {};
        headers.forEach(h => {
          const [, year, week] = h.key.split('-').map(Number);
          const startOfWeek = getStartOfWeek(year, week);
          const endOfWeek = getEndOfWeek(year, week);
          const weekData = aspDailyData.filter(d => {
            if (d.asp_id !== asp.asp_id) return false;
            const itemDate = new Date(d.item_date);
            return itemDate >= startOfWeek && itemDate <= endOfWeek;
          });
          aggregatedData[asp.asp_id][h.key] = weekData.reduce((sum, d) => sum + d.actual, 0);
        });
      });
    } else if (displayUnit === 'daily') {
      const currentDate = new Date(fiscalStartDate);
      while (currentDate <= fiscalEndDate) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        headers.push({ key: `d-${dateKey}`, label: `${currentDate.getMonth()+1}/${currentDate.getDate()}` });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      rows.forEach(asp => {
        aggregatedData[asp.asp_id] = {};
        headers.forEach(h => {
          const dateKey = h.key.substring(2);
          const dayData = aspDailyData.filter(d => d.asp_id === asp.asp_id && d.item_date === dateKey);
          aggregatedData[asp.asp_id][h.key] = dayData.reduce((sum, d) => sum + d.actual, 0);
        });
      });
    }

    return { headers, rows, data: aggregatedData };
  }, [aspMonthlyData, aspDailyData, displayUnit, fiscalYearStartMonth, selectedYear]);



  const activeFiltersCount = (selectedYear !== currentYearNum ? 1 : 0) + (viewMode !== 'all' ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <AccountItemsImport
          mediaId={mediaId}
          onImportComplete={handleImportComplete}
          dataToExport={[]}
          selectedYear={selectedYear}
          fiscalYearStartMonth={fiscalYearStartMonth}
        />

        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <Filter className="h-4 w-4" />
              Filter
              {activeFiltersCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">フィルター</h4>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-auto p-1 text-xs"
                  >
                    リセット
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">会計年度</Label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}年度
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">表示項目</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="view-all"
                      checked={viewMode === 'all'}
                      onCheckedChange={() => setViewMode('all')}
                    />
                    <label
                      htmlFor="view-all"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      予実比較
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="view-budget"
                      checked={viewMode === 'budget'}
                      onCheckedChange={() => setViewMode('budget')}
                    />
                    <label
                      htmlFor="view-budget"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      予算のみ
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="view-actual"
                      checked={viewMode === 'actual'}
                      onCheckedChange={() => setViewMode('actual')}
                    />
                    <label
                      htmlFor="view-actual"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      実績のみ
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsFilterOpen(false)}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={handleApplyFilters}>
                  適用
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2">
            {selectedYear !== currentYearNum && (
              <div className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs">
                <span>会計年度: {selectedYear}年度</span>
                <button
                  onClick={() => {
                    setSelectedYear(currentYearNum);
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('year');
                    router.push(`?${params.toString()}`);
                  }}
                  className="ml-1 hover:bg-secondary-foreground/10 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {viewMode !== 'all' && (
              <div className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs">
                <span>
                  {viewMode === 'budget' ? '予算のみ' : '実績のみ'}
                </span>
                <button
                  onClick={() => setViewMode('all')}
                  className="ml-1 hover:bg-secondary-foreground/10 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
        
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={displayUnit}
          onValueChange={(value: DisplayUnit) => value && setDisplayUnit(value)}
        >
          <ToggleGroupItem value="monthly">月次</ToggleGroupItem>
          <ToggleGroupItem value="weekly">週次</ToggleGroupItem>
          <ToggleGroupItem value="daily">日次</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div ref={tableContainerRef}>
        <FinancialsTable
          headers={tableData.headers}
          rows={tableData.rows}
          data={tableData.data}
          viewMode={viewMode}
          onDataChange={handleImportComplete}
          mediaId={mediaId}
          displayUnit={displayUnit}
        />
      </div>

      {aspTableData.rows.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">ASP別売上</h3>
          <AspFinancialsTable
            headers={aspTableData.headers}
            rows={aspTableData.rows}
            data={aspTableData.data}
          />
        </div>
      )}
    </div>
  );
}