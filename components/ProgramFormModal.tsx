import React, { useState, useEffect } from 'react';
import { Program } from '../types';
import { CATEGORIES, ASP_NAMES } from '../data/mockData';

interface ProgramFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (program: Program) => void;
  programToEdit: Program | null;
}

const ProgramFormModal: React.FC<ProgramFormModalProps> = ({ isOpen, onClose, onSave, programToEdit }) => {
  const [formData, setFormData] = useState<Omit<Program, 'id'>>({
    aspName: ASP_NAMES[0],
    programName: '',
    category: CATEGORIES[0],
    status: '有効',
  });

  useEffect(() => {
    if (programToEdit) {
      setFormData(programToEdit);
    } else {
      setFormData({
        aspName: ASP_NAMES[0],
        programName: '',
        category: CATEGORIES[0],
        status: '有効',
      });
    }
  }, [programToEdit, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleToggle = () => {
      setFormData(prev => ({...prev, status: prev.status === '有効' ? '無効' : '有効'}));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: programToEdit?.id || Date.now(), // Use existing ID or generate a new one
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center">
      <div className="bg-background dark:bg-dark-background dark:border dark:border-white/10 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h2 className="text-xl font-bold mb-6">
          {programToEdit ? '案件の編集' : '新規案件の登録'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="aspName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">ASP名</label>
              <select id="aspName" name="aspName" value={formData.aspName} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md">
                {ASP_NAMES.map(name => <option key={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="programName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">プログラム名</label>
              <input type="text" id="programName" name="programName" value={formData.programName} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-slate-800" />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-slate-700 dark:text-slate-300">カテゴリ</label>
              <select id="category" name="category" value={formData.category} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md">
                {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ステータス</label>
                <div className="mt-2 flex items-center">
                    <button type="button" onClick={handleToggle} className={`${formData.status === '有効' ? 'bg-primary-600' : 'bg-gray-400 dark:bg-slate-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`} role="switch" aria-checked={formData.status === '有効'}>
                        <span className={`${formData.status === '有効' ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
                    </button>
                    <span className="ml-3 text-sm">{formData.status}</span>
                </div>
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

export default ProgramFormModal;