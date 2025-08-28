import { BudgetItem, DailyBudgetData } from '../types';
import { initialBudgetItems } from './budgetMockData';

const resultDatabase: Record<string, DailyBudgetData> = {};

const generateMockResultDataForMonth = (year: number, month: number): DailyBudgetData => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const data: DailyBudgetData = {};
    initialBudgetItems.forEach(item => {
        if (item.isEditable) {
            data[item.id] = {};
            for (let day = 1; day <= daysInMonth; day++) {
                let baseValue = 9500; // Slightly different from budget
                if (item.id.includes('pv')) baseValue = 48000;
                if (item.id.includes('cost')) baseValue = 5200;
                data[item.id][day] = Math.round((baseValue * (0.7 + Math.random() * 0.5) * (1 + Math.sin(day / 3.5))) / 1000) * 1000;
            }
        }
    });
    return data;
}

export const getResultsData = async (mediaName: string, year: number, month: number): Promise<DailyBudgetData> => {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
    const key = `${mediaName}-${year}-${month}-results`;
    if (!resultDatabase[key]) {
        resultDatabase[key] = generateMockResultDataForMonth(year, month);
    }
    return JSON.parse(JSON.stringify(resultDatabase[key]));
};

export const saveResultsData = async (
    mediaName: string,
    year: number,
    month: number,
    itemId: string,
    day: number,
    value: number
): Promise<{ success: boolean }> => {
    console.log(`Saving Result: ${mediaName}, ${year}-${month}-${day}, ${itemId} = ${value}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));

    if (Math.random() < 0.1) { // 10% chance of failure
        console.error('Simulated result save failure!');
        return { success: false };
    }
    
    const key = `${mediaName}-${year}-${month}-results`;
    if (!resultDatabase[key]) {
         resultDatabase[key] = generateMockResultDataForMonth(year, month);
    }
    if (!resultDatabase[key][itemId]) {
        resultDatabase[key][itemId] = {};
    }
    resultDatabase[key][itemId][day] = value;
    
    return { success: true };
};
