import { supabase } from '../../../../services/supabaseClient'
import { getCurrentUserId } from '../../../../services/authUser';

function isValidDateString(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isValidTimeString(time) {
  return typeof time === 'string' && /^\d{2}:\d{2}$/.test(time);
}

export async function getEventsForDate(date) {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  if (!isValidDateString(date)) return [];

  const { data, error } = await supabase
    .from('daily_planner_events')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getEventsForMonth(year, month) {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const safeYear = Number(year);
  const safeMonth = Number(month);
  if (!Number.isInteger(safeYear) || !Number.isInteger(safeMonth) || safeMonth < 1 || safeMonth > 12) return [];

  const mm = String(safeMonth).padStart(2, '0');
  const startDate = `${safeYear}-${mm}-01`;
  const lastDay = new Date(safeYear, safeMonth, 0).getDate();
  const endDate = `${safeYear}-${mm}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('daily_planner_events')
    .select('date')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addEvent({ date, startTime, endTime, title, color }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const safeTitle = typeof title === 'string' ? title.trim() : '';
  if (!safeTitle) throw new Error('Titel fehlt.');
  if (!isValidDateString(date)) throw new Error('Ungültiges Datum.');
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) throw new Error('Ungültige Uhrzeit.');

  const { data, error } = await supabase
    .from('daily_planner_events')
    .insert({
      user_id: userId,
      date,
      start_time: startTime,
      end_time: endTime,
      title: safeTitle,
      color: color || '#D4AF37',
    })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Termin konnte nicht gespeichert werden.');
  return data;
}

export async function deleteEvent(id) {
  if (!id) return;

  const { error } = await supabase
    .from('daily_planner_events')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateEvent({ id, startTime, endTime, title, color }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');
  if (!id) throw new Error('Termin fehlt.');

  const safeTitle = typeof title === 'string' ? title.trim() : '';
  if (!safeTitle) throw new Error('Titel fehlt.');
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) throw new Error('Ungültige Uhrzeit.');

  const { data, error } = await supabase
    .from('daily_planner_events')
    .update({
      start_time: startTime,
      end_time: endTime,
      title: safeTitle,
      color: color || '#D4AF37',
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('Termin konnte nicht aktualisiert werden. Keine passende Zeile gefunden.');
  }

  return data;
}
