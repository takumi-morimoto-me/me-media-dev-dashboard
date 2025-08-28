import React, { useState, useCallback, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MediaDashboardPage from './pages/MediaDashboardPage';
import ProgramsPage from './pages/ProgramsPage';
import BudgetsPage from './pages/BudgetsPage';
import ResultsPage from './pages/ResultsPage';
import Header from './components/Header';
import { MediaBudget } from './types';
import { mockDetailedMediaBudgets, MEDIA_NAMES } from './data/mockData';
import { salesBudgetItems } from './data/budgetMockData';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mediaNames, setMediaNames] = useState<string[]>(MEDIA_NAMES);
  const [budgets, setBudgets] = useState<MediaBudget[]>(() => 
    JSON.parse(JSON.stringify(mockDetailedMediaBudgets))
  );
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (storedTheme) {
        setTheme(storedTheme);
    } else {
        setTheme(systemPrefersDark ? 'dark' : 'light');
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

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleLogin = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const handleAddMedia = (newMediaName: string) => {
    const trimmedName = newMediaName.trim();
    if (!trimmedName) {
        alert('ダッシュボード名を入力してください。');
        return;
    }
    if (mediaNames.includes(trimmedName)) {
        alert('その名前のダッシュボードは既に存在します。');
        return;
    }

    setMediaNames(prev => [...prev, trimmedName]);
    
    const newSalesBudgets: Record<string, number> = {};
    salesBudgetItems.forEach((item, j) => {
        const budget = Math.round(((150000) * (1 / (j + 2))) * (0.8 + Math.random() * 0.4) / 1000) * 1000;
        newSalesBudgets[item.id] = budget > 10000 ? budget : 10000;
    });

    const newMediaBudget: MediaBudget = { mediaName: trimmedName, salesBudgets: newSalesBudgets };

    setBudgets(prev => [...prev, newMediaBudget]);
  };


  return (
    <HashRouter>
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      ) : (
        <div className="min-h-screen flex flex-col">
          <Header onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} mediaNames={mediaNames} onAddMedia={handleAddMedia} />
          <main className="flex-grow p-4 sm:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<DashboardPage budgets={budgets} />} />
              <Route path="/media/:mediaName" element={<MediaDashboardPage budgets={budgets} setBudgets={setBudgets} />} />
              <Route path="/programs" element={<ProgramsPage />} />
              <Route path="/budgets" element={<BudgetsPage mediaNames={mediaNames} />} />
              <Route path="/results" element={<ResultsPage mediaNames={mediaNames} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      )}
    </HashRouter>
  );
}

export default App;