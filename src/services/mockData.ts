import type { FamilyMember, Task } from '@/types';

export const availableTasks: Task[] = [
  { id: 'dishes', title: 'Lavar los platos', points: 15, quotaLabel: '2/3 hoy', status: 'available' },
  { id: 'dog', title: 'Pasear al perro', points: 20, quotaLabel: '3/5 semana', status: 'last-slot' },
  { id: 'room', title: 'Aspirar sala', points: 25, quotaLabel: '0/1 hoy', status: 'available' },
  { id: 'trash', title: 'Sacar la basura', points: 10, quotaLabel: '0/1 hoy', status: 'available' },
  { id: 'bathroom', title: 'Limpiar baño', points: 30, quotaLabel: '0/1 semana', status: 'available' },
  { id: 'beds', title: 'Tender camas', points: 10, quotaLabel: '1/1 hoy', status: 'available' },
];

export const completedTasks: Task[] = [
  { id: 'trash-done', title: 'Sacar la basura', points: 10, quotaLabel: '10 min', status: 'completed' },
  { id: 'kitchen-done', title: 'Limpiar la cocina', points: 25, quotaLabel: '30 min', status: 'completed' },
];

export const familyMembers: FamilyMember[] = [
  { id: 'gabriel', name: 'Gabriel', initial: 'G', points: 450, goal: 450, note: 'Meta cumplida · 🔥 5 sem', avatarTone: 'coral' },
  { id: 'dad', name: 'Papá', initial: 'P', points: 420, goal: 600, note: 'Excedió por 20 pts · ↑ Subió', avatarTone: 'blue' },
  { id: 'mom', name: 'Mamá', initial: 'M', points: 380, goal: 400, note: 'Faltan 20 pts', avatarTone: 'teal' },
  { id: 'sofia', name: 'Sofía', initial: 'S', points: 290, goal: 350, note: 'Faltan 60 pts · ↓ Bajó', avatarTone: 'violet' },
];
