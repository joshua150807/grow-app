export const JOURNAL_QUESTIONS = {
  gratitude: 'Wofür bin ich heute dankbar?',
  didWell: 'Was habe ich heute gut gemacht?',
  improveTomorrow: 'Was kann ich morgen besser machen?',
};

export const JOURNAL_STARTER_PAGES = [
  {
    key: 'current_life_status',
    title: 'Mein aktueller Lebensstand',
    eyebrow: 'Startseite 01',
    description: 'Halte ehrlich fest, wo du gerade stehst. Ohne schönreden. Ohne Drama.',
    placeholder: 'Wie läuft dein Leben aktuell? Was ist stark? Was belastet dich? Was willst du nicht mehr akzeptieren?',
  },
  {
    key: 'who_i_am_now',
    title: 'Wer bin ich aktuell?',
    eyebrow: 'Startseite 02',
    description: 'Beschreibe die Person, die du gerade bist: deine Gewohnheiten, Stärken, Schwächen und Standards.',
    placeholder: 'Wer bist du aktuell? Wie handelst du, wenn es schwer wird? Worauf bist du stolz? Wo belügst du dich noch?',
  },
  {
    key: 'who_i_am_in_five_years',
    title: 'Wer bin ich in 5 Jahren?',
    eyebrow: 'Startseite 03',
    description: 'Formuliere dein Zukunftsbild so konkret, dass du daran gemessen werden kannst.',
    placeholder: 'Wie sieht dein Leben in 5 Jahren aus? Wie trainierst du? Wie arbeitest du? Wie lebst du? Welche Person bist du geworden?',
  },
  {
    key: 'what_must_change',
    title: 'Was muss ich verändern?',
    eyebrow: 'Startseite 04',
    description: 'Schreibe die Dinge auf, die dich aktuell zurückhalten und die du nicht länger mitschleppen willst.',
    placeholder: 'Welche Muster müssen weg? Welche Entscheidungen schiebst du auf? Was musst du ab heute anders machen?',
  },
];

export function toLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysToIsoDate(isoDate, amount) {
  const date = parseLocalDate(isoDate);
  date.setDate(date.getDate() + amount);
  return toLocalDateString(date);
}

export function isFutureJournalDate(isoDate) {
  return isoDate > toLocalDateString();
}

export function formatJournalDate(isoDate) {
  const date = parseLocalDate(isoDate);
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortJournalDate(isoDate) {
  const date = parseLocalDate(isoDate);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function getRelativeDayLabel(isoDate) {
  const today = toLocalDateString();
  const yesterday = addDaysToIsoDate(today, -1);
  const tomorrow = addDaysToIsoDate(today, 1);

  if (isoDate === today) return 'Heute';
  if (isoDate === yesterday) return 'Gestern';
  if (isoDate === tomorrow) return 'Morgen';

  return parseLocalDate(isoDate).toLocaleDateString('de-DE', { weekday: 'long' });
}

export function getJournalTocDays(entries = []) {
  const today = toLocalDateString();
  const dates = new Set();

  for (let index = -30; index <= 14; index += 1) {
    dates.add(addDaysToIsoDate(today, index));
  }

  entries.forEach(entry => {
    if (entry.entry_date) {
      dates.add(entry.entry_date);
    }
  });

  return Array.from(dates)
    .sort((a, b) => b.localeCompare(a))
    .map(iso => ({
      iso,
      label: getRelativeDayLabel(iso),
      shortDate: formatShortJournalDate(iso),
      isFuture: isFutureJournalDate(iso),
    }));
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
