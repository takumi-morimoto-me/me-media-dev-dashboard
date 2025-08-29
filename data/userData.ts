import { User } from '../types';

export const mockUsers: User[] = [
  {
    id: 1,
    email: 'admin@example.com',
    role: '管理者',
  },
  {
    id: 2,
    email: 'manager@example.com',
    role: '事業部責任者',
  },
  {
    id: 3,
    email: 'leader-beginners@example.com',
    role: '部門責任者',
    assignedMedia: ['ビギナーズ'],
  },
  {
    id: 4,
    email: 'leader-multi@example.com',
    role: '部門責任者',
    assignedMedia: ['最安修理', 'Mortorz'],
  },
];
