import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { DailyBudgetData, BudgetItem, MonthlyBudgetData } from '../types';
import { getBudgetData, saveBudgetData } from '../data/budgetMockData';
import Card from '../components/Card';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, UploadIcon, LinkIcon } from '../components/icons';

type Granularity = '月次' | '日次';

const FISCAL_PERIOD_BASE_YEAR = 2004; // 1期 (period 1) is 2005

const getFiscalPeriod = (date: Date, startMonth: number): number => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const fiscalYear = month >= startMonth ? year : year - 1;
    return fiscalYear - FISCAL_PERIOD_BASE_YEAR;
};

const getCalendarYearForPeriod = (period: number): number => {
    return period + FISCAL_PERIOD_BASE_YEAR;
};

const getMonthsForFiscalYear = (startMonth: number): number[] => {
    const months: number[] = [];
    for (let i = 0; i < 12; i++) {
        months.push(((startMonth - 1 + i) % 12) + 1);
    }
    return months;
};

const getCalendarDateForFiscalMonth = (fiscalPeriod: number, fiscalMonth: number, startMonth: number): { year: number, month: number } => {
    let calendarYear = getCalendarYearForPeriod(fiscalPeriod);
    if (fiscalMonth < startMonth) {
        calendarYear += 1;
    }
    return { year: calendarYear, month: fiscalMonth };
};

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  return (
    <div className={`fixed bottom-5 right-5 py-3 px-5 rounded-lg shadow-xl text-white font-semibold z-50 ${bgColor}`}>
      {message}
    </div>
  );
};

interface BudgetsPageProps {
    mediaNames: string[];
    fiscalYearStartMonth: number;
    mediaBudgetItems: { [mediaName: string]: BudgetItem[] };
}
const BudgetsPage: React.FC<BudgetsPageProps> = ({ mediaNames, fiscalYearStartMonth, mediaBudgetItems }) => {
  const [selectedMedia, setSelectedMedia] = useState(mediaNames[0] || '');
  const [granularity, setGranularity] = useState<Granularity>('月次');
  const [targetDate, setTargetDate] = useState(new Date());

  const [budgetData, setBudgetData] = useState<DailyBudgetData | null>(null);
  const [yearlyBudgetData, setYearlyBudgetData] = useState<MonthlyBudgetData | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFiscalPeriod = useMemo(() => getFiscalPeriod(targetDate, fiscalYearStartMonth), [targetDate, fiscalYearStartMonth]);
  
  const budgetItems = useMemo(() => mediaBudgetItems[selectedMedia] || [], [mediaBudgetItems, selectedMedia]);

  useEffect(() => {
    if (mediaNames.length > 0 && !mediaNames.includes(selectedMedia)) {
      setSelectedMedia(mediaNames[0]);
    }
  }, [mediaNames, selectedMedia]);

  useEffect(() => {
    if (!selectedMedia) return;
    setIsLoading(true);
    setSaveStatus({});
    
    if (granularity === '月次') {
        const fetchYearlyData = async () => {
            try {
                const allMonthsData: MonthlyBudgetData = {};
                const monthsToFetch = getMonthsForFiscalYear(fiscalYearStartMonth);
                
                const promises = monthsToFetch.map(monthNum => {
                    const { year: calendarYear, month: calendarMonth } = getCalendarDateForFiscalMonth(selectedFiscalPeriod, monthNum, fiscalYearStartMonth);
                    return getBudgetData(selectedMedia, calendarYear, calendarMonth);
                });

                const results = await Promise.all(promises);
                
                monthsToFetch.forEach((monthNum, index) => {
                    allMonthsData[monthNum] = results[index];
                });

                setYearlyBudgetData(allMonthsData);
                setBudgetData(null);
            } catch (error) {
                console.error("Failed to fetch yearly budget data:", error);
                setToast({ message: "年間データの読み込みに失敗しました。", type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchYearlyData();
    } else { // 日次
        const fetchMonthlyData = async () => {
            try {
                const year = targetDate.getFullYear();
                const month = targetDate.getMonth() + 1;
                const data = await getBudgetData(selectedMedia, year, month);
                setBudgetData(data);
                setYearlyBudgetData(null);
            } catch (error) {
                console.error("Failed to fetch budget data:", error);
                setToast({ message: "データの読み込みに失敗しました。", type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchMonthlyData();
    }
  }, [selectedMedia, targetDate, granularity, fiscalYearStartMonth, selectedFiscalPeriod]);
  
  const handleBudgetChange = (itemId: string, day: number, value: string) => {
    const numericValue = parseInt(value, 10) || 0;
    setBudgetData(prev => {
      if (!prev) return null;
      const newData = JSON.parse(JSON.stringify(prev));
      if (!newData[itemId]) newData[itemId] = {};
      newData[itemId][day] = numericValue;
      return newData;
    });
  };

  const handleSave = useCallback(async (itemId: string, day: number) => {
    const cellKey = `${itemId}-${day}`;
    const value = budgetData?.[itemId]?.[day] ?? 0;
    
    setSaveStatus(prev => ({ ...prev, [cellKey]: 'saving' }));
    const res = await saveBudgetData(selectedMedia, targetDate.getFullYear(), targetDate.getMonth() + 1, itemId, day, value);
    
    if (res.success) {
      setSaveStatus(prev => ({ ...prev, [cellKey]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => {
        const newStatus = {...prev};
        delete newStatus[cellKey];
        return newStatus;
      }), 2000);
    } else {
      setSaveStatus(prev => ({ ...prev, [cellKey]: 'error' }));
      setToast({ message: "保存に失敗しました", type: 'error' });
    }
  }, [budgetData, selectedMedia, targetDate]);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== 'string') {
            setToast({ message: 'ファイル形式が正しくありません。', type: 'error' });
            return;
        }
        try {
            const lines = text.split(/\r\n|\n/);
            const headers = lines[0].split(',');
            // Expected header: 項目名,1月,2月...12月
            if (headers.length !== 13 || headers[0] !== '項目名') {
                throw new Error('CSVヘッダーが不正です。');
            }
            const newYearlyData: MonthlyBudgetData = {};
            
            const editableItems = budgetItems.filter(i => i.isEditable);

            lines.slice(1).forEach(line => {
                if (!line.trim()) return;
                const values = line.split(',');
                const itemName = values[0];
                const item = editableItems.find(i => i.name === itemName);

                if (item) {
                    for (let monthIdx = 1; monthIdx <= 12; monthIdx++) {
                        const monthValue = parseInt(values[monthIdx], 10);
                        const calendarMonth = parseInt(headers[monthIdx].replace('月', ''), 10);

                        if (!isNaN(monthValue) && !isNaN(calendarMonth)) {
                            if (!newYearlyData[calendarMonth]) newYearlyData[calendarMonth] = {};
                            if (!newYearlyData[calendarMonth][item.id]) newYearlyData[calendarMonth][item.id] = {};
                            
                            const { year: calendarYear } = getCalendarDateForFiscalMonth(selectedFiscalPeriod, calendarMonth, fiscalYearStartMonth);
                            const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
                            const dailyValue = Math.floor(monthValue / daysInMonth);

                            for(let day = 1; day <= daysInMonth; day++) {
                                newYearlyData[calendarMonth][item.id][day] = dailyValue;
                            }
                            if(daysInMonth > 0) {
                                newYearlyData[calendarMonth][item.id][daysInMonth] += monthValue % daysInMonth;
                            }
                        }
                    }
                }
            });
            setYearlyBudgetData(currentData => ({...currentData, ...newYearlyData}));
            setToast({ message: 'CSVデータを読み込みました。', type: 'success' });
        } catch (error) {
            console.error(error);
            setToast({ message: (error as Error).message || 'CSVの解析に失敗しました。', type: 'error' });
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };
  
  const handleLinkSpreadsheet = () => {
      alert("この機能は現在開発中です。");
  };

  const { flatItems, itemMap } = useMemo(() => {
    const items = [...budgetItems];
    const itemMap = new Map(items.map(i => ({ ...i, children: [] as any[] })).map(i => [i.id, i]));
    const roots: any[] = [];
    items.forEach(item => {
        if (item.parentId && itemMap.has(item.parentId)) {
            itemMap.get(item.parentId)!.children.push(itemMap.get(item.id)!);
        } else {
            roots.push(itemMap.get(item.id)!);
        }
    });

    const flatItems: (BudgetItem & { depth: number })[] = [];
    const traverse = (items: any[], depth: number) => {
        items.forEach(item => {
            flatItems.push({ ...item, depth });
            if (item.children.length > 0) {
                traverse(item.children, depth + 1);
            }
        });
    };
    traverse(roots, 0);

    return { flatItems, itemMap };
  }, [budgetItems]);

  const calculateParentTotals = useCallback((data: DailyBudgetData, daysInMonth: number) => {
      const newCalculatedData = JSON.parse(JSON.stringify(data));
      [...flatItems].reverse().forEach(item => {
          const fullItem = itemMap.get(item.id);
          if (fullItem && fullItem.children.length > 0) {
              newCalculatedData[item.id] = {};
              for (let day = 1; day <= daysInMonth; day++) {
                  const childTotal = fullItem.children.reduce((sum: number, child: any) => {
                      return sum + (newCalculatedData[child.id]?.[day] ?? 0);
                  }, 0);
                  newCalculatedData[item.id][day] = childTotal;
              }
          }
      });
      return newCalculatedData;
  }, [flatItems, itemMap]);


  const calculatedDailyData = useMemo(() => {
    if (granularity !== '日次' || !budgetData) return null;
    const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    return calculateParentTotals(budgetData, daysInMonth);
  }, [budgetData, granularity, targetDate, calculateParentTotals]);
  
  const calculatedYearlyData = useMemo(() => {
    if (granularity !== '月次' || !yearlyBudgetData) return null;
    const calculatedData: MonthlyBudgetData = {};
    const fiscalMonths = getMonthsForFiscalYear(fiscalYearStartMonth);
    for (const month of fiscalMonths) {
        const monthData = yearlyBudgetData[month];
        if (monthData) {
            const { year: calendarYear } = getCalendarDateForFiscalMonth(selectedFiscalPeriod, month, fiscalYearStartMonth);
            const daysInMonth = new Date(calendarYear, month, 0).getDate();
            calculatedData[month] = calculateParentTotals(monthData, daysInMonth);
        }
    }
    return calculatedData;
  }, [yearlyBudgetData, granularity, fiscalYearStartMonth, calculateParentTotals, selectedFiscalPeriod]);

  const daysInMonth = useMemo(() => new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate(), [targetDate]);
  
  const fiscalMonths = useMemo(() => getMonthsForFiscalYear(fiscalYearStartMonth), [fiscalYearStartMonth]);

  const periods = Array.from({length: 5}, (_, i) => getFiscalPeriod(new Date(), fiscalYearStartMonth) - 2 + i);
  
  const handleFiscalPeriodChange = (newPeriod: number) => {
    const startYear = getCalendarYearForPeriod(newPeriod);
    setTargetDate(new Date(startYear, fiscalYearStartMonth - 1, 1));
  };

  const handleMonthChange = (newMonth: number) => {
      const { year: newCalendarYear } = getCalendarDateForFiscalMonth(selectedFiscalPeriod, newMonth, fiscalYearStartMonth);
      setTargetDate(new Date(newCalendarYear, newMonth - 1, 1));
  };

  const getDayValue = (data: DailyBudgetData | null, itemId: string, day: number) => data?.[itemId]?.[day] ?? 0;
  const getMonthTotal = (data: DailyBudgetData | null, itemId: string) => {
      if (!data || !data[itemId]) return 0;
      return Object.values(data[itemId]).reduce((sum, val) => sum + val, 0);
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <h1 className="text-2xl font-bold">予算入力</h1>
      
      <Card title="操作対象の選択">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="media-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">メディア</label>
              <select id="media-select" value={selectedMedia} onChange={e => setSelectedMedia(e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                  {mediaNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
             <div>
                 <label htmlFor="period-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{granularity === '月次' ? '対象期' : '対象年月'}</label>
                 <div className="flex items-center space-x-2">
                      <select id="period-select" aria-label="Period" value={selectedFiscalPeriod} onChange={e => handleFiscalPeriodChange(parseInt(e.target.value))} className="block w-full rounded-md border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                          {periods.map(p => <option key={p} value={p}>{p}期</option>)}
                      </select>
                      {granularity === '日次' && (
                        <select aria-label="Month" value={targetDate.getMonth() + 1} onChange={e => handleMonthChange(parseInt(e.target.value))} className="block w-full rounded-md border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                            {fiscalMonths.map(m => <option key={m} value={m}>{m}月</option>)}
                        </select>
                      )}
                 </div>
             </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">粒度</label>
              <span className="isolate inline-flex rounded-md shadow-sm w-full">
                <button type="button" onClick={() => setGranularity('月次')} className={`relative inline-flex items-center justify-center w-1/2 rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-slate-300 dark:ring-white/20 focus:z-10 ${granularity === '月次' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>月次</button>
                <button type="button" onClick={() => setGranularity('日次')} className={`relative -ml-px inline-flex items-center justify-center w-1/2 rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-slate-300 dark:ring-white/20 focus:z-10 ${granularity === '日次' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>日次</button>
              </span>
            </div>
         </div>
         {granularity === '月次' && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row gap-3">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".csv"
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-white/20 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                    <UploadIcon className="w-5 h-5" />
                    CSVアップロード
                </button>
                <button
                    onClick={handleLinkSpreadsheet} 
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-white/20 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                    <LinkIcon className="w-5 h-5" />
                    スプレッドシート連携
                </button>
            </div>
         )}
      </Card>
      
      <Card title="予算入力グリッド" >
        {isLoading ? (
          <div className="text-center p-8">データを読み込み中...</div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-full text-sm border-collapse border border-slate-200 dark:border-white/10">
              <thead className="bg-slate-50 dark:bg-white/5">
                <tr>
                  <th className="sticky left-0 bg-slate-100 dark:bg-slate-800 z-20 p-2 border border-slate-200 dark:border-white/10 min-w-[200px] text-left">予算項目</th>
                  <th className="sticky left-[200px] bg-slate-100 dark:bg-slate-800 z-20 p-2 border border-slate-200 dark:border-white/10 min-w-[120px] text-center font-semibold">{granularity === '月次' ? '年間合計' : '月間合計'}</th>
                  {granularity === '月次' && fiscalMonths.map(month => <th key={month} className="p-2 border border-slate-200 dark:border-white/10 text-center font-semibold min-w-[100px]">{month}月</th>)}
                  {granularity === '日次' && Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                    <th key={day} className="p-2 border border-slate-200 dark:border-white/10 text-center font-semibold min-w-[100px]">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flatItems.map(item => (
                  <tr key={item.id} className={item.isHeader ? 'bg-slate-100 dark:bg-slate-800' : 'bg-white dark:bg-dark-background hover:bg-slate-50/50 dark:hover:bg-slate-700/50'}>
                    <th className="sticky left-0 z-10 p-2 border border-slate-200 dark:border-white/10 text-left font-medium bg-inherit" style={{ paddingLeft: `${item.depth * 1.5 + 0.5}rem` }}>
                      {item.name}
                    </th>
                    <td className="sticky left-[200px] z-10 p-2 border border-slate-200 dark:border-white/10 text-right font-semibold bg-inherit">
                      {granularity === '月次' && (
                        <span>
                          {fiscalMonths.reduce((total, month) => {
                            return total + getMonthTotal(calculatedYearlyData?.[month] ?? null, item.id);
                          }, 0).toLocaleString()}
                        </span>
                      )}
                      {granularity === '日次' && (
                        <span>{getMonthTotal(calculatedDailyData, item.id).toLocaleString()}</span>
                      )}
                    </td>
                    
                    {granularity === '月次' && fiscalMonths.map(month => (
                        <td key={month} className="p-0 border border-slate-200 dark:border-white/10 text-right">
                            <div className="px-2 py-1.5">{getMonthTotal(calculatedYearlyData?.[month] ?? null, item.id).toLocaleString()}</div>
                        </td>
                    ))}

                    {granularity === '日次' && Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                      const cellKey = `${item.id}-${day}`;
                      const status = saveStatus[cellKey];
                      return (
                        <td key={day} className="p-0 border border-slate-200 dark:border-white/10 text-right">
                          {item.isEditable ? (
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={getDayValue(budgetData, item.id, day).toLocaleString()}
                                onChange={e => handleBudgetChange(item.id, day, e.target.value.replace(/,/g, ''))}
                                onBlur={() => handleSave(item.id, day)}
                                onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                className="w-full h-full text-right px-2 py-1.5 bg-transparent focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                               <div className="absolute top-1/2 right-2 transform -translate-y-1/2">
                                {status === 'saving' && <InformationCircleIcon className="w-4 h-4 text-blue-500 animate-spin" />}
                                {status === 'saved' && <CheckCircleIcon className="w-4 h-4 text-green-500" />}
                                {status === 'error' && <ExclamationCircleIcon className="w-4 h-4 text-red-500" />}
                              </div>
                            </div>
                          ) : (
                            <div className="px-2 py-1.5">{getDayValue(calculatedDailyData, item.id, day).toLocaleString()}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BudgetsPage;