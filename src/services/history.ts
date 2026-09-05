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
const weekdayFormatter = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'short', day: 'numeric', month: 'short' });

function rangeLabel(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return `${shortDateFormatter.format(start)} - ${shortDateFormatter.format(end)}`;
}

function dateLabel(value: string) {
  const label = weekdayFormatter.format(new Date(value));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function phraseIndex(seed: string, count: number) {
  let total = 0;
  for (let index = 0; index < seed.length; index += 1) total += seed.charCodeAt(index);
  return total % count;
}

function completionText(completion: CompletionRow, memberName: string, taskName: string) {
  const variants = [
    `${memberName} completó ${taskName}`,
    `${memberName} sumó +${completion.points_awarded} pts con ${taskName}`,
    `${taskName} le dio +${completion.points_awarded} pts a ${memberName}`,
  ];
  return variants[phraseIndex(`${completion.id}-${completion.completed_at}`, variants.length)];
}

function goalLabel(members: WeeklyHistoryMember[]) {
  const goals = [...new Set(members.map((member) => member.goal))];
  return goals.length === 1 ? `Meta: ${goals[0]} pts` : 'Metas personales';
}

function buildActivities(
  weekStart: string,
  members: WeeklyHistoryMember[],
  completions: CompletionRow[],
  taskNames: Map<string, string>,
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
      text: `${topMember.name} fue quien más puntos sumó esta semana`,
      dateLabel: rangeLabel(weekStart),
    });
  }

  members.forEach((member) => {
    if (member.goal <= 0) return;
    if (member.points > member.goal) {
      activities.push({
        id: `${weekStart}-over-${member.id}`,
        memberId: member.id,
        color: member.color,
        text: `${member.name} superó su meta por ${member.points - member.goal} pts`,
        dateLabel: rangeLabel(weekStart),
      });
    } else if (!member.goalReached && member.goal - member.points <= 50) {
      activities.push({
        id: `${weekStart}-near-${member.id}`,
        memberId: member.id,
        color: member.color,
        text: `${member.name} quedó a ${member.goal - member.points} pts de su meta`,
        dateLabel: rangeLabel(weekStart),
      });
    }
  });

  completions.slice(0, 6).forEach((completion) => {
    const member = members.find((candidate) => candidate.id === completion.member_id);
    if (!member) return;
    activities.push({
      id: completion.id,
      memberId: member.id,
      color: member.color,
      text: completionText(completion, member.name, taskNames.get(completion.task_id) ?? 'una tarea'),
      dateLabel: dateLabel(completion.completed_at),
    });
  });

  return activities.slice(0, 8);
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
  const taskIds = [...new Set(completionRows.map((completion) => completion.task_id))];
  const tasksResult = taskIds.length > 0
    ? await supabase.from('tasks').select('id, title').in('id', taskIds)
    : { data: [], error: null };
  if (tasksResult.error) throw tasksResult.error;

  const toneByMember = new Map(membersResult.data.map((member) => [member.id, normalizeAvatarKey(member.avatar_key)]));
  const taskNames = new Map(tasksResult.data.map((task) => [task.id, task.title]));

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
      activities: buildActivities(weekStart, members, weekCompletions, taskNames),
    };
  });
}
