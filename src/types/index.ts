import type { AvatarKey } from '@/theme';

export type TaskStatus = 'available' | 'completed' | 'last-slot' | 'done-today' | 'exhausted' | 'inactive';

export type Task = {
  id: string;
  title: string;
  points: number;
  quotaLabel: string;
  status?: TaskStatus;
};

export type FamilyMember = {
  id: string;
  name: string;
  initial: string;
  points: number;
  goal: number;
  note?: string;
  avatarTone?: AvatarKey;
};
