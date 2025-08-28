import { Program, MediaBudget } from '../types';
import { salesBudgetItems } from './budgetMockData';

export const CATEGORIES = ['健康食品', '金融', '美容', 'エンタメ', '教育'];
export const ASP_NAMES = ['A8.net', 'ValueCommerce', 'afb', 'ACCESSTRADE', 'LinkShare'];
export const MEDIA_NAMES = ['ビギナーズ', '最安修理', 'Mortorz'];

export const mockPrograms: Program[] = [
  { id: 1, aspName: 'A8.net', programName: 'スーパー青汁', category: '健康食品', status: '有効' },
  { id: 2, aspName: 'ValueCommerce', programName: 'ABCカード', category: '金融', status: '有効' },
  { id: 3, aspName: 'afb', programName: 'キラキラコスメ', category: '美容', status: '無効' },
  { id: 4, aspName: 'ACCESSTRADE', programName: 'オンラインゲームX', category: 'エンタメ', status: '有効' },
  { id: 5, aspName: 'A8.net', programName: 'プログラミングスクール', category: '教育', status: '有効' },
  { id: 6, aspName: 'afb', programName: '健康サプリメントZ', category: '健康食品', status: '有効' },
    { id: 7, aspName: 'ValueCommerce', programName: 'ビューティーセラム', category: '美容', status: '有効' },
];

export const mockDetailedMediaBudgets: MediaBudget[] = MEDIA_NAMES.map((mediaName, i) => {
    const salesBudgets: Record<string, number> = {};
    salesBudgetItems.forEach((item, j) => {
        const budget = Math.round(((200000 - i * 10000) * (1 / (j + 2))) * (0.8 + Math.random() * 0.4) / 1000) * 1000;
        salesBudgets[item.id] = budget > 10000 ? budget : 10000;
    });
    return { mediaName, salesBudgets };
});


// Helper function to generate dynamic sales data for demonstration
export const generateSalesData = (date: Date, granularity: string) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const totalMediaBudget = mockDetailedMediaBudgets.reduce((sum, media) => {
        return sum + Object.values(media.salesBudgets).reduce((s, b) => s + b, 0);
    }, 0);

    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const totalSales = (totalMediaBudget / daysInMonth) * (0.8 + Math.random() * 0.4) * (1 + Math.sin(i / 5));

        const mediaSalesBreakdown = MEDIA_NAMES.reduce((acc, mediaName) => {
            const mediaBudgetInfo = mockDetailedMediaBudgets.find(b => b.mediaName === mediaName);
            const mediaTotalBudget = mediaBudgetInfo ? Object.values(mediaBudgetInfo.salesBudgets).reduce((s, b) => s + b, 0) : 1;
            const mediaSales = totalSales * (mediaTotalBudget / totalMediaBudget) * (0.7 + Math.random() * 0.6);

            const categoryBreakdown = CATEGORIES.reduce((catAcc, cat) => {
                // Simple equal distribution for categories as there's no category budget anymore
                catAcc[cat] = Math.round(mediaSales / CATEGORIES.length * (0.7 + Math.random() * 0.6));
                return catAcc;
            }, {} as Record<string, number>);

            // The ASP breakdown logic is now less connected to budget, so we simulate it
            const aspBreakdown = ASP_NAMES.reduce((aspAcc, asp, j) => {
                const sales = mediaSales * (1 / (j + 2)) * (0.7 + Math.random() * 0.6);
                const cost = sales * (0.6 + Math.random() * 0.2);
                aspAcc[asp] = {
                    sales: Math.round(sales),
                    cost: Math.round(cost),
                    profit: Math.round(sales - cost),
                };
                return aspAcc;
            }, {} as Record<string, {sales: number, cost: number, profit: number}>);

            acc[mediaName] = {
                sales: Math.round(mediaSales),
                byCategory: categoryBreakdown,
                byAsp: aspBreakdown
            };
            return acc;
        }, {} as Record<string, {sales: number, byCategory: Record<string, number>, byAsp: Record<string, any>}>);
        
        const totalByCategory = CATEGORIES.reduce((acc, cat) => {
            acc[cat] = MEDIA_NAMES.reduce((sum, media) => sum + (mediaSalesBreakdown[media]?.byCategory[cat] || 0), 0);
            return acc;
        }, {} as Record<string, number>);
        
        const totalByAsp = ASP_NAMES.reduce((acc, asp) => {
            const sales = MEDIA_NAMES.reduce((sum, media) => sum + (mediaSalesBreakdown[media]?.byAsp[asp]?.sales || 0), 0);
            const cost = MEDIA_NAMES.reduce((sum, media) => sum + (mediaSalesBreakdown[media]?.byAsp[asp]?.cost || 0), 0);
            acc[asp] = { sales, cost, profit: sales - cost };
            return acc;
        }, {} as Record<string, {sales: number, cost: number, profit: number}>);


        return {
            date: new Date(year, month, day),
            sales: Math.round(totalSales),
            byCategory: totalByCategory,
            byAsp: totalByAsp,
            byMedia: mediaSalesBreakdown,
        };
    });
    return dailyData;
};