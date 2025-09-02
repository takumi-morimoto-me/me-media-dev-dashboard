import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Granularity, KpiData, SalesDataPoint, PerformanceByCategory, PerformanceByAsp, PerformanceByMedia, MediaBudget } from '../types';
import Card from '../components/Card';
import { CalendarIcon } from '../components/icons';
import { generateSalesData, CATEGORIES, ASP_NAMES } from '../data/mockData';

interface DashboardPageProps {
    budgets: MediaBudget[];
}

type LineVisibility = {
    '売上': boolean;
    '累計売上': boolean;
    '前月売上': boolean;
    '前月累計売上': boolean;
    '前期売上': boolean;
    '前期累計売上': boolean;
};

const lineOptions: (keyof LineVisibility)[] = [
    '売上',
    '累計売上',
    '前月売上',
    '前月累計売上',
    '前期売上',
    '前期累計売上',
];

const lineColors: Record<keyof LineVisibility, string> = {
    '売上': '#f08301',
    '累計売上': '#82ca9d',
    '前月売上': '#ffc658',
    '前月累計売上': '#ff7300',
    '前期売上': '#8884d8',
    '前期累計売上': '#387908',
};


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

const PerformanceTable: React.FC<{
    title: string;
    headers: string[];
    data: any[];
    formatters: ((val: any) => React.ReactNode)[];
    onRowClick?: (row: any) => void;
}> = ({ title, headers, data, formatters, onRowClick }) => (
    <Card title={title}>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-white/5">
                    <tr>{headers.map(h => <th key={h} scope="col" className="px-6 py-3">{h}</th>)}</tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr
                            key={index}
                            className={`bg-white dark:bg-transparent border-b border-slate-200 dark:border-white/10 hover:bg-slate-50/50 dark:hover:bg-white/5 ${onRowClick ? 'cursor-pointer' : ''}`}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                        >
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

const getWeekStartDate = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay(); // 0 for Sunday
    const diff = date.getDate() - day;
    const weekStart = new Date(date.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
};


const DashboardPage: React.FC<DashboardPageProps> = ({ budgets }) => {
    const navigate = useNavigate();
    const [granularity, setGranularity] = useState<Granularity>(Granularity.MONTHLY);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [visibleLines, setVisibleLines] = useState<LineVisibility>({
        '売上': true,
        '累計売上': true,
        '前月売上': false,
        '前月累計売上': false,
        '前期売上': false,
        '前期累計売上': false,
    });

    const { kpiData, graphData, categoryData, aspData, mediaData } = useMemo(() => {
        let kpi: KpiData = { sales: 0, budget: 0, difference: 0, achievementRate: 0 };
        let graph: SalesDataPoint[] = [];
        let category: PerformanceByCategory[] = [];
        let asp: PerformanceByAsp[] = [];
        let media: PerformanceByMedia[] = [];

        const totalMonthlyBudget = budgets.reduce((sum, media) => {
            return sum + Object.values(media.salesBudgets).reduce((s, b) => s + b, 0);
        }, 0);
        
        const processPeriodData = (
            dailyData: ReturnType<typeof generateSalesData>,
            periodBudget: number
        ) => {
            const totalSales = dailyData.reduce((sum, d) => sum + d.sales, 0);
             const kpi = {
                sales: totalSales,
                budget: periodBudget,
                difference: totalSales - periodBudget,
                achievementRate: periodBudget > 0 ? (totalSales / periodBudget) * 100 : 0
            };

            const category = CATEGORIES.map(catName => ({
                categoryName: catName,
                sales: dailyData.reduce((sum, day) => sum + (day.byCategory[catName] || 0), 0),
            }));

            const aggregatedAspData = dailyData.reduce((acc, dayData) => {
                for (const aspName in dayData.byAsp) {
                    if (!acc[aspName]) acc[aspName] = { sales: 0, cost: 0, profit: 0 };
                    acc[aspName].sales += dayData.byAsp[aspName].sales;
                    acc[aspName].cost += dayData.byAsp[aspName].cost;
                    acc[aspName].profit += dayData.byAsp[aspName].profit;
                }
                return acc;
            }, {} as Record<string, {sales: number, cost: number, profit: number}>);
            const asp = Object.entries(aggregatedAspData).map(([aspName, data]) => ({ aspName, ...data }));
            return {kpi, category, asp};
        };

        switch (granularity) {
            case Granularity.DAILY: { // 1 month of daily data
                const salesData = generateSalesData(currentDate, 'monthly');
                const prevMonthDate = new Date(currentDate); prevMonthDate.setMonth(currentDate.getMonth() - 1);
                const prevYearDate = new Date(currentDate); prevYearDate.setFullYear(currentDate.getFullYear() - 1);
                const prevMonthSalesData = generateSalesData(prevMonthDate, 'monthly');
                const prevYearSalesData = generateSalesData(prevYearDate, 'monthly');

                const result = processPeriodData(salesData, totalMonthlyBudget);
                kpi = result.kpi;
                category = result.category;
                asp = result.asp;
                
                let cumulativeSales = 0, cumulativeBudget = 0, cumulativePrevMonthSales = 0, cumulativePrevYearSales = 0;
                graph = salesData.map(d => {
                    const dayOfMonth = d.date.getDate();
                    const prevMonthDayData = prevMonthSalesData.find(p => p.date.getDate() === dayOfMonth);
                    const prevYearDayData = prevYearSalesData.find(p => p.date.getDate() === dayOfMonth && p.date.getMonth() === d.date.getMonth());
                    
                    cumulativeSales += d.sales;
                    cumulativeBudget += totalMonthlyBudget / salesData.length;
                    cumulativePrevMonthSales += prevMonthDayData?.sales || 0;
                    cumulativePrevYearSales += prevYearDayData?.sales || 0;
                    
                    return { 
                        name: `${d.date.getDate()}日`, 
                        '売上': d.sales, 
                        '予算': totalMonthlyBudget / salesData.length,
                        '累計売上': cumulativeSales,
                        '累計予算': cumulativeBudget,
                        '前月売上': prevMonthDayData?.sales || null,
                        '前月累計売上': cumulativePrevMonthSales,
                        '前期売上': prevYearDayData?.sales || null,
                        '前期累計売上': cumulativePrevYearSales,
                    };
                });
                break;
            }
            case Granularity.WEEKLY: { // 3 months of weekly data
                const dates = Array.from({ length: 3 }, (_, i) => {
                    const d = new Date(currentDate);
                    d.setMonth(d.getMonth() - i);
                    return d;
                }).reverse();

                const allDailyData = dates.flatMap(d => generateSalesData(d, 'monthly'));
                const prevYearDailyData = dates.flatMap(d => {
                    const prevYearDate = new Date(d);
                    prevYearDate.setFullYear(d.getFullYear() - 1);
                    return generateSalesData(prevYearDate, 'monthly');
                });
                const prevMonthDailyData = dates.flatMap(d => {
                    const prevMonthDate = new Date(d);
                    prevMonthDate.setMonth(d.getMonth() - 1);
                    return generateSalesData(prevMonthDate, 'monthly');
                });

                const result = processPeriodData(allDailyData, totalMonthlyBudget * 3);
                kpi = result.kpi;
                category = result.category;
                asp = result.asp;
                
                const weeklyMap = new Map<number, { sales: number, prevMonthSales: number, prevYearSales: number }>();
                
                const aggregateToWeekly = (dailyData: any[], targetProp: 'sales' | 'prevMonthSales' | 'prevYearSales') => {
                    dailyData.forEach(day => {
                        const weekStart = getWeekStartDate(day.date);
                        const key = weekStart.getTime();
                        if (!weeklyMap.has(key)) weeklyMap.set(key, { sales: 0, prevMonthSales: 0, prevYearSales: 0 });
                        weeklyMap.get(key)![targetProp] += day.sales;
                    });
                };
                
                aggregateToWeekly(allDailyData, 'sales');
                aggregateToWeekly(prevMonthDailyData, 'prevMonthSales');
                aggregateToWeekly(prevYearDailyData, 'prevYearSales');

                const weeklyAggregates = Array.from(weeklyMap.entries())
                    .map(([time, data]) => ({ startDate: new Date(time), ...data }))
                    .sort((a,b) => a.startDate.getTime() - b.startDate.getTime());
                
                let cumulativeSales = 0, cumulativeBudget = 0, cumulativePrevMonthSales = 0, cumulativePrevYearSales = 0;
                graph = weeklyAggregates.map(week => {
                    cumulativeSales += week.sales;
                    cumulativeBudget += (totalMonthlyBudget / 4); // Approximation
                    cumulativePrevMonthSales += week.prevMonthSales;
                    cumulativePrevYearSales += week.prevYearSales;

                    return {
                        name: `${week.startDate.getMonth() + 1}/${week.startDate.getDate()}`,
                        '売上': week.sales,
                        '予算': (totalMonthlyBudget / 4),
                        '累計売上': cumulativeSales,
                        '累計予算': cumulativeBudget,
                        '前月売上': week.prevMonthSales,
                        '前月累計売上': cumulativePrevMonthSales,
                        '前期売上': week.prevYearSales,
                        '前期累計売上': cumulativePrevYearSales,
                    };
                });
                break;
            }
            case Granularity.MONTHLY: { // 12 months of monthly data
                const dates = Array.from({ length: 12 }, (_, i) => {
                    const d = new Date(currentDate);
                    d.setMonth(d.getMonth() - i);
                    return d;
                }).reverse();

                const allDailyData = dates.flatMap(d => generateSalesData(d, 'monthly'));
                
                const result = processPeriodData(allDailyData, totalMonthlyBudget * 12);
                kpi = result.kpi;
                category = result.category;
                asp = result.asp;

                let cumulativeSales = 0, cumulativeBudget = 0, cumulativePrevYearSales = 0;
                graph = dates.map(d => {
                    const monthSalesData = generateSalesData(d, 'monthly');
                    const totalSales = monthSalesData.reduce((sum, day) => sum + day.sales, 0);
                    
                    const prevYearDate = new Date(d); prevYearDate.setFullYear(d.getFullYear() - 1);
                    const prevYearMonthSalesData = generateSalesData(prevYearDate, 'monthly');
                    const prevYearTotalSales = prevYearMonthSalesData.reduce((sum, day) => sum + day.sales, 0);

                    cumulativeSales += totalSales;
                    cumulativeBudget += totalMonthlyBudget;
                    cumulativePrevYearSales += prevYearTotalSales;
                    
                    return { 
                        name: `${d.getFullYear()}/${d.getMonth() + 1}`, 
                        '売上': totalSales,
                        '予算': totalMonthlyBudget,
                        '累計売上': cumulativeSales,
                        '累計予算': cumulativeBudget,
                        '前期売上': prevYearTotalSales,
                        '前期累計売上': cumulativePrevYearSales,
                    };
                });
                break;
            }
        }
        
        // This is a simplified calculation for media table, should be refined if needed.
        const allDailyDataForMedia = (granularity === Granularity.DAILY 
            ? generateSalesData(currentDate, 'monthly')
            : Array.from({length: granularity === Granularity.WEEKLY ? 3 : 12}, (_, i) => {
                const d = new Date(currentDate); d.setMonth(d.getMonth() - i); return d;
            }).flatMap(d => generateSalesData(d, 'monthly'))
        );

        media = budgets.map(b => {
            const totalMediaSales = allDailyDataForMedia.reduce((sum, day) => sum + (day.byMedia[b.mediaName]?.sales || 0), 0);
            const periodMultiplier = granularity === Granularity.DAILY ? 1 : (granularity === Granularity.WEEKLY ? 3 : 12);
            const totalMediaBudget = Object.values(b.salesBudgets).reduce((s, bud) => s + bud, 0) * periodMultiplier;
            return {
                mediaName: b.mediaName,
                sales: totalMediaSales,
                budget: totalMediaBudget,
                achievementRate: totalMediaBudget > 0 ? (totalMediaSales / totalMediaBudget) * 100 : 0,
            };
        });

        return { kpiData: kpi, graphData: graph, categoryData: category, aspData: asp, mediaData: media };
    }, [granularity, currentDate, budgets]);
    
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [year, month] = e.target.value.split('-').map(Number);
        const newDate = new Date(year, month - 1, 1);
        setCurrentDate(newDate);
    };

    const toggleLineVisibility = (lineName: keyof LineVisibility) => {
        setVisibleLines(prev => ({ ...prev, [lineName]: !prev[lineName] }));
    };

    return (
        <div className="space-y-6">
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
                             type="month"
                             value={currentDate.toISOString().substring(0, 7)}
                             onChange={handleDateChange}
                             className="block w-full rounded-md border-slate-300 dark:border-white/20 bg-white dark:bg-slate-800 pl-10 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2"
                         />
                    </div>
                </div>
            </div>

            <KpiSummary data={kpiData} />

            <Card title="売上推移">
                <div className="px-2 pb-4 flex flex-wrap gap-x-4 gap-y-2">
                    {lineOptions.map(name => {
                        const isApplicable = !(granularity === Granularity.MONTHLY && (name.includes('前月')));
                        if (!isApplicable) return null;
                        return (
                            <button
                                key={name}
                                onClick={() => toggleLineVisibility(name)}
                                style={{
                                    backgroundColor: visibleLines[name] ? lineColors[name] : undefined,
                                    borderColor: lineColors[name],
                                }}
                                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                                    visibleLines[name]
                                        ? 'text-white'
                                        : 'text-slate-600 dark:text-slate-300 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                {name}
                            </button>
                        )
                    })}
                </div>
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <LineChart data={graphData}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis yAxisId="left" tickFormatter={(val) => `¥${(val as number / 1000)}k`} tick={{ fontSize: 12 }} />
                            <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `¥${(val as number / 1000)}k`} tick={{ fontSize: 12 }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(30, 41, 59, 0.8)', 
                                    borderColor: 'rgba(255, 255, 255, 0.2)',
                                    color: '#fff'
                                }}
                                formatter={(value: number, name) => [`¥${value.toLocaleString()}`, name]} 
                            />
                            <Legend />
                            <Line connectNulls yAxisId="left" type="monotone" dataKey="売上" stroke={lineColors['売上']} strokeWidth={2} activeDot={{ r: 6 }} dot={false} hide={!visibleLines['売上']} />
                            <Line connectNulls yAxisId="right" type="monotone" dataKey="累計売上" stroke={lineColors['累計売上']} strokeWidth={2} dot={false} hide={!visibleLines['累計売上']} />
                            
                            <Line connectNulls yAxisId="left" type="monotone" dataKey="前月売上" stroke={lineColors['前月売上']} strokeDasharray="3 3" dot={false} hide={!visibleLines['前月売上']} />
                            <Line connectNulls yAxisId="right" type="monotone" dataKey="前月累計売上" stroke={lineColors['前月累計売上']} strokeDasharray="3 3" dot={false} hide={!visibleLines['前月累計売上']} />

                            <Line connectNulls yAxisId="left" type="monotone" dataKey="前期売上" stroke={lineColors['前期売上']} strokeDasharray="5 5" dot={false} hide={!visibleLines['前期売上']} />
                            <Line connectNulls yAxisId="right" type="monotone" dataKey="前期累計売上" stroke={lineColors['前期累計売上']} strokeDasharray="5 5" dot={false} hide={!visibleLines['前期累計売上']} />

                            {graphData[0]?.hasOwnProperty('予算') && <Line yAxisId="left" type="monotone" dataKey="予算" stroke="#a0a0a0" strokeDasharray="1 5" dot={false} />}
                            {graphData[0]?.hasOwnProperty('累計予算') && <Line yAxisId="right" type="monotone" dataKey="累計予算" stroke="#a0a0a0" strokeDasharray="1 5" dot={false} />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PerformanceTable 
                    title="カテゴリ別実績"
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

            <PerformanceTable 
                title="メディア別実績"
                headers={["メディア名", "売上", "予算", "達成率", "前月比", "前期比"]}
                data={mediaData}
                formatters={[
                    (val) => val,
                    (val) => `¥${(val as number).toLocaleString()}`,
                    (val) => `¥${(val as number).toLocaleString()}`,
                    (val) => {
                        const rate = val as number;
                        const color = rate >= 100 ? 'text-green-500' : (rate >= 80 ? 'text-yellow-500' : 'text-red-500');
                        return <span className={color}>{rate.toFixed(1)}%</span>
                    },
                     (val) => {
                        const mom = val as number | undefined;
                        if (mom === undefined) return <span className="text-slate-400">-</span>;
                        const color = mom >= 0 ? 'text-green-500' : 'text-red-500';
                        return <span className={color}>{mom >= 0 ? '+' : ''}{mom.toFixed(1)}%</span>;
                    },
                    (val) => {
                        const yoy = val as number | undefined;
                        if (yoy === undefined) return <span className="text-slate-400">-</span>;
                        const color = yoy >= 0 ? 'text-green-500' : 'text-red-500';
                        return <span className={color}>{yoy >= 0 ? '+' : ''}{yoy.toFixed(1)}%</span>;
                    }
                ]}
                onRowClick={(row: PerformanceByMedia) => navigate(`/media/${row.mediaName}`)}
            />
        </div>
    );
};

export default DashboardPage;