import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { User, Role, Program, BotStatus } from '../types';
import { TrashIcon, EditIcon, PlusIcon } from '../components/icons';
import { mockBotStatuses } from '../data/mockData';

type Tab = '基本設定' | 'マスターデータ' | '自動化・通知';

interface SettingsPageProps {
    // Basic Settings
    fiscalYearStartMonth: number;
    onFiscalYearStartMonthChange: (month: number) => void;
    currentFiscalPeriod: number;
    onCurrentFiscalPeriodChange: (period: number) => void;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    // Master Data
    mediaNames: string[];
    setMediaNames: React.Dispatch<React.SetStateAction<string[]>>;
    programs: Program[];
    setPrograms: React.Dispatch<React.SetStateAction<Program[]>>;
    // Automation
    notificationSettings: { error_notification_to: string };
    setNotificationSettings: React.Dispatch<React.SetStateAction<{ error_notification_to: string }>>;
}

const SettingsPage: React.FC<SettingsPageProps> = (props) => {
    const [activeTab, setActiveTab] = useState<Tab>('基本設定');
    const [showSuccess, setShowSuccess] = useState('');

    const displaySuccessMessage = (message: string) => {
        setShowSuccess(message);
        setTimeout(() => setShowSuccess(''), 3000);
    }
    
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">共通設定</h1>
            
            <div className="border-b border-gray-200 dark:border-white/10">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {(['基本設定', 'マスターデータ', '自動化・通知'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`${
                                activeTab === tab
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {showSuccess && 
                <div className="fixed top-20 right-5 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md shadow-lg z-50" role="alert">
                    <strong className="font-bold">成功: </strong>
                    <span className="block sm:inline">{showSuccess}</span>
                </div>
            }

            <div>
                {activeTab === '基本設定' && <BasicSettingsTab {...props} onSuccess={displaySuccessMessage} />}
                {activeTab === 'マスターデータ' && <MasterDataTab {...props} onSuccess={displaySuccessMessage} />}
                {activeTab === '自動化・通知' && <AutomationTab {...props} onSuccess={displaySuccessMessage} />}
            </div>

        </div>
    );
};

// --- Basic Settings Tab ---
const BasicSettingsTab: React.FC<Pick<SettingsPageProps, 'fiscalYearStartMonth'|'onFiscalYearStartMonthChange'|'currentFiscalPeriod'|'onCurrentFiscalPeriodChange'|'users'|'setUsers'> & {onSuccess: (msg: string) => void}> = 
({ fiscalYearStartMonth, onFiscalYearStartMonthChange, currentFiscalPeriod, onCurrentFiscalPeriodChange, users, setUsers, onSuccess }) => {
    const [localStartMonth, setLocalStartMonth] = useState(fiscalYearStartMonth);
    const [localPeriod, setLocalPeriod] = useState(currentFiscalPeriod);

    const handlePeriodSave = () => {
        onFiscalYearStartMonthChange(localStartMonth);
        onCurrentFiscalPeriodChange(localPeriod);
        onSuccess("会計期間の設定を保存しました。");
    };

    const periods = Array.from({length: 10}, (_, i) => currentFiscalPeriod - 5 + i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    
    // User Management state can be added here
    // For brevity, it will be a simple display for now.

    return (
        <div className="space-y-8">
            <Card title="会計期間（期）の設定">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="current-period" className="block text-sm font-medium text-slate-700 dark:text-slate-300">現在の会計期</label>
                        <select id="current-period" value={localPeriod} onChange={e => setLocalPeriod(parseInt(e.target.value))} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md">
                            {periods.map(p => <option key={p} value={p}>{p}期</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="start-month" className="block text-sm font-medium text-slate-700 dark:text-slate-300">期首月</label>
                        <select id="start-month" value={localStartMonth} onChange={e => setLocalStartMonth(parseInt(e.target.value))} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md">
                           {months.map(m => <option key={m} value={m}>{m}月</option>)}
                        </select>
                    </div>
                </div>
                 <div className="mt-6 flex justify-end">
                    <button onClick={handlePeriodSave} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                        保存
                    </button>
                </div>
            </Card>

            <Card title="ユーザーと権限の管理">
                {/* A full implementation would have modals for add/edit */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-white/5">
                      <tr>
                        <th scope="col" className="px-6 py-3">ユーザー（メールアドレス）</th>
                        <th scope="col" className="px-6 py-3">役割（ロール）</th>
                        <th scope="col" className="px-6 py-3">担当メディア</th>
                        <th scope="col" className="px-6 py-3"><span className="sr-only">操作</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id} className="bg-white dark:bg-transparent border-b border-slate-200 dark:border-white/10">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-50">{user.email}</td>
                          <td className="px-6 py-4">{user.role}</td>
                          <td className="px-6 py-4">{user.assignedMedia?.join(', ') || 'N/A'}</td>
                          <td className="px-6 py-4 text-right space-x-4">
                            <button className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"><EditIcon className="w-5 h-5"/></button>
                            <button className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end">
                  <button className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                    <PlusIcon className="w-5 h-5"/>新規ユーザー追加
                  </button>
                </div>
            </Card>
        </div>
    );
};

// --- Master Data Tab ---
const MasterDataTab: React.FC<Pick<SettingsPageProps, 'mediaNames'|'setMediaNames'|'programs'|'setPrograms'> & {onSuccess: (msg: string) => void}> = 
({ mediaNames, setMediaNames, programs, setPrograms, onSuccess }) => {
    
    // --- Media Management ---
    const handleAddMedia = () => {
        const name = prompt("新しいメディア名を入力してください:");
        if (name && !mediaNames.includes(name)) {
            setMediaNames(prev => [...prev, name]);
            onSuccess(`メディア「${name}」を追加しました。`);
        } else if (name) {
            alert("そのメディアは既に存在します。");
        }
    };

    const handleDeleteMedia = (nameToDelete: string) => {
        if (window.confirm(`メディア「${nameToDelete}」を削除しますか？`)) {
            setMediaNames(prev => prev.filter(name => name !== nameToDelete));
            onSuccess(`メディア「${nameToDelete}」を削除しました。`);
        }
    };
    
    return (
        <div className="space-y-8">
            <Card title="メディア管理">
                 <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-white/5">
                      <tr>
                        <th scope="col" className="px-6 py-3">メディア名</th>
                        <th scope="col" className="px-6 py-3"><span className="sr-only">操作</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mediaNames.map(name => (
                        <tr key={name} className="bg-white dark:bg-transparent border-b border-slate-200 dark:border-white/10">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-50">{name}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeleteMedia(name)} className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                 <div className="mt-4 flex justify-end">
                  <button onClick={handleAddMedia} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                    <PlusIcon className="w-5 h-5"/>新規メディア追加
                  </button>
                </div>
            </Card>

             <Card title="案件メディア紐付け">
                 <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-white/5">
                      <tr>
                        <th scope="col" className="px-6 py-3">ASP名</th>
                        <th scope="col" className="px-6 py-3">案件名</th>
                        <th scope="col" className="px-6 py-3">担当メディア</th>
                        <th scope="col" className="px-6 py-3"><span className="sr-only">操作</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {programs.map(p => (
                        <tr key={p.id} className="bg-white dark:bg-transparent border-b border-slate-200 dark:border-white/10">
                           <td className="px-6 py-4">{p.aspName}</td>
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-50">{p.programName}</td>
                          <td className="px-6 py-4">{p.assignedMedia || '未割り当て'}</td>
                           <td className="px-6 py-4 text-right">
                            <button className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"><EditIcon className="w-5 h-5"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </Card>
        </div>
    );
};

// --- Automation & Notifications Tab ---
const AutomationTab: React.FC<Pick<SettingsPageProps, 'notificationSettings'|'setNotificationSettings'> & {onSuccess: (msg: string) => void}> = 
({ notificationSettings, setNotificationSettings, onSuccess }) => {
    const [localSettings, setLocalSettings] = useState(notificationSettings);
    const [botStatuses, setBotStatuses] = useState<BotStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simulate fetching bot statuses
        setTimeout(() => {
            setBotStatuses(mockBotStatuses);
            setIsLoading(false);
        }, 500);
    }, []);

    const handleSave = () => {
        setNotificationSettings(localSettings);
        onSuccess("通知設定を保存しました。");
    };

    const handleRefresh = () => {
        setIsLoading(true);
        setTimeout(() => {
            // Simulate refresh with slightly different data
            const updatedStatuses = mockBotStatuses.map(s => ({
                ...s,
                lastRun: new Date().toLocaleString('ja-JP'),
                status: Math.random() > 0.1 ? '成功' : '失敗' as '成功' | '失敗'
            }));
            setBotStatuses(updatedStatuses);
            setIsLoading(false);
        }, 700);
    };

    return (
        <div className="space-y-8">
             <Card title="通知設定">
                 <div>
                    <label htmlFor="error-notify" className="block text-sm font-medium text-slate-700 dark:text-slate-300">エラー通知先</label>
                    <input type="text" id="error-notify" value={localSettings.error_notification_to} onChange={e => setLocalSettings({error_notification_to: e.target.value})} placeholder="Slackチャンネル名 or メールアドレス" className="mt-1 block w-full md:w-1/2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-slate-800" />
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={handleSave} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                        保存
                    </button>
                </div>
             </Card>
             <Card title="Botの実行ステータス">
                <div className="flex justify-end mb-4">
                    <button onClick={handleRefresh} disabled={isLoading} className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50">
                        {isLoading ? '更新中...' : '最新の情報に更新'}
                    </button>
                </div>
                {isLoading ? <div className="text-center p-4">読み込み中...</div> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-white/5">
                            <tr>
                                <th scope="col" className="px-6 py-3">Bot名</th>
                                <th scope="col" className="px-6 py-3">最終実行日時</th>
                                <th scope="col" className="px-6 py-3">ステータス</th>
                            </tr>
                            </thead>
                            <tbody>
                            {botStatuses.map(bot => (
                                <tr key={bot.name} className="bg-white dark:bg-transparent border-b border-slate-200 dark:border-white/10">
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-50">{bot.name}</td>
                                <td className="px-6 py-4">{bot.lastRun}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${bot.status === '成功' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'}`}>
                                        {bot.status}
                                    </span>
                                </td>
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


export default SettingsPage;