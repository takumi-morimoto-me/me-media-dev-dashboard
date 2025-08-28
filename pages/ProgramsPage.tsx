import React, { useState, useMemo } from 'react';
import { Program } from '../types';
import { mockPrograms, ASP_NAMES, CATEGORIES } from '../data/mockData';
import ProgramFormModal from '../components/ProgramFormModal';
import { EditIcon, TrashIcon } from '../components/icons';
import Card from '../components/Card';

const ProgramsPage: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>(mockPrograms);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [programToEdit, setProgramToEdit] = useState<Program | null>(null);
  
  const [filterAsp, setFilterAsp] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPrograms = useMemo(() => {
    return programs.filter(p => 
      (filterAsp === '' || p.aspName === filterAsp) &&
      (filterCategory === '' || p.category === filterCategory) &&
      (searchTerm === '' || p.programName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [programs, filterAsp, filterCategory, searchTerm]);

  const handleAddProgram = () => {
    setProgramToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditProgram = (program: Program) => {
    setProgramToEdit(program);
    setIsModalOpen(true);
  };
  
  const handleDeleteProgram = (id: number) => {
      if (window.confirm('この案件を本当に削除しますか？')) {
        setPrograms(programs.filter(p => p.id !== id));
      }
  };

  const handleSaveProgram = (program: Program) => {
    const index = programs.findIndex(p => p.id === program.id);
    if (index > -1) {
      setPrograms(programs.map(p => p.id === program.id ? program : p));
    } else {
      setPrograms([...programs, program]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <ProgramFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProgram}
        programToEdit={programToEdit}
      />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">連携案件の管理</h1>
        <button
          onClick={handleAddProgram}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          新規案件を登録
        </button>
      </div>

      <Card title="検索フィルター">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select value={filterAsp} onChange={e => setFilterAsp(e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
              <option value="">すべてのASP</option>
              {ASP_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
              <option value="">すべてのカテゴリ</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <input type="text" placeholder="プログラム名で検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
         </div>
      </Card>

      <Card title="登録済み案件一覧">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-white/5">
              <tr>
                <th scope="col" className="px-6 py-3">ASP名</th>
                <th scope="col" className="px-6 py-3">プログラム名</th>
                <th scope="col" className="px-6 py-3">カテゴリ</th>
                <th scope="col" className="px-6 py-3">ステータス</th>
                <th scope="col" className="px-6 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrograms.map((program) => (
                <tr key={program.id} className="bg-white dark:bg-transparent border-b border-slate-200 dark:border-white/10 hover:bg-slate-50/50 dark:hover:bg-white/5">
                  <td className="px-6 py-4">{program.aspName}</td>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-50 whitespace-nowrap">{program.programName}</td>
                  <td className="px-6 py-4">{program.category}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${program.status === '有効' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'}`}>
                      {program.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex items-center space-x-3">
                    <button onClick={() => handleEditProgram(program)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"><EditIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleDeleteProgram(program.id)} className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
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

export default ProgramsPage;