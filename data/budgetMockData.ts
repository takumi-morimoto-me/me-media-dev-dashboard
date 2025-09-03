import { BudgetItem, DailyBudgetData } from '../types';

export const initialBudgetItems: BudgetItem[] = [
  { id: 'sales', name: '売上高', parentId: null, isEditable: true, isHeader: true },
  { id: 'sales_ad', name: '広告売上', parentId: 'sales', isEditable: true },
  { id: 'sales_subscription', name: 'サブスク売上', parentId: 'sales', isEditable: true },
  { id: 'sales_other', name: 'その他売上', parentId: 'sales', isEditable: true },
  
  { id: 'pv', name: 'PV数', parentId: null, isEditable: true, isHeader: true },
  { id: 'pv_organic', name: '自然検索', parentId: 'pv', isEditable: true },
  { id: 'pv_paid', name: '広告', parentId: 'pv', isEditable: true },
  { id: 'pv_social', name: 'SNS', parentId: 'pv', isEditable: true },

  { id: 'cost', name: '費用', parentId: null, isEditable: true, isHeader: true },
  { id: 'cost_personnel', name: '人件費', parentId: 'cost', isEditable: true },
  { id: 'cost_marketing', name: 'マーケティング費', parentId: 'cost', isEditable: true },
];

export const salesBudgetItems = initialBudgetItems.filter(
  item => item.parentId === 'sales' && item.isEditable
);

const budgetDatabase: Record<string, DailyBudgetData> = {};

const generateMockDataForMonth = (year: number, month: number): DailyBudgetData => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const data: DailyBudgetData = {};
    initialBudgetItems.forEach(item => {
        if (item.isEditable) {
            data[item.id] = {};
            for (let day = 1; day <= daysInMonth; day++) {
                let baseValue = 10000;
                if (item.id.includes('pv')) baseValue = 50000;
                if (item.id.includes('cost')) baseValue = 5000;
                data[item.id][day] = Math.round((baseValue * (0.8 + Math.random() * 0.4) * (1 + Math.sin(day / 4))) / 1000) * 1000;
            }
        }
    });
    return data;
}

export const getBudgetData = async (mediaName: string, year: number, month: number): Promise<DailyBudgetData> => {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
    const key = `${mediaName}-${year}-${month}`;
    if (!budgetDatabase[key]) {
        budgetDatabase[key] = generateMockDataForMonth(year, month);
    }
    return JSON.parse(JSON.stringify(budgetDatabase[key]));
};

export const saveBudgetData = async (
    mediaName: string,
    year: number,
    month: number,
    itemId: string,
    day: number,
    value: number
): Promise<{ success: boolean }> => {
    console.log(`Saving: ${mediaName}, ${year}-${month}-${day}, ${itemId} = ${value}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));

    if (Math.random() < 0.1) { // 10% chance of failure
        console.error('Simulated save failure!');
        return { success: false };
    }
    
    const key = `${mediaName}-${year}-${month}`;
    if (!budgetDatabase[key]) {
         budgetDatabase[key] = generateMockDataForMonth(year, month);
    }
    if (!budgetDatabase[key][itemId]) {
        budgetDatabase[key][itemId] = {};
    }
    budgetDatabase[key][itemId][day] = value;
    
    return { success: true };
};