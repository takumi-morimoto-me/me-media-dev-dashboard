import React from 'react';
import { ChartBarIcon } from '../components/icons';

interface LoginPageProps {
  onLogin: () => void;
}

const GoogleIcon = () => (
    <svg className="w-5 h-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
        <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 111.8 512 0 398.2 0 256S111.8 0 244 0c73 0 134.3 29.4 178.6 72.9l-63.4 62.3C337 99.8 294.6 79.4 244 79.4c-69.6 0-126.5 57.3-126.5 128.2s56.9 128.2 126.5 128.2c76.3 0 115.3-48.4 119.8-73.4H244V261.8h244z"></path>
    </svg>
);


const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center">
      <div className="max-w-md w-full bg-white dark:bg-slate-900/50 dark:border dark:border-white/10 shadow-lg rounded-lg p-8 text-center">
        <div className="flex justify-center mx-auto items-center w-16 h-16 bg-primary-100 dark:bg-primary-900/50 rounded-full mb-4">
             <ChartBarIcon className="h-10 w-10 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">予実管理ダッシュボード</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">ログインしてダッシュボードにアクセスします。</p>
        <button
          onClick={onLogin}
          className="w-full inline-flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md font-semibold text-slate-700 dark:text-slate-200 transition-colors"
        >
          <GoogleIcon />
          <span>Googleでログイン</span>
        </button>
      </div>
       <p className="text-xs text-slate-500 dark:text-slate-400 mt-6">
        モックアップ：このボタンをクリックすると認証をスキップしてダッシュボードに遷移します。
      </p>
    </div>
  );
};

export default LoginPage;