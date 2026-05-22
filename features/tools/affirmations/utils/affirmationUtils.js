export const AFFIRMATION_CATEGORIES = [
  'Disziplin',
  'Fokus',
  'Selbstvertrauen',
  'Erfolg',
  'Körper',
  'Ruhe',
];

export const AFFIRMATION_SUGGESTIONS = [
  {
    text: 'Ich halte Versprechen an mich selbst.',
    category: 'Disziplin',
  },
  {
    text: 'Ich handle auch dann, wenn ich keine Motivation spüre.',
    category: 'Disziplin',
  },
  {
    text: 'Ich bleibe fokussiert auf das, was mich wirklich weiterbringt.',
    category: 'Fokus',
  },
  {
    text: 'Ich werde jeden Tag mehr zu der Person, die ihre Ziele verdient.',
    category: 'Erfolg',
  },
  {
    text: 'Ich vertraue mir, weil ich mir selbst beweise, dass ich durchziehe.',
    category: 'Selbstvertrauen',
  },
  {
    text: 'Ich trainiere meinen Körper und meinen Charakter.',
    category: 'Körper',
  },
  {
    text: 'Ich reagiere ruhig, klar und kontrolliert.',
    category: 'Ruhe',
  },
  {
    text: 'Ich bin nicht meine Ausreden. Ich bin meine Entscheidungen.',
    category: 'Disziplin',
  },
];

export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function isRepeatedToday(affirmation) {
  return affirmation?.last_repeated_date === getTodayIsoDate();
}

export function normalizeAffirmationText(text) {
  return (text ?? '').trim().replace(/\s+/g, ' ');
}
