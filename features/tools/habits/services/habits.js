import { supabase } from '../../../../services/supabaseClient';

async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user?.id ?? null;
}

function normalizeDays(days) {
  if (!Array.isArray(days)) return [];

  return Array.from(new Set(days
    .map(day => Number(day))
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
  )).sort((a, b) => a - b);
}

export async function getHabits() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addHabit(name, days, linkedTool = null) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const safeName = typeof name === 'string' ? name.trim() : '';
  const safeDays = normalizeDays(days);
  if (!safeName) throw new Error('Name fehlt.');
  if (safeDays.length === 0) throw new Error('Keine Tage ausgewählt.');

  const linkedToolPayload = linkedTool?.id && linkedTool?.title && linkedTool?.route
    ? {
        linked_tool_id: linkedTool.id,
        linked_tool_title: linkedTool.title,
        linked_tool_route: linkedTool.route,
      }
    : {
        linked_tool_id: null,
        linked_tool_title: null,
        linked_tool_route: null,
      };

  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: userId,
      name: safeName,
      days: safeDays,
      ...linkedToolPayload,
    })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Gewohnheit konnte nicht gespeichert werden.');
  return data;
}

export async function deleteHabit(id) {
  if (!id) return;

  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Gibt alle habit_ids zurück, die am angegebenen Datum (YYYY-MM-DD) abgehakt sind
export async function getCompletionsForDate(date) {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('habit_completions')
    .select('habit_id')
    .eq('user_id', userId)
    .eq('completed_date', date);

  if (error) throw error;
  return Array.isArray(data) ? data.map(r => r.habit_id).filter(Boolean) : [];
}

export async function getHabitStreak() {
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  const { data: habits, error: hErr } = await supabase
    .from('habits')
    .select('id, days')
    .eq('user_id', userId);
  if (hErr || !Array.isArray(habits) || habits.length === 0) return 0;

  const today = new Date();
  const since = new Date(today);
  since.setDate(today.getDate() - 90);

  const { data: completions, error: cErr } = await supabase
    .from('habit_completions')
    .select('habit_id, completed_date')
    .eq('user_id', userId)
    .gte('completed_date', since.toISOString().split('T')[0]);
  if (cErr) return 0;

  const byDate = {};
  for (const c of completions ?? []) {
    if (!c?.completed_date || !c?.habit_id) continue;
    if (!byDate[c.completed_date]) byDate[c.completed_date] = new Set();
    byDate[c.completed_date].add(c.habit_id);
  }

  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const scheduled = habits.filter(h => normalizeDays(h.days).includes(dow));
    if (scheduled.length === 0) continue;
    const done = byDate[dateStr] ?? new Set();
    if (scheduled.every(h => done.has(h.id))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function getTodayHabitProgress() {
  const userId = await getCurrentUserId();
  if (!userId) return { completed: 0, total: 0 };

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;

  const { data: habits, error: hErr } = await supabase
    .from('habits')
    .select('id, days')
    .eq('user_id', userId);

  if (hErr || !Array.isArray(habits)) return { completed: 0, total: 0 };

  const scheduled = habits.filter(h => normalizeDays(h.days).includes(dow));
  if (scheduled.length === 0) return { completed: 0, total: 0 };

  const { data: completions, error: cErr } = await supabase
    .from('habit_completions')
    .select('habit_id')
    .eq('user_id', userId)
    .eq('completed_date', dateStr);

  if (cErr || !Array.isArray(completions)) return { completed: 0, total: scheduled.length };

  const doneIds = new Set(completions.map(c => c.habit_id).filter(Boolean));
  const completed = scheduled.filter(h => doneIds.has(h.id)).length;
  return { completed, total: scheduled.length };
}

// isCompleted=true → Eintrag anlegen, false → löschen
export async function toggleCompletion(habitId, date, isCompleted) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');
  if (!habitId || !date) throw new Error('Ungültige Gewohnheit.');

  if (isCompleted) {
    const { error } = await supabase
      .from('habit_completions')
      .insert({ habit_id: habitId, user_id: userId, completed_date: date });
    if (error && error.code !== '23505') throw error; // 23505 = unique violation (bereits vorhanden)
  } else {
    const { error } = await supabase
      .from('habit_completions')
      .delete()
      .eq('habit_id', habitId)
      .eq('user_id', userId)
      .eq('completed_date', date);
    if (error) throw error;
  }
}
