import { supabase } from '@/supabase';
import { avatarAccentColors, avatarKeys, colors, normalizeAvatarKey, type AvatarKey } from '@/theme';
import { getHomeSummary } from './home';

type WeeklyResultRow = {
  week_start: string | null;
  member_id: string | null;
  member_name: string | null;
  earned_points: number | null;
  target_points: number | null;
  goal_reached: boolean | null;
  consequence: string | null;
};

type CompletionRow = {
  id: string;
  task_id: string;
  member_id: string;
  points_awarded: number;
  completed_at: string;
  week_start: string;
};

export type WeeklyHistoryMember = {
  id: string;
  name: string;
  initial: string;
  avatarTone: AvatarKey;
  color: string;
  points: number;
  goal: number;
  goalReached: boolean;
};

export type WeeklyHistoryActivity = {
  id: string;
  memberId: string | null;
  color: string;
  text: string;
  dateLabel: string;
};

export type WeeklyHistoryWeek = {
  weekStart: string;
  weekNumber: number;
  label: string;
  rangeLabel: string;
  goalLabel: string;
  reachedCount: number;
  members: WeeklyHistoryMember[];
  consequence: string | null;
  activities: WeeklyHistoryActivity[];
};

function weekNumber(weekStart: string) {
  const date = new Date(`${weekStart}T12:00:00Z`);
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.ceil(day / 7);
}

const shortDateFormatter = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short' });
function rangeLabel(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return `${shortDateFormatter.format(start)} - ${shortDateFormatter.format(end)}`;
}

function goalLabel(members: WeeklyHistoryMember[]) {
  const goals = [...new Set(members.map((member) => member.goal))];
  return goals.length === 1 ? `Meta: ${goals[0]} pts` : 'Metas personales';
}

function buildActivities(
  weekStart: string,
  members: WeeklyHistoryMember[],
  completions: CompletionRow[],
) {
  const activities: WeeklyHistoryActivity[] = [];
  const reached = members.filter((member) => member.goalReached).length;
  const total = members.length;

  if (total > 0) {
    activities.push({
      id: `${weekStart}-summary`,
      memberId: null,
      color: colors.primary,
      text: `${reached} de ${total} alcanzaron su meta`,
      dateLabel: rangeLabel(weekStart),
    });
  }

  const topMember = [...members].sort((left, right) => right.points - left.points)[0];
  if (topMember && topMember.points > 0) {
    activities.push({
      id: `${weekStart}-top-${topMember.id}`,
      memberId: topMember.id,
      color: topMember.color,
      text: `${topMember.name} lideró la semana con ${topMember.points} pts`,
      dateLabel: rangeLabel(weekStart),
    });
  }

  const completionCountByMember = completions.reduce((counts, completion) => {
    counts.set(completion.member_id, (counts.get(completion.member_id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const maxTaskCount = Math.max(0, ...completionCountByMember.values());
  const taskLeaders = members.filter((member) => completionCountByMember.get(member.id) === maxTaskCount);
  if (maxTaskCount > 0 && taskLeaders.length > 0) {
    const leaderNames = taskLeaders.map((member) => member.name);
    const label = leaderNames.length === 1
      ? `${leaderNames[0]} completó más tareas: ${maxTaskCount}`
      : `${leaderNames.join(' y ')} empataron con ${maxTaskCount} tareas`;
    activities.push({
      id: `${weekStart}-tasks`,
      memberId: taskLeaders.length === 1 ? taskLeaders[0].id : null,
      color: taskLeaders.length === 1 ? taskLeaders[0].color : colors.primary,
      text: label,
      dateLabel: rangeLabel(weekStart),
    });
  }

  const strongestOverGoal = members
    .filter((member) => member.goal > 0 && member.points > member.goal)
    .sort((left, right) => (right.points - right.goal) - (left.points - left.goal))[0];
  if (strongestOverGoal) {
    activities.push({
      id: `${weekStart}-over-${strongestOverGoal.id}`,
      memberId: strongestOverGoal.id,
      color: strongestOverGoal.color,
      text: `${strongestOverGoal.name} superó su meta por ${strongestOverGoal.points - strongestOverGoal.goal} pts`,
      dateLabel: rangeLabel(weekStart),
    });
  }

  return activities.slice(0, 4);
}

export async function getWeeklyHistory(): Promise<WeeklyHistoryWeek[]> {
  const home = await getHomeSummary();
  const results = await supabase
    .from('weekly_member_results')
    .select('week_start, member_id, member_name, earned_points, target_points, goal_reached, consequence')
    .lt('week_start', home.weekStart)
    .order('week_start', { ascending: false });
  if (results.error) throw results.error;

  const rows = results.data.filter((row): row is WeeklyResultRow & { week_start: string; member_id: string; member_name: string } => (
    Boolean(row.week_start && row.member_id && row.member_name)
  ));
  const weekStarts = [...new Set(rows.map((row) => row.week_start))];
  if (weekStarts.length === 0) return [];

  const memberIds = [...new Set(rows.map((row) => row.member_id))];
  const [membersResult, completionsResult] = await Promise.all([
    supabase.from('family_members').select('id, avatar_key').in('id', memberIds),
    supabase.from('task_completions').select('id, task_id, member_id, points_awarded, completed_at, week_start').in('week_start', weekStarts).order('completed_at', { ascending: false }),
  ]);
  if (membersResult.error) throw membersResult.error;
  if (completionsResult.error) throw completionsResult.error;

  const completionRows = completionsResult.data as CompletionRow[];
  const toneByMember = new Map(membersResult.data.map((member) => [member.id, normalizeAvatarKey(member.avatar_key)]));

  return weekStarts.map((weekStart) => {
    const weekRows = rows.filter((row) => row.week_start === weekStart);
    const members = weekRows.map<WeeklyHistoryMember>((row, index) => {
      const tone = toneByMember.get(row.member_id) ?? avatarKeys[index % avatarKeys.length];
      const points = row.earned_points ?? 0;
      const goal = row.target_points ?? 0;
      return {
        id: row.member_id,
        name: row.member_name,
        initial: row.member_name.charAt(0).toUpperCase(),
        avatarTone: tone,
        color: avatarAccentColors[tone],
        points,
        goal,
        goalReached: row.goal_reached === true,
      };
    }).sort((left, right) => right.points - left.points || left.name.localeCompare(right.name, 'es'));
    const weekCompletions = completionRows.filter((completion) => completion.week_start === weekStart);

    return {
      weekStart,
      weekNumber: weekNumber(weekStart),
      label: `Sem ${weekNumber(weekStart)}`,
      rangeLabel: rangeLabel(weekStart),
      goalLabel: goalLabel(members),
      reachedCount: members.filter((member) => member.goalReached).length,
      members,
      consequence: weekRows.find((row) => row.consequence)?.consequence ?? null,
      activities: buildActivities(weekStart, members, weekCompletions),
    };
  });
}
