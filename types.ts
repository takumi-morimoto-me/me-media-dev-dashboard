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
}

export interface PerformanceByCategory {
  categoryName: string;
  sales: number;
}

export interface PerformanceByAsp {
  aspName: string;
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