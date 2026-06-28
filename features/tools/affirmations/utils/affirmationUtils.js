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
    text: 'Ich bin glücklich und dankbar für meinen Reichtum und für das Traumleben, das daraus resultiert.',
    category: 'Erfolg',
  },
  {
    text: 'Ich bin glücklich und dankbar dafür, ein guter Mensch zu sein und für meinen Glauben an Jesus Christus.',
    category: 'Ruhe',
  },
  {
    text: 'Ich bin glücklich und dankbar für meine hochintelligente, gutherzige, gläubige, ambitionierte, wunderschöne Frau und für meine beiden tollen Söhne und meine bezaubernde Tochter.',
    category: 'Erfolg',
  },
  {
    text: 'Ich bin unendlich glücklich und dankbar für meinen Bruder, meine Familie und meine Freunde und für jeden Erfolg und glücklichen Moment in ihrem Leben.',
    category: 'Erfolg',
  },
  {
    text: 'Ich bin glücklich und dankbar für meine eigene Stiftung und für alles Gute, was ich auf dieser Erde tun kann.',
    category: 'Erfolg',
  },
  {
    text: 'Ich bin glücklich und dankbar für den Namen und das Vermächtnis, das ich meinen Geliebten eines Tages hinterlasse.',
    category: 'Erfolg',
  },
  {
    text: 'Ich bin glücklich und dankbar dafür, dass ich genau weiß, wer ich bin und was ich will, und für die Chance, alles zu erreichen, was ich mir je erträumt habe.',
    category: 'Selbstvertrauen',
  },
  {
    text: 'Ich bin froh und dankbar, jeden Tag meine Ziele zu erreichen.',
    category: 'Disziplin',
  },
  {
    text: 'Ich bin froh und dankbar: Zu keinem Zeitpunkt war ich meinem Ziel näher als jetzt.',
    category: 'Fokus',
  },
  {
    text: 'Ich glaube und weiß mit Sicherheit, dass sich alle meine Träume, positiven Gedanken und Ziele erfüllen werden.',
    category: 'Erfolg',
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
