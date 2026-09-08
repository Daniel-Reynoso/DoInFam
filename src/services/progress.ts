import { supabase } from '@/supabase';
import { normalizeAvatarKey } from '@/theme';
import type { FamilyMember } from '@/types';
import { getHomeSummary } from './home';

type AvatarTone = NonNullable<FamilyMember['avatarTone']>;

export type FamilyProgress = {
  familyName: string;
  weekStart: string;
  reachedCount: number;
  activeCount: number;
  restingCount: number;
  members: FamilyMember[];
  consequence: string | null;
};

export type ProfileActivity = { id: string; taskName: string; points: number; completedAt: string };
export type ProfileSummary = {
  familyName: string;
  rank: number;
  streak: number;
  completionPercent: number;
  points: number;
  goal: number;
  activities: ProfileActivity[];
};

function avatarTone(value: string): AvatarTone {
  return normalizeAvatarKey(value);
}

export async function getFamilyProgress(): Promise<FamilyProgress> {
  const summary = await getHomeSummary();
  const [familyResult, membersResult, resultsResult, weekResult] = await Promise.all([
    supabase.from('families').select('name').single(),
    supabase.from('family_members').select('id, name, avatar_key').eq('is_active', true),
    supabase.from('weekly_member_results').select('member_id, earned_points, target_points, is_resting').eq('week_start', summary.weekStart),
    supabase.from('family_weeks').select('consequence').eq('week_start', summary.weekStart).maybeSingle(),
  ]);
  if (familyResult.error) throw familyResult.error;
  if (membersResult.error) throw membersResult.error;
  if (resultsResult.error) throw resultsResult.error;
  if (weekResult.error) throw weekResult.error;

  const resultByMember = new Map(resultsResult.data.map((result) => [result.member_id, result]));
  const members = membersResult.data.map<FamilyMember>((member) => {
    const result = resultByMember.get(member.id);
    const points = result?.earned_points ?? 0;
    const goal = result?.target_points ?? 0;
    const isResting = result?.is_resting === true;
    return {
      id: member.id,
      name: member.name,
      initial: member.name.charAt(0).toUpperCase(),
      avatarTone: avatarTone(member.avatar_key),
      points,
      goal,
      isResting,
      note: isResting ? 'En descanso' : points >= goal && goal > 0 ? undefined : goal > 0 ? `Faltan ${Math.max(goal - points, 0)} pts` : 'Meta sin configurar',
    };
  }).sort((left, right) => right.points - left.points || left.name.localeCompare(right.name, 'es'));

  return {
    familyName: familyResult.data.name,
    weekStart: summary.weekStart,
    reachedCount: members.filter((member) => !member.isResting && member.goal > 0 && member.points >= member.goal).length,
    activeCount: members.filter((member) => !member.isResting).length,
    restingCount: members.filter((member) => member.isResting).length,
    members,
    consequence: weekResult.data?.consequence ?? null,
  };
}

export async function getProfileSummary(memberId: string): Promise<ProfileSummary> {
  const home = await getHomeSummary();
  const [familyResult, currentResultsResult, historyResult, completionsResult] = await Promise.all([
    supabase.from('families').select('name').single(),
    supabase.from('weekly_member_results').select('member_id, earned_points').eq('week_start', home.weekStart).order('earned_points', { ascending: false }),
    supabase.from('weekly_member_results').select('week_start, goal_reached, is_resting').eq('member_id', memberId).order('week_start', { ascending: false }),
    supabase.from('task_completions').select('id, task_id, points_awarded, completed_at').eq('member_id', memberId).eq('week_start', home.weekStart).order('completed_at', { ascending: false }).limit(20),
  ]);
  if (familyResult.error) throw familyResult.error;
  if (currentResultsResult.error) throw currentResultsResult.error;
  if (historyResult.error) throw historyResult.error;
  if (completionsResult.error) throw completionsResult.error;

  const taskIds = [...new Set(completionsResult.data.map((completion) => completion.task_id))];
  const tasksResult = taskIds.length > 0 ? await supabase.from('tasks').select('id, title').in('id', taskIds) : { data: [], error: null };
  if (tasksResult.error) throw tasksResult.error;
  const taskNames = new Map(tasksResult.data.map((task) => [task.id, task.title]));

  const orderedHistory = [...historyResult.data];
  const currentWeekIndex = orderedHistory.findIndex((week) => week.week_start === home.weekStart);
  const streakCandidates = currentWeekIndex >= 0 && orderedHistory[currentWeekIndex]?.goal_reached !== true
    ? orderedHistory.slice(currentWeekIndex + 1)
    : currentWeekIndex >= 0 ? orderedHistory.slice(currentWeekIndex) : orderedHistory;
  let streak = 0;
  for (const week of streakCandidates) {
    if (week.is_resting === true) continue;
    if (week.goal_reached !== true) break;
    streak += 1;
  }

  const rankIndex = currentResultsResult.data.findIndex((result) => result.member_id === memberId);
  return {
    familyName: familyResult.data.name,
    rank: rankIndex >= 0 ? rankIndex + 1 : 1,
    streak,
    completionPercent: home.goal > 0 ? Math.min(100, Math.round((home.points / home.goal) * 100)) : 0,
    points: home.points,
    goal: home.goal,
    activities: completionsResult.data.map((completion) => ({ id: completion.id, taskName: taskNames.get(completion.task_id) ?? 'Tarea', points: completion.points_awarded, completedAt: completion.completed_at })),
  };
}
