import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className }) => {
  return (
    <div className={`bg-white dark:bg-slate-900/50 rounded-lg shadow-sm dark:shadow-none p-4 sm:p-6 dark:border dark:border-white/10 ${className}`}>
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</h3>
      <div className="mt-1">
        {children}
      </div>
    </div>
  );
};

export default Card;