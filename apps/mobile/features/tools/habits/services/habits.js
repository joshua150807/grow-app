import { supabase } from '../../../../services/supabaseClient';
import { getCurrentUserId } from '../../../../services/authUser';

const habitCompletionListeners = new Set();

export function subscribeToHabitCompletionChanges(listener) {
  if (typeof listener !== 'function') return () => {};

  habitCompletionListeners.add(listener);
  return () => habitCompletionListeners.delete(listener);
}

function notifyHabitCompletionChange() {
  habitCompletionListeners.forEach(listener => listener());
}

function normalizeDays(days) {
  if (!Array.isArray(days)) return [];

  return Array.from(new Set(days
    .map(day => Number(day))
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
  )).sort((a, b) => a - b);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function calculateHabitStreak(habits, completions, today = new Date()) {
  const activeHabits = (Array.isArray(habits) ? habits : []).filter(habit => (
    habit?.id &&
    !habit.archived_at &&
    habit.is_active !== false &&
    habit.disabled !== true
  ));
  const byDate = new Map();

  for (const completion of Array.isArray(completions) ? completions : []) {
    if (!completion?.completed_date || !completion?.habit_id) continue;

    const done = byDate.get(completion.completed_date) ?? new Set();
    done.add(completion.habit_id);
    byDate.set(completion.completed_date, done);
  }

  const localToday = new Date(today);
  localToday.setHours(12, 0, 0, 0);

  let streak = 0;

  for (let i = 0; i < 90; i++) {
    const date = new Date(localToday);
    date.setDate(localToday.getDate() - i);

    const dateStr = formatLocalDate(date);
    const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const scheduled = activeHabits.filter(habit => (
      normalizeDays(habit.days).includes(dayOfWeek)
    ));

    if (scheduled.length === 0) continue;

    const done = byDate.get(dateStr) ?? new Set();
    const isComplete = scheduled.every(habit => done.has(habit.id));

    // Ein noch laufender heutiger Tag beendet den bestehenden Streak nicht.
    if (i === 0 && !isComplete) continue;

    if (!isComplete) break;
    streak += 1;
  }

  return streak;
}

function normalizeLinkedToolPayload(linkedTool = null, { includeEmptyValues = false } = {}) {
  if (linkedTool?.id && linkedTool?.title && linkedTool?.route) {
    return {
      linked_tool_id: linkedTool.id,
      linked_tool_title: linkedTool.title,
      linked_tool_route: linkedTool.route,
    };
  }

  return includeEmptyValues
    ? {
        linked_tool_id: null,
        linked_tool_title: null,
        linked_tool_route: null,
      }
    : {};
}

function isMissingLinkedToolColumnError(error) {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`;

  return error?.code === 'PGRST204' || message.includes('linked_tool_');
}

async function resolveUserId(expectedUserId = null) {
  const userId = await getCurrentUserId();
  if (!userId || (expectedUserId && userId !== expectedUserId)) {
    throw new Error('Nicht eingeloggt');
  }
  return userId;
}

export async function getHabits(expectedUserId = null) {
  const userId = await resolveUserId(expectedUserId);

  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addHabit(name, days, linkedTool = null, expectedUserId = null) {
  const userId = await resolveUserId(expectedUserId);

  const safeName = typeof name === 'string' ? name.trim() : '';
  const safeDays = normalizeDays(days);
  if (!safeName) throw new Error('Name fehlt.');
  if (safeDays.length === 0) throw new Error('Keine Tage ausgewählt.');

  const insertPayload = {
    user_id: userId,
    name: safeName,
    days: safeDays,
    ...normalizeLinkedToolPayload(linkedTool),
  };

  const { data, error } = await supabase
    .from('habits')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Gewohnheit konnte nicht gespeichert werden.');
  return data;
}


export async function updateHabit(id, name, days, linkedTool = null, expectedUserId = null) {
  if (!id) throw new Error('Ungültige Gewohnheit.');

  const userId = await resolveUserId(expectedUserId);

  const safeName = typeof name === 'string' ? name.trim() : '';
  const safeDays = normalizeDays(days);
  if (!safeName) throw new Error('Name fehlt.');
  if (safeDays.length === 0) throw new Error('Keine Tage ausgewählt.');

  const updatePayload = {
    name: safeName,
    days: safeDays,
    ...normalizeLinkedToolPayload(linkedTool, { includeEmptyValues: true }),
  };

  const runUpdate = (payload) => supabase
    .from('habits')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  let { data, error } = await runUpdate(updatePayload);

  // Falls die bestehende Supabase-Tabelle noch keine linked_tool_* Spalten hat,
  // darf das reine Bearbeiten von Name/Tagen trotzdem nicht scheitern.
  // Sobald die Spalten existieren, wird der volle Payload inkl. Tool-Link gespeichert.
  if (error && isMissingLinkedToolColumnError(error)) {
    ({ data, error } = await runUpdate({
      name: safeName,
      days: safeDays,
    }));
  }

  if (error) throw error;
  if (!data) throw new Error('Gewohnheit konnte nicht aktualisiert werden.');
  return data;
}

export async function deleteHabit(id, expectedUserId = null) {
  if (!id) return;

  const userId = await resolveUserId(expectedUserId);

  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}

// Gibt alle habit_ids zurück, die am angegebenen Datum (YYYY-MM-DD) abgehakt sind
export async function getCompletionsForDate(date, expectedUserId = null) {
  const userId = await resolveUserId(expectedUserId);

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
    .select('*')
    .eq('user_id', userId);
  if (hErr || !Array.isArray(habits) || habits.length === 0) return 0;

  const today = new Date();
  const since = new Date(today);
  since.setDate(today.getDate() - 90);

  const { data: completions, error: cErr } = await supabase
    .from('habit_completions')
    .select('habit_id, completed_date')
    .eq('user_id', userId)
    .gte('completed_date', formatLocalDate(since));
  if (cErr) return 0;

  return calculateHabitStreak(habits, completions, today);
}

export async function getTodayHabitProgress() {
  const userId = await getCurrentUserId();
  if (!userId) return { completed: 0, total: 0 };

  const today = new Date();
  const dateStr = formatLocalDate(today);
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
export async function toggleCompletion(habitId, date, isCompleted, expectedUserId = null) {
  const userId = await resolveUserId(expectedUserId);
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

  notifyHabitCompletionChange();
}
