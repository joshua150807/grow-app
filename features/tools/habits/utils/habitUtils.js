export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function getTodayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getDateForDayIndex(dayIndex) {
  const today = new Date();
  const todayDow = today.getDay();
  const targetDow = dayIndex === 6 ? 0 : dayIndex + 1;

  const diff = targetDow - todayDow;
  const date = new Date(today);
  date.setDate(today.getDate() + diff);

  return formatLocalDate(date);
}

export function getAllDayIndexes() {
  return [0, 1, 2, 3, 4, 5, 6];
}
