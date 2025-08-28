import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Granularity, KpiData, SalesDataPoint, PerformanceByCategory, PerformanceByAsp, MediaBudget } from '../types';
import Card from '../components/Card';
import { CalendarIcon } from '../components/icons';
import { generateSalesData, CATEGORIES } from '../data/mockData';
import { salesBudgetItems } from '../data/budgetMockData';

interface MediaDashboardPageProps {
    budgets: MediaBudget[];
    setBudgets: React.Dispatch<React.SetStateAction<MediaBudget[]>>;
}

const KpiSummary: React.FC<{ data: KpiData }> = ({ data }) => {
    const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;
    const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
    const differenceColor = data.difference >= 0 ? 'text-green-500' : 'text-red-500';

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title="売上">
                <p className="text-2xl font-bold">{formatCurrency(data.sales)}</p>
            </Card>
            <Card title="予算">
                <p className="text-2xl font-bold">{formatCurrency(data.budget)}</p>
            </Card>
            <Card title="予実差額">
                <p className={`text-2xl font-bold ${differenceColor}`}>{formatCurrency(data.difference)}</p>
            </Card>
            <Card title="達成率">
                <p className="text-2xl font-bold">{formatPercentage(data.achievementRate)}</p>
            </Card>
        </div>
    );
};

const PerformanceTable: React.FC<{ title: string; headers: string[]; data: any[]; formatters: ((val: any) => React.ReactNode)[] }> = ({ title, headers, data, formatters }) => (
    <Card title={title}>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-white/5">
                    <tr>{headers.map(h => <th key={h} scope="col" className="px-6 py-3">{h}</th>)}</tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr key={index} className="bg-white dark:bg-transparent border-b border-slate-200 dark:border-white/10 hover:bg-slate-50/50 dark:hover:bg-white/5">
                            {Object.values(row).map((val, i) => (
                                <td key={i} className="px-6 py-4 font-medium text-slate-900 dark:text-slate-50 whitespace-nowrap">
                                    {formatters[i](val)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </Card>
);

const MediaBudgetEditor: React.FC<{
  mediaName: string;
  budgets: MediaBudget[];
  setBudgets: React.Dispatch<React.SetStateAction<MediaBudget[]>>;
}> = ({ mediaName, budgets, setBudgets }) => {
  const mediaBudget = useMemo(() => budgets.find(b => b.mediaName === mediaName), [budgets, mediaName]);
  
  const [editableSalesBudgets, setEditableSalesBudgets] = useState<Record<string, number>>({});

  useEffect(() => {
    if (mediaBudget) {
      setEditableSalesBudgets(mediaBudget.salesBudgets);
    }
  }, [mediaBudget]);

  const handleBudgetChange = (itemId: string, amount: string) => {
    const newAmount = parseInt(amount, 10);
    const finalAmount = !isNaN(newAmount) && newAmount >= 0 ? newAmount : 0;
    setEditableSalesBudgets(prev => ({
      ...prev,
      [itemId]: finalAmount
    }));
  };

  const handleSave = () => {
    setBudgets(prevBudgets =>
      prevBudgets.map(b =>
        b.mediaName === mediaName
          ? { ...b, salesBudgets: editableSalesBudgets }
          : b
      )
    );
    alert(`${mediaName}の予算が保存されました。`);
  };

  const totalBudget = useMemo(() => Object.values(editableSalesBudgets || {}).reduce((sum, b) => sum + b, 0), [editableSalesBudgets]);

  if (!mediaBudget) {
    return null;
  }

  return (
    <Card title={`${mediaName} 予算設定`}>
      <div className="space-y-4">
        {salesBudgetItems.map(item => (
          <div key={item.id} className="flex justify-between items-center gap-4">
            <label htmlFor={`budget-${item.id}`} className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">{item.name}</label>
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 dark:text-slate-400">¥</span>
              <input
                type="number"
                id={`budget-${item.id}`}
                value={editableSalesBudgets[item.id] || ''}
                onChange={e => handleBudgetChange(item.id, e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-right pl-7"
                placeholder="0"
                min="0"
                step="1000"
              />
            </div>
          </div>
        ))}
        <div className="border-t border-slate-200 dark:border-white/10 pt-4 mt-4 flex justify-between items-center">
          <span className="font-bold">合計予算</span>
          <span className="font-bold text-primary-600 dark:text-primary-400">¥{totalBudget.toLocaleString()}</span>
        </div>
         <div className="flex justify-end pt-4">
            <button
                onClick={handleSave}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
                このメディアの予算を保存
            </button>
        </div>
      </div>
    </Card>
  );
};

const MediaDashboardPage: React.FC<MediaDashboardPageProps> = ({ budgets, setBudgets }) => {
    const { mediaName } = useParams<{ mediaName: string }>();
    const navigate = useNavigate();

    const [granularity, setGranularity] = useState<Granularity>(Granularity.MONTHLY);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedWeek, setSelectedWeek] = useState(1);
    
    useEffect(() => {
        const availableMediaNames = budgets.map(b => b.mediaName);
        if (!mediaName || !availableMediaNames.includes(mediaName)) {
            navigate('/');
        }
    }, [mediaName, navigate, budgets]);

    const salesData = useMemo(() => generateSalesData(currentDate, 'monthly'), [currentDate]);
    
    const weeks = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const weekRanges = [
            { num: 1, start: 1, end: 7 },
            { num: 2, start: 8, end: 14 },
            { num: 3, start: 15, end: 21 },
            { num: 4, start: 22, end: 28 },
        ];
        if (daysInMonth > 28) {
            weekRanges.push({ num: 5, start: 29, end: daysInMonth });
        }
        return weekRanges
            .filter(w => w.start <= daysInMonth)
            .map(w => ({...w, end: Math.min(w.end, daysInMonth)}));
    }, [currentDate]);

    const { kpiData, graphData, categoryData, aspData } = useMemo(() => {
        if (!mediaName) return { kpiData: {} as KpiData, graphData: [], categoryData: [], aspData: [] };

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const mediaBudgetInfo = budgets.find(b => b.mediaName === mediaName);
        const mediaMonthlyBudget = mediaBudgetInfo ? Object.values(mediaBudgetInfo.salesBudgets).reduce((s, b) => s + b, 0) : 0;

        let kpi: KpiData = { sales: 0, budget: 0, difference: 0, achievementRate: 0 };
        let graph: SalesDataPoint[] = [];

        switch (granularity) {
            case Granularity.DAILY: {
                const day = currentDate.getDate();
                const dayData = salesData.find(d => d.date.getDate() === day);
                if (dayData) {
                    const dailySales = dayData.byMedia[mediaName]?.sales || 0;
                    const dailyBudget = mediaMonthlyBudget / daysInMonth;
                    kpi = {
                        sales: dailySales,
                        budget: dailyBudget,
                        difference: dailySales - dailyBudget,
                        achievementRate: dailyBudget > 0 ? (dailySales / dailyBudget) * 100 : 0
                    };
                    graph = salesData.slice(Math.max(0, day - 7), day).map(d => ({ 
                        name: `${d.date.getMonth() + 1}/${d.date.getDate()}`, 
                        '売上': d.byMedia[mediaName]?.sales || 0,
                        '予算': mediaMonthlyBudget / daysInMonth 
                    }));
                }
                break;
            }
            case Granularity.WEEKLY: {
                const weekInfo = weeks.find(w => w.num === selectedWeek);
                if (weekInfo) {
                    const weekStart = new Date(year, month, weekInfo.start);
                    const weekEnd = new Date(year, month, weekInfo.end);
                    
                    const weekData = salesData.filter(d => d.date >= weekStart && d.date <= weekEnd);
                    const totalSales = weekData.reduce((sum, d) => sum + (d.byMedia[mediaName]?.sales || 0), 0);
                    const numDaysInWeek = weekInfo.end - weekInfo.start + 1;
                    const weeklyBudget = (mediaMonthlyBudget / daysInMonth) * numDaysInWeek;
                    kpi = { sales: totalSales, budget: weeklyBudget, difference: totalSales - weeklyBudget, achievementRate: weeklyBudget > 0 ? (totalSales / weeklyBudget) * 100 : 0 };
                    graph = weekData.map(d => ({ 
                        name: `${d.date.getMonth() + 1}/${d.date.getDate()}`, 
                        '売上': d.byMedia[mediaName]?.sales || 0,
                        '予算': mediaMonthlyBudget / daysInMonth 
                    }));
                }
                break;
            }
            case Granularity.MONTHLY: {
                const totalSales = salesData.reduce((sum, d) => sum + (d.byMedia[mediaName]?.sales || 0), 0);
                kpi = { sales: totalSales, budget: mediaMonthlyBudget, difference: totalSales - mediaMonthlyBudget, achievementRate: mediaMonthlyBudget > 0 ? (totalSales / mediaMonthlyBudget) * 100 : 0 };
                graph = salesData.map(d => ({ 
                    name: `${d.date.getDate()}日`, 
                    '売上': d.byMedia[mediaName]?.sales || 0 
                }));
                break;
            }
        }
        
        const category = CATEGORIES.map(catName => {
            const totalCatSales = salesData.reduce((sum, day) => sum + (day.byMedia[mediaName]?.byCategory[catName] || 0), 0);
            return {
                categoryName: catName,
                sales: totalCatSales,
            };
        });
        
        const aggregatedAspData = salesData.reduce((acc, dayData) => {
            const mediaAspData = dayData.byMedia[mediaName]?.byAsp;
            if (mediaAspData) {
                for (const aspName in mediaAspData) {
                    if (!acc[aspName]) {
                        acc[aspName] = { sales: 0, cost: 0, profit: 0 };
                    }
                    acc[aspName].sales += mediaAspData[aspName].sales;
                    acc[aspName].cost += mediaAspData[aspName].cost;
                    acc[aspName].profit += mediaAspData[aspName].profit;
                }
            }
            return acc;
        }, {} as Record<string, {sales: number, cost: number, profit: number}>);

        const asp = Object.entries(aggregatedAspData).map(([aspName, data]) => ({
            aspName, ...data
        }));

        return { kpiData: kpi, graphData: graph, categoryData: category.filter(c => c.sales > 0), aspData: asp.filter(a => a.sales > 0) };
    }, [mediaName, granularity, currentDate, salesData, selectedWeek, weeks, budgets]);
    
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value);
        const timezoneOffset = newDate.getTimezoneOffset() * 60000;
        setCurrentDate(new Date(newDate.getTime() + timezoneOffset));
        if (granularity === Granularity.WEEKLY) {
            setSelectedWeek(1);
        }
    };

    if (!mediaName) return null;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{mediaName} ダッシュボード</h1>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <span className="isolate inline-flex rounded-md shadow-sm">
                        {(Object.values(Granularity)).map(g => (
                            <button
                                key={g}
                                type="button"
                                onClick={() => setGranularity(g)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-slate-300 dark:ring-white/20 focus:z-10 ${granularity === g ? 'bg-primary-600 text-white hover:bg-primary-500' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'} first:rounded-l-md last:rounded-r-md`}
                            >
                                {g}
                            </button>
                        ))}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                           <CalendarIcon className="h-5 w-5 text-gray-400" />
                         </div>
                         <input
                             type={granularity === Granularity.DAILY ? 'date' : 'month'}
                             value={
                                granularity === Granularity.DAILY
                                ? currentDate.toISOString().substring(0, 10)
                                : currentDate.toISOString().substring(0, 7)
                             }
                             onChange={handleDateChange}
                             className="block w-full rounded-md border-slate-300 dark:border-white/20 bg-white dark:bg-slate-800 pl-10 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2"
                         />
                    </div>
                    {granularity === Granularity.WEEKLY && (
                        <select
                            value={selectedWeek}
                            onChange={e => setSelectedWeek(Number(e.target.value))}
                            className="block w-auto rounded-md border-slate-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2"
                        >
                            {weeks.map(week => (
                                <option key={week.num} value={week.num}>
                                    第{week.num}週 ({currentDate.getMonth() + 1}/{week.start}～{week.end})
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            <KpiSummary data={kpiData} />

            <Card title="売上推移">
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <LineChart data={graphData}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tickFormatter={(val) => `¥${(val as number / 1000)}k`} tick={{ fontSize: 12 }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(30, 41, 59, 0.8)', 
                                    borderColor: 'rgba(255, 255, 255, 0.2)',
                                    color: '#fff'
                                }}
                                formatter={(value: number) => `¥${value.toLocaleString()}`} 
                            />
                            <Legend />
                            <Line type="monotone" dataKey="売上" stroke="#f08301" strokeWidth={2} activeDot={{ r: 8 }} />
                            {graphData[0]?.hasOwnProperty('予算') && <Line type="monotone" dataKey="予算" stroke="#ffd5a3" strokeDasharray="5 5" />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PerformanceTable 
                    title="カテゴリ別実績（このメディア内での売上）"
                    headers={["カテゴリ名", "売上"]}
                    data={categoryData}
                    formatters={[
                        (val) => val,
                        (val) => `¥${(val as number).toLocaleString()}`,
                    ]}
                />
                <PerformanceTable 
                    title="ASP別実績"
                    headers={["ASP名", "売上", "費用", "利益"]}
                    data={aspData}
                    formatters={[
                        (val) => val,
                        (val) => `¥${(val as number).toLocaleString()}`,
                        (val) => `¥${(val as number).toLocaleString()}`,
                        (val) => `¥${(val as number).toLocaleString()}`
                    ]}
                />
            </div>
            
            <MediaBudgetEditor 
                mediaName={mediaName}
                budgets={budgets}
                setBudgets={setBudgets}
            />
        </div>
    );
};

export default MediaDashboardPage;