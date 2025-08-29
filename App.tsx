import React, { useState, useCallback, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MediaDashboardPage from './pages/MediaDashboardPage';
import ProgramsPage from './pages/ProgramsPage';
import BudgetsPage from './pages/BudgetsPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import Header from './components/Header';
import { MediaBudget, User, BudgetItem, Program } from './types';
import { mockDetailedMediaBudgets, MEDIA_NAMES, mockPrograms } from './data/mockData';
import { initialBudgetItems } from './data/budgetMockData';
import { mockUsers } from './data/userData';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // --- Global State Management ---
  const [theme, setTheme] = useState('light');
  
  // Settings: Basic
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState<number>(4);
  const [currentFiscalPeriod, setCurrentFiscalPeriod] = useState<number>(20); // e.g. 20th period
  const [users, setUsers] = useState<User[]>(mockUsers);
  
  // Settings: Master Data
  const [mediaNames, setMediaNames] = useState<string[]>(MEDIA_NAMES);
  const [mediaBudgetItems, setMediaBudgetItems] = useState<{ [mediaName: string]: BudgetItem[] }>(() => {
    const initialItems: { [mediaName: string]: BudgetItem[] } = {};
    MEDIA_NAMES.forEach(name => {
      initialItems[name] = JSON.parse(JSON.stringify(initialBudgetItems));
    });
    return initialItems;
  });
  const [programs, setPrograms] = useState<Program[]>(mockPrograms);

  // Settings: Automation
  const [notificationSettings, setNotificationSettings] = useState({ error_notification_to: '' });

  // Dashboard Data (remains as mock)
  const [budgets, setBudgets] = useState<MediaBudget[]>(() => 
    JSON.parse(JSON.stringify(mockDetailedMediaBudgets))
  );

  useEffect(() => {
    // Load settings from localStorage
    const storedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (storedTheme) {
        setTheme(storedTheme);
    } else {
        setTheme(systemPrefersDark ? 'dark' : 'light');
    }
    
    const storedMonth = localStorage.getItem('fiscalYearStartMonth');
    if (storedMonth) {
        setFiscalYearStartMonth(parseInt(storedMonth, 10));
    }
    const storedPeriod = localStorage.getItem('currentFiscalPeriod');
    if (storedPeriod) {
        setCurrentFiscalPeriod(parseInt(storedPeriod, 10));
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleFiscalYearStartMonthChange = (month: number) => {
    setFiscalYearStartMonth(month);
    localStorage.setItem('fiscalYearStartMonth', month.toString());
  };

  const handleCurrentFiscalPeriodChange = (period: number) => {
    setCurrentFiscalPeriod(period);
    localStorage.setItem('currentFiscalPeriod', period.toString());
  };

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleLogin = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  return (
    <HashRouter>
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      ) : (
        <div className="min-h-screen flex flex-col">
          <Header onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} mediaNames={mediaNames} />
          <main className="flex-grow p-4 sm:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<DashboardPage budgets={budgets} />} />
              <Route path="/media/:mediaName" element={<MediaDashboardPage budgets={budgets} setBudgets={setBudgets} />} />
              <Route path="/programs" element={<ProgramsPage programs={programs} setPrograms={setPrograms}/>} />
              <Route 
                path="/budgets" 
                element={<BudgetsPage 
                  mediaNames={mediaNames} 
                  fiscalYearStartMonth={fiscalYearStartMonth} 
                  mediaBudgetItems={mediaBudgetItems}
                />} 
              />
              <Route 
                path="/results" 
                element={<ResultsPage 
                  mediaNames={mediaNames} 
                  fiscalYearStartMonth={fiscalYearStartMonth} 
                  mediaBudgetItems={mediaBudgetItems}
                />} 
              />
              <Route 
                path="/settings" 
                element={<SettingsPage 
                  // Basic Settings
                  fiscalYearStartMonth={fiscalYearStartMonth}
                  onFiscalYearStartMonthChange={handleFiscalYearStartMonthChange}
                  currentFiscalPeriod={currentFiscalPeriod}
                  onCurrentFiscalPeriodChange={handleCurrentFiscalPeriodChange}
                  users={users}
                  setUsers={setUsers}
                  // Master Data
                  mediaNames={mediaNames}
                  setMediaNames={setMediaNames}
                  mediaBudgetItems={mediaBudgetItems}
                  setMediaBudgetItems={setMediaBudgetItems}
                  programs={programs}
                  setPrograms={setPrograms}
                  // Automation
                  notificationSettings={notificationSettings}
                  setNotificationSettings={setNotificationSettings}
                />} 
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      )}
    </HashRouter>
  );
}

export default App;