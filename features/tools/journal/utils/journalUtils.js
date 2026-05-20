export const JOURNAL_QUESTIONS = {
  gratitude: 'Wofür bin ich heute dankbar?',
  didWell: 'Was habe ich heute gut gemacht?',
  improveTomorrow: 'Was kann ich morgen besser machen?',
};

export function toLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLastSevenJournalDays() {
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);

    const iso = toLocalDateString(date);
    const label = index === 0
      ? 'Heute'
      : index === 1
        ? 'Gestern'
        : date.toLocaleDateString('de-DE', { weekday: 'short' });

    const shortDate = date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    });

    return {
      iso,
      label,
      shortDate,
    };
  });
}

export function getJournalCutoffDate() {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return toLocalDateString(date);
}

export function formatEntryTime(value) {
  if (!value) return '';

  return new Date(value).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isJournalEntryValid(entry) {
  return Boolean(
    entry.gratitude?.trim() ||
    entry.didWell?.trim() ||
    entry.improveTomorrow?.trim() ||
    entry.missedHabits?.trim()
  );
}