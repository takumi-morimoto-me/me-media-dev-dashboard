import React, { useState, useEffect } from 'react';
import { BudgetItem } from '../types';

interface BudgetItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  itemToEdit: BudgetItem | null;
  parentItem: BudgetItem | null;
}

const BudgetItemFormModal: React.FC<BudgetItemFormModalProps> = ({ isOpen, onClose, onSave, itemToEdit, parentItem }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(itemToEdit?.name || '');
    }
  }, [isOpen, itemToEdit]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim());
  };

  const title = itemToEdit ? '項目名を編集' : (parentItem ? `新規項目を「${parentItem.name}」に追加` : '新規大項目を追加');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center" aria-modal="true" role="dialog">
      <div className="bg-background dark:bg-dark-background dark:border dark:border-white/10 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h2 className="text-xl font-bold mb-6">{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="item-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">項目名</label>
              <input type="text" id="item-name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-slate-800" autoFocus />
            </div>
          </div>
          <div className="mt-8 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-white dark:bg-slate-700 py-2 px-4 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              キャンセル
            </button>
            <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BudgetItemFormModal;