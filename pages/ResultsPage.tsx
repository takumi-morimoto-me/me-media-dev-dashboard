import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DailyBudgetData, BudgetItem, MonthlyBudgetData } from '../types';
import { initialBudgetItems } from '../data/budgetMockData';
import { getResultsData, saveResultsData } from '../data/resultMockData';
import Card from '../components/Card';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, PlusIcon } from '../components/icons';

type Granularity = '月次' | '日次';

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

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, parentId: string | null) => void;
    parentItems: BudgetItem[];
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSave, parentItems }) => {
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setName('');
            setParentId(parentItems.length > 0 ? parentItems[0].id : null);
        }
    }, [isOpen, parentItems]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave(name.trim(), parentId);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center">
            <div className="bg-background dark:bg-dark-background dark:border dark:border-white/10 rounded-lg shadow-xl p-8 w-full max-w-md">
                <h2 className="text-xl font-bold mb-6">実績項目を追加</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="item-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">項目名</label>
                            <input type="text" id="item-name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-slate-800" />
                        </div>
                        <div>
                            <label htmlFor="parent-item" className="block text-sm font-medium text-slate-700 dark:text-slate-300">親項目</label>
                            <select id="parent-item" value={parentId ?? ''} onChange={e => setParentId(e.target.value || null)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md">
                                <option value="">（階層なし）</option>
                                {parentItems.map(item => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="bg-white dark:bg-slate-700 py-2 px-4 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                            キャンセル
                        </button>
                        <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                            追加
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
interface ResultsPageProps {
    mediaNames: string[];
}
const ResultsPage: React.FC<ResultsPageProps> = ({ mediaNames }) => {
  const [selectedMedia, setSelectedMedia] = useState(mediaNames[0] || '');
  const [granularity, setGranularity] = useState<Granularity>('月次');
  const [targetDate, setTargetDate] = useState(new Date());
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(initialBudgetItems);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [resultsData, setResultsData] = useState<DailyBudgetData | null>(null);
  const [yearlyResultsData, setYearlyResultsData] = useState<MonthlyBudgetData | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  useEffect(() => {
    if (mediaNames.length > 0 && !mediaNames.includes(selectedMedia)) {
      setSelectedMedia(mediaNames[0]);
    }
  }, [mediaNames, selectedMedia]);

  useEffect(() => {
    if (!selectedMedia) return;
    const year = targetDate.getFullYear();
    setIsLoading(true);
    setSaveStatus({});

    if (granularity === '月次') {
        const fetchYearlyData = async () => {
            try {
                const allMonthsData: MonthlyBudgetData = {};
                const promises = Array.from({ length: 12 }, (_, i) => getResultsData(selectedMedia, year, i + 1));
                const results = await Promise.all(promises);
                results.forEach((data, index) => {
                    allMonthsData[index + 1] = data;
                });
                setYearlyResultsData(allMonthsData);
                setResultsData(null);
            } catch (error) {
                console.error("Failed to fetch yearly result data:", error);
                setToast({ message: "年間データの読み込みに失敗しました。", type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchYearlyData();
    } else { // 日次
        const fetchMonthlyData = async () => {
            try {
                const month = targetDate.getMonth() + 1;
                const data = await getResultsData(selectedMedia, year, month);
                setResultsData(data);
                setYearlyResultsData(null);
            } catch (error) {
                console.error("Failed to fetch result data:", error);
                setToast({ message: "データの読み込みに失敗しました。", type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchMonthlyData();
    }
  }, [selectedMedia, targetDate, granularity]);
  
  const handleResultChange = (itemId: string, day: number, value: string) => {
    const numericValue = parseInt(value, 10) || 0;
    setResultsData(prev => {
      if (!prev) return null;
      const newData = JSON.parse(JSON.stringify(prev));
      if (!newData[itemId]) newData[itemId] = {};
      newData[itemId][day] = numericValue;
      return newData;
    });
  };

  const handleSave = useCallback(async (itemId: string, day: number) => {
    const cellKey = `${itemId}-${day}`;
    const value = resultsData?.[itemId]?.[day] ?? 0;
    
    setSaveStatus(prev => ({ ...prev, [cellKey]: 'saving' }));
    const res = await saveResultsData(selectedMedia, targetDate.getFullYear(), targetDate.getMonth() + 1, itemId, day, value);
    
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
  }, [resultsData, selectedMedia, targetDate]);

  const handleAddItem = (name: string, parentId: string | null) => {
    const newItem: BudgetItem = {
        id: `custom-${Date.now()}`,
        name,
        parentId,
        isEditable: true,
        isHeader: false,
    };
    setBudgetItems(prev => [...prev, newItem]);
    setIsModalOpen(false);
    setToast({ message: "項目を追加しました", type: 'success' });
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
    if (granularity !== '日次' || !resultsData) return null;
    const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    return calculateParentTotals(resultsData, daysInMonth);
  }, [resultsData, granularity, targetDate, calculateParentTotals]);
  
  const calculatedYearlyData = useMemo(() => {
    if (granularity !== '月次' || !yearlyResultsData) return null;
    const calculatedData: MonthlyBudgetData = {};
    for (let month = 1; month <= 12; month++) {
        const monthData = yearlyResultsData[month];
        if (monthData) {
            const daysInMonth = new Date(targetDate.getFullYear(), month, 0).getDate();
            calculatedData[month] = calculateParentTotals(monthData, daysInMonth);
        }
    }
    return calculatedData;
  }, [yearlyResultsData, granularity, targetDate, calculateParentTotals]);

  const daysInMonth = useMemo(() => new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate(), [targetDate]);
  
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => currentYear - 2 + i);
  const months = Array.from({length: 12}, (_, i) => i + 1);
  
  const handleDateChange = (year: number, month?: number) => {
      if (granularity === '月次') {
        if (targetDate.getFullYear() !== year) {
          setTargetDate(new Date(year, 0, 1));
        }
      } else {
        setTargetDate(new Date(year, (month || 1) - 1, 1));
      }
  };

  const getDayValue = (data: DailyBudgetData | null, itemId: string, day: number) => data?.[itemId]?.[day] ?? 0;
  const getMonthTotal = (data: DailyBudgetData | null, itemId: string) => {
      if (!data || !data[itemId]) return 0;
      return Object.values(data[itemId]).reduce((sum, val) => sum + val, 0);
  }

  return (
    <div className="space-y-6">
      <AddItemModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddItem}
        parentItems={budgetItems.filter(i => !i.isEditable)}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <h1 className="text-2xl font-bold">実績入力</h1>
      
      <Card title="操作対象の選択">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="media-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">メディア</label>
              <select id="media-select" value={selectedMedia} onChange={e => setSelectedMedia(e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                  {mediaNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
             <div>
                 <label htmlFor="year-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{granularity === '月次' ? '対象年' : '対象年月'}</label>
                 <div className="flex items-center space-x-2">
                      <select id="year-select" aria-label="Year" value={targetDate.getFullYear()} onChange={e => handleDateChange(parseInt(e.target.value), targetDate.getMonth() + 1)} className="block w-full rounded-md border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                          {years.map(y => <option key={y} value={y}>{y}年</option>)}
                      </select>
                      {granularity === '日次' && (
                        <select aria-label="Month" value={targetDate.getMonth() + 1} onChange={e => handleDateChange(targetDate.getFullYear(), parseInt(e.target.value))} className="block w-full rounded-md border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                            {months.map(m => <option key={m} value={m}>{m}月</option>)}
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
      </Card>
      
      <Card title="実績入力グリッド" >
        <div className="flex justify-end mb-4">
            <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                <PlusIcon className="w-5 h-5" />
                項目を追加
            </button>
        </div>
        {isLoading ? (
          <div className="text-center p-8">データを読み込み中...</div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-full text-sm border-collapse border border-slate-200 dark:border-white/10">
              <thead className="bg-slate-50 dark:bg-white/5">
                <tr>
                  <th className="sticky left-0 bg-slate-100 dark:bg-slate-800 z-20 p-2 border border-slate-200 dark:border-white/10 min-w-[200px] text-left">実績項目</th>
                  <th className="sticky left-[200px] bg-slate-100 dark:bg-slate-800 z-20 p-2 border border-slate-200 dark:border-white/10 min-w-[120px] text-center font-semibold">{granularity === '月次' ? '年間合計' : '月間合計'}</th>
                  {granularity === '月次' && months.map(month => <th key={month} className="p-2 border border-slate-200 dark:border-white/10 text-center font-semibold min-w-[100px]">{month}月</th>)}
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
                          {months.reduce((total, month) => {
                            return total + getMonthTotal(calculatedYearlyData?.[month] ?? null, item.id);
                          }, 0).toLocaleString()}
                        </span>
                      )}
                      {granularity === '日次' && (
                        <span>{getMonthTotal(calculatedDailyData, item.id).toLocaleString()}</span>
                      )}
                    </td>
                    
                    {granularity === '月次' && months.map(month => (
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
                                value={getDayValue(resultsData, item.id, day).toLocaleString()}
                                onChange={e => handleResultChange(item.id, day, e.target.value.replace(/,/g, ''))}
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

export default ResultsPage;