export enum Granularity {
  DAILY = 'デイリー',
  WEEKLY = 'ウィークリー',
  MONTHLY = 'マンスリー',
}

export interface KpiData {
  sales: number;
  budget: number;
  difference: number;
  achievementRate: number;
}

export interface SalesDataPoint {
  name: string;
  売上: number;
  予算?: number;
  累計売上?: number;
  累計予算?: number;
  '前月売上'?: number | null;
  '前月累計売上'?: number;
  '前期売上'?: number | null;
  '前期累計売上'?: number;
}

export interface PerformanceByCategory {
  categoryName: string;
  sales: number;
}

export interface PerformanceByAsp {
  aspName:string;
  sales: number;
  cost: number;
  profit: number;
}

export interface PerformanceByMedia {
    mediaName: string;
    sales: number;
    budget: number;
    achievementRate: number;
    mom?: number;
    yoy?: number;
}

export interface Program {
  id: number;
  aspName: string;
  programName: string;
  category: string;
  status: '有効' | '無効';
  assignedMedia?: string;
}

export interface MediaBudget {
  mediaName: string;
  salesBudgets: Record<string, number>;
}

export interface BudgetItem {
  id: string;
  name:string;
  parentId: string | null;
  isEditable: boolean;
  isHeader?: boolean;
}

export type DailyBudgetData = {
  [itemId: string]: {
    [day: number]: number;
  };
};

export type MonthlyBudgetData = {
  [month: number]: DailyBudgetData;
};

// --- New Types for Settings Page ---
export type Role = '管理者' | '事業部責任者' | '部門責任者';

export interface User {
  id: number;
  email: string;
  role: Role;
  assignedMedia?: string[];
}

export interface BotStatus {
  name: string;
  lastRun: string;
  status: '成功' | '失敗';
}