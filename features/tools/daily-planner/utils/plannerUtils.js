import { Dimensions } from 'react-native';
import { s, sv } from '../../../../constants/layout';

export const SCREEN_WIDTH = Dimensions.get('window').width;

// 30 Minuten = 28px.
// Dadurch sind ca. 12 Stunden gleichzeitig sichtbar.
export const SLOT_HEIGHT = sv(28);

export const TIME_LABEL_WIDTH = s(58);
export const TOTAL_SLOTS = 48;
export const MINUTES_PER_SLOT = 30;
export const DAY_MINUTES = 24 * 60;

export const EVENT_COLORS = [
  { key: 'gold', label: 'Gold', value: '#D4AF37' },
  { key: 'blue', label: 'Blau', value: '#4A90E2' },
  { key: 'green', label: 'Grün', value: '#2ECC71' },
  { key: 'red', label: 'Rot', value: '#FF6B6B' },
  { key: 'purple', label: 'Lila', value: '#9B59B6' },
  { key: 'orange', label: 'Orange', value: '#F39C12' },
];

export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export const DAY_NAMES_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const DAY_NAMES_LONG = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag',
];

export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

export function minutesToTime(totalMins) {
  const capped = Math.max(0, Math.min(totalMins, DAY_MINUTES - 1));
  const h = Math.floor(capped / 60);
  const m = capped % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(time) {
  if (!time) return 0;

  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

export function slotToTime(slot) {
  return minutesToTime(slot * MINUTES_PER_SLOT);
}

export function slotToMinutes(slot) {
  return Math.max(0, Math.min(slot * MINUTES_PER_SLOT, DAY_MINUTES - 1));
}

export function dateToDayMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function dayMinutesToDate(minutes) {
  const safeMinutes = Math.max(0, Math.min(minutes ?? 0, DAY_MINUTES - 1));
  const date = new Date();

  date.setHours(Math.floor(safeMinutes / 60));
  date.setMinutes(safeMinutes % 60);
  date.setSeconds(0);
  date.setMilliseconds(0);

  return date;
}

export function formatDurationLabel(totalMinutes) {
  const safeMinutes = Math.max(1, Math.min(totalMinutes, DAY_MINUTES - 1));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours === 0) return `${minutes} Min`;
  if (minutes === 0) return `${hours} Std`;
  return `${hours} Std ${minutes} Min`;
}

export function formatDayHeader(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);

  return `${DAY_NAMES_LONG[date.getDay()]}, ${date.getDate()}. ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function buildCalendarCells(year, month) {
  const first = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();

  let startDow = first.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells = [];

  for (let i = 0; i < startDow; i += 1) cells.push(null);
  for (let day = 1; day <= lastDate; day += 1) cells.push(day);

  return cells;
}

function eventsOverlap(a, b) {
  const aStart = timeToMinutes(a.start_time);
  const aEnd = timeToMinutes(a.end_time);
  const bStart = timeToMinutes(b.start_time);
  const bEnd = timeToMinutes(b.end_time);

  return aStart < bEnd && bStart < aEnd;
}

function buildOverlapGroups(events) {
  const sorted = [...events].sort((a, b) => {
    const startDiff = timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
    if (startDiff !== 0) return startDiff;

    return timeToMinutes(a.end_time) - timeToMinutes(b.end_time);
  });

  const groups = [];

  sorted.forEach(event => {
    const start = timeToMinutes(event.start_time);
    const end = timeToMinutes(event.end_time);

    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || start >= lastGroup.maxEnd) {
      groups.push({
        events: [event],
        maxEnd: end,
      });
      return;
    }

    lastGroup.events.push(event);
    lastGroup.maxEnd = Math.max(lastGroup.maxEnd, end);
  });

  return groups;
}

function assignColumns(groupEvents) {
  const columns = [];
  const result = [];

  groupEvents.forEach(event => {
    let columnIndex = columns.findIndex(lastEventInColumn => !eventsOverlap(lastEventInColumn, event));

    if (columnIndex === -1) {
      columnIndex = columns.length;
      columns.push(event);
    } else {
      columns[columnIndex] = event;
    }

    result.push({
      event,
      columnIndex,
    });
  });

  const columnCount = Math.max(columns.length, 1);

  return result.map(item => ({
    ...item.event,
    layout: {
      columnIndex: item.columnIndex,
      columnCount,
    },
  }));
}

export function applyEventOverlapLayout(events) {
  const groups = buildOverlapGroups(events);

  return groups.flatMap(group => assignColumns(group.events));
}