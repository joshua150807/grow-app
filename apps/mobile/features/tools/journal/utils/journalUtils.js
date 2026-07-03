export const JOURNAL_QUESTIONS = {
  gratitude: 'Wofür bin ich heute dankbar?',
  didWell: 'Was habe ich heute gut gemacht?',
  improveTomorrow: 'Was kann ich morgen besser machen?',
};

export const JOURNAL_STARTER_PAGES = [
  {
    key: 'dream_life',
    title: 'Wie würde dein absolutes Traumleben aussehen?',
    eyebrow: 'Frage 01',
    description: 'Beschreibe dein Traumleben so konkret wie möglich. Denke nicht klein und schreibe nicht das, was realistisch klingt, sondern das, was du wirklich wollen würdest.',
    prompts: [
      'Wie würde deine finanzielle Situation aussehen?',
      'Wie würde dein Körper aussehen? Wie gesund, fit und leistungsfähig wärst du?',
      'Mit welchen Menschen würdest du dein Leben verbringen? Wie würde deine Traumfrau oder dein Traummann aussehen? Wie viele Kinder hättest du? Wie wäre dein Verhältnis zu deiner Familie und deinen Freunden? Würdest du Haustiere besitzen?',
      'Was für ein Mensch wärst du? Welche Eigenschaften würdest du besitzen?',
      'Wie würdest du wollen, dass dich andere Menschen wahrnehmen oder beschreiben? Soll man dich respektieren, bewundern, als Vorbild ansehen oder von deiner Ausstrahlung beeindruckt sein?',
      'Würdest du überhaupt noch arbeiten wollen? Wenn ja, welcher Tätigkeit würdest du nachgehen? Oder würdest du lieber eine Stiftung gründen, anderen Menschen helfen oder auf eine andere Weise einen positiven Einfluss auf die Welt haben?',
      'Wo würdest du leben? Wie würde dein Haus aussehen? Welche Autos würdest du fahren? Würdest du eine Yacht, einen Privatjet oder andere Luxusgüter besitzen wollen?',
      'Welche Orte auf der Welt möchtest du sehen? Welche Erfahrungen möchtest du unbedingt gemacht haben? Welche Erlebnisse dürfen in deinem Leben auf keinen Fall fehlen?',
      'Was möchtest du deinen Kindern, deiner Familie oder der Welt hinterlassen? Wie möchtest du in Erinnerung bleiben? Welches Vermächtnis möchtest du einmal hinterlassen?',
    ],
    placeholder: 'Schreibe hier dein absolutes Traumleben auf. Je konkreter, desto stärker wird diese Seite.',
    exampleAnswer: '',
  },
  {
    key: 'best_life_moments',
    title: 'Was waren bisher die schönsten Momente deines Lebens?',
    eyebrow: 'Frage 02',
    description: 'Gehe zurück zu den Momenten, in denen du dich wirklich lebendig, glücklich oder erfüllt gefühlt hast. Erkenne, was diese Momente gemeinsam hatten.',
    prompts: [
      'Wann warst du in deinem Leben am glücklichsten?',
      'Welche Momente haben dich besonders erfüllt?',
      'Mit welchen Menschen warst du zusammen?',
      'Was genau hat diese Momente so besonders gemacht?',
      'Welche Gefühle hast du dabei gespürt?',
      'Welche Erlebnisse würdest du sofort noch einmal erleben wollen?',
    ],
    placeholder: 'Schreibe die schönsten Momente deines Lebens auf und beschreibe, warum sie für dich so besonders waren.',
    exampleAnswer: '',
  },
  {
    key: 'deepest_gratitude',
    title: 'Wofür bist du in deinem Leben am dankbarsten?',
    eyebrow: 'Frage 03',
    description: 'Richte deinen Fokus bewusst auf das, was du bereits hast. Schreibe ehrlich, detailliert und nicht nur oberflächlich.',
    prompts: [
      'Für welche Menschen in deinem Leben bist du dankbar?',
      'Für welche Momente bist du dankbar?',
      'Welche Dinge hältst du vielleicht für selbstverständlich, für die du aber dennoch dankbar bist?',
      'Nenne mindestens 20 Dinge.',
    ],
    placeholder: 'Schreibe mindestens 20 Dinge auf, für die du wirklich dankbar bist.',
    exampleAnswer: '',
  },
  {
    key: 'proudest_achievements',
    title: 'Worauf bist du in deinem Leben bisher am meisten stolz?',
    eyebrow: 'Frage 04',
    description: 'Erinnere dich daran, was du bereits geschafft hast. Diese Seite soll dir zeigen, dass du schon jetzt Beweise für Stärke, Disziplin und Wachstum hast.',
    prompts: [
      'Welche Erfolge hast du bereits erreicht?',
      'Welche Herausforderungen hast du überwunden?',
      'Welche schwierigen Situationen hast du gemeistert?',
      'Was hast du erreicht, obwohl andere vielleicht nicht an dich geglaubt haben?',
      'Welche Eigenschaften haben dir dabei geholfen?',
    ],
    placeholder: 'Schreibe auf, worauf du wirklich stolz bist und welche Eigenschaften dich dorthin gebracht haben.',
    exampleAnswer: '',
  },
  {
    key: 'biggest_strengths',
    title: 'Was sind deine größten Stärken?',
    eyebrow: 'Frage 05',
    description: 'Finde heraus, welche Fähigkeiten, Eigenschaften und Talente dich tragen. Diese Stärken sind Werkzeuge für dein Traumleben.',
    prompts: [
      'Worin bist du besonders gut?',
      'Welche Talente besitzt du?',
      'Was fällt dir leichter als anderen Menschen?',
      'Wofür wirst du häufig gelobt?',
      'Welche Fähigkeiten möchtest du weiterentwickeln?',
      'Welche Stärken helfen dir dabei, dein Traumleben zu erreichen?',
    ],
    placeholder: 'Schreibe deine wichtigsten Stärken auf und verbinde sie mit deinem zukünftigen Leben.',
    exampleAnswer: '',
  },
  {
    key: 'where_one_month',
    title: 'Wo sehe ich mich in 1 Monat?',
    eyebrow: 'Frage 06',
    description: '',
    prompts: [],
    placeholder: 'Schreibe hier auf, wo du dich in 1 Monat siehst.',
    exampleAnswer: '',
  },
  {
    key: 'where_three_years',
    title: 'Wo sehe ich mich in 3 Jahren?',
    eyebrow: 'Frage 07',
    description: '',
    prompts: [],
    placeholder: 'Schreibe hier auf, wo du dich in 3 Jahren siehst.',
    exampleAnswer: '',
  },
  {
    key: 'where_ten_years',
    title: 'Wo sehe ich mich in 10 Jahren?',
    eyebrow: 'Frage 08',
    description: '',
    prompts: [],
    placeholder: 'Schreibe hier auf, wo du dich in 10 Jahren siehst.',
    exampleAnswer: '',
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
