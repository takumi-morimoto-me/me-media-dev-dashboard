export type FinancialSummary = {
  account_item_id: string;
  account_item_name: string;
  parent_id: string | null;
  display_order: number;
  month: number;
  total_budget: number;
  total_actual: number;
};

// Mock data simulating the output of the 'get_financial_summary' RPC function
export const mockFinancialSummary: FinancialSummary[] = [
  // --- 売上 (Sales) ---
  // 親項目
  { account_item_id: 'sales', account_item_name: '売上', parent_id: null, display_order: 1, month: 4, total_budget: 1000000, total_actual: 1100000 },
  { account_item_id: 'sales', account_item_name: '売上', parent_id: null, display_order: 1, month: 5, total_budget: 1050000, total_actual: 1000000 },
  { account_item_id: 'sales', account_item_name: '売上', parent_id: null, display_order: 1, month: 6, total_budget: 1100000, total_actual: 1200000 },
  // 子項目: 広告収入
  { account_item_id: 'ad-revenue', account_item_name: '広告収入', parent_id: 'sales', display_order: 2, month: 4, total_budget: 800000, total_actual: 850000 },
  { account_item_id: 'ad-revenue', account_item_name: '広告収入', parent_id: 'sales', display_order: 2, month: 5, total_budget: 850000, total_actual: 800000 },
  { account_item_id: 'ad-revenue', account_item_name: '広告収入', parent_id: 'sales', display_order: 2, month: 6, total_budget: 900000, total_actual: 950000 },
  // 子項目: アフィリエイト収入
  { account_item_id: 'affiliate-revenue', account_item_name: 'アフィリエイト収入', parent_id: 'sales', display_order: 3, month: 4, total_budget: 200000, total_actual: 250000 },
  { account_item_id: 'affiliate-revenue', account_item_name: 'アフィリエイト収入', parent_id: 'sales', display_order: 3, month: 5, total_budget: 200000, total_actual: 200000 },
  { account_item_id: 'affiliate-revenue', account_item_name: 'アフィリエイト収入', parent_id: 'sales', display_order: 3, month: 6, total_budget: 200000, total_actual: 250000 },

  // --- 費用 (Costs) ---
  // 親項目
  { account_item_id: 'costs', account_item_name: '費用', parent_id: null, display_order: 4, month: 4, total_budget: 500000, total_actual: 550000 },
  { account_item_id: 'costs', account_item_name: '費用', parent_id: null, display_order: 4, month: 5, total_budget: 520000, total_actual: 510000 },
  { account_item_id: 'costs', account_item_name: '費用', parent_id: null, display_order: 4, month: 6, total_budget: 530000, total_actual: 540000 },
  // 子項目: 人件費
  { account_item_id: 'personnel-cost', account_item_name: '人件費', parent_id: 'costs', display_order: 5, month: 4, total_budget: 300000, total_actual: 320000 },
  { account_item_id: 'personnel-cost', account_item_name: '人件費', parent_id: 'costs', display_order: 5, month: 5, total_budget: 300000, total_actual: 310000 },
  { account_item_id: 'personnel-cost', account_item_name: '人件費', parent_id: 'costs', display_order: 5, month: 6, total_budget: 300000, total_actual: 300000 },
  // 子項目: サーバー費用
  { account_item_id: 'server-cost', account_item_name: 'サーバー費用', parent_id: 'costs', display_order: 6, month: 4, total_budget: 200000, total_actual: 230000 },
  { account_item_id: 'server-cost', account_item_name: 'サーバー費用', parent_id: 'costs', display_order: 6, month: 5, total_budget: 220000, total_actual: 200000 },
  { account_item_id: 'server-cost', account_item_name: 'サーバー費用', parent_id: 'costs', display_order: 6, month: 6, total_budget: 230000, total_actual: 240000 },
];
