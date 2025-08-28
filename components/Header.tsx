import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { LogoutIcon, ChevronDownIcon, SunIcon, MoonIcon } from './icons';

interface HeaderProps {
  onLogout: () => void;
  theme: string;
  toggleTheme: () => void;
  mediaNames: string[];
  onAddMedia: (name: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onLogout, theme, toggleTheme, mediaNames, onAddMedia }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const linkClass = "px-3 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/10";
  const activeLinkClass = "bg-slate-200/50 dark:bg-white/10 text-primary-600 dark:text-primary-400";

  const isDashboardActive = location.pathname === '/' || location.pathname.startsWith('/media');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleAddDashboardClick = () => {
    const newName = prompt('新しいダッシュボードの名前を入力してください:');
    if (newName) {
      onAddMedia(newName);
      setIsDropdownOpen(false);
    }
  };


  return (
    <header className="bg-background/80 dark:bg-dark-background/80 backdrop-blur-sm sticky top-0 z-30 border-b border-slate-200 dark:border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <div className="hidden md:block">
              <div className="flex items-baseline space-x-4">
                 <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`${linkClass} ${isDashboardActive ? activeLinkClass : ''} flex items-center gap-1`}
                  >
                    <span>ダッシュボード選択</span>
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute mt-2 w-56 max-h-96 overflow-y-auto rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 z-20">
                      <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        <Link to="/" onClick={() => setIsDropdownOpen(false)} className={`block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 ${location.pathname === '/' ? 'bg-slate-100 dark:bg-slate-700' : ''} hover:bg-slate-100 dark:hover:bg-slate-700`}>
                          全体ダッシュボード
                        </Link>
                         <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                        {mediaNames.map(name => (
                          <Link key={name} to={`/media/${name}`} onClick={() => setIsDropdownOpen(false)} className={`block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 ${location.pathname === `/media/${name}` ? 'bg-slate-100 dark:bg-slate-700' : ''} hover:bg-slate-100 dark:hover:bg-slate-700`}>
                            {name}
                          </Link>
                        ))}
                         <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                         <button
                           onClick={handleAddDashboardClick}
                           className="w-full text-left block px-4 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold"
                         >
                           + 新規ダッシュボード追加
                         </button>
                      </div>
                    </div>
                  )}
                </div>
                <NavLink to="/programs" className={({ isActive }) => isActive ? `${linkClass} ${activeLinkClass}` : linkClass}>
                  連携案件の管理
                </NavLink>
                <NavLink to="/budgets" className={({ isActive }) => isActive ? `${linkClass} ${activeLinkClass}` : linkClass}>
                  予算管理
                </NavLink>
                 <NavLink to="/results" className={({ isActive }) => isActive ? `${linkClass} ${activeLinkClass}` : linkClass}>
                  実績管理
                </NavLink>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/10 focus:outline-none"
                    aria-label="Toggle theme"
                >
                    {theme === 'light' ? <MoonIcon className="h-6 w-6" /> : <SunIcon className="h-6 w-6" />}
                </button>
                <button
                onClick={onLogout}
                className="ml-3 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/10"
                >
                <LogoutIcon className="h-5 w-5" />
                <span>ログアウト</span>
                </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;