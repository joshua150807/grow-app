export function formatWeight(weight) {
  if (weight == null || weight === '') return '—';
  return `${weight} kg`;
}

export function formatSetsReps(sets, reps) {
  if (!sets && !reps) return '—';
  return `${sets ?? '?'} × ${reps ?? '?'}`;
}

export const PRESET_PLANS = [
  {
    id: 'ganzkoerper',
    name: 'Ganzkörper',
    icon: 'body-outline',
    description: 'Effektives Ganzkörpertraining – 2x pro Woche',
    days: [
      {
        name: 'Ganzkörper A',
        exercises: [
          { name: 'Kniebeuge', weight: '', sets: '3', reps: '8', note: '' },
          { name: 'Bankdrücken', weight: '', sets: '3', reps: '8', note: '' },
          { name: 'Klimmzüge', weight: '', sets: '3', reps: '8', note: '' },
          { name: 'Schulterdrücken', weight: '', sets: '3', reps: '10', note: '' },
          { name: 'Rumänisches Kreuzheben', weight: '', sets: '3', reps: '10', note: '' },
        ],
      },
      {
        name: 'Ganzkörper B',
        exercises: [
          { name: 'Kreuzheben', weight: '', sets: '3', reps: '5', note: '' },
          { name: 'Schrägbankdrücken', weight: '', sets: '3', reps: '8', note: '' },
          { name: 'Rudern', weight: '', sets: '3', reps: '8', note: '' },
          { name: 'Ausfallschritte', weight: '', sets: '3', reps: '10', note: '' },
          { name: 'Trizeps Dips', weight: '', sets: '3', reps: '10', note: '' },
        ],
      },
    ],
  },
  {
    id: 'ppl',
    name: 'Push Pull Legs',
    icon: 'git-branch-outline',
    description: 'Klassische 3-Tage-Aufteilung – 6x pro Woche',
    days: [
      {
        name: 'Push',
        exercises: [
          { name: 'Bankdrücken', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Schrägbankdrücken', weight: '', sets: '3', reps: '10', note: '' },
          { name: 'Schulterdrücken', weight: '', sets: '3', reps: '10', note: '' },
          { name: 'Seitheben', weight: '', sets: '3', reps: '12', note: '' },
          { name: 'Trizeps Pushdown', weight: '', sets: '3', reps: '12', note: '' },
        ],
      },
      {
        name: 'Pull',
        exercises: [
          { name: 'Klimmzüge', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Rudern', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Latzug', weight: '', sets: '3', reps: '10', note: '' },
          { name: 'Bizeps Curl', weight: '', sets: '3', reps: '12', note: '' },
          { name: 'Face Pulls', weight: '', sets: '3', reps: '15', note: '' },
        ],
      },
      {
        name: 'Beine',
        exercises: [
          { name: 'Kniebeuge', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Beinpresse', weight: '', sets: '4', reps: '10', note: '' },
          { name: 'Rumänisches Kreuzheben', weight: '', sets: '3', reps: '10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '3', reps: '12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '4', reps: '15', note: '' },
        ],
      },
    ],
  },
  {
    id: 'brosplit',
    name: 'Bro Split',
    icon: 'flame-outline',
    description: 'Klassischer 5-Tage-Split – ein Muskel pro Tag',
    days: [
      {
        name: 'Brust',
        exercises: [
          { name: 'Bankdrücken', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Schrägbankdrücken', weight: '', sets: '4', reps: '10', note: '' },
          { name: 'Fliegende flach', weight: '', sets: '3', reps: '12', note: '' },
          { name: 'Kabelcrossover', weight: '', sets: '3', reps: '15', note: '' },
        ],
      },
      {
        name: 'Rücken',
        exercises: [
          { name: 'Kreuzheben', weight: '', sets: '4', reps: '6', note: '' },
          { name: 'Klimmzüge', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Rudern', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Latzug eng', weight: '', sets: '3', reps: '12', note: '' },
        ],
      },
      {
        name: 'Schultern',
        exercises: [
          { name: 'Schulterdrücken', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Seitheben', weight: '', sets: '4', reps: '12', note: '' },
          { name: 'Frontheben', weight: '', sets: '3', reps: '12', note: '' },
          { name: 'Face Pulls', weight: '', sets: '3', reps: '15', note: '' },
        ],
      },
      {
        name: 'Arme',
        exercises: [
          { name: 'Bizeps Curl', weight: '', sets: '4', reps: '10', note: '' },
          { name: 'Hammercurl', weight: '', sets: '3', reps: '12', note: '' },
          { name: 'Trizeps Pushdown', weight: '', sets: '4', reps: '12', note: '' },
          { name: 'Skull Crushers', weight: '', sets: '3', reps: '12', note: '' },
        ],
      },
      {
        name: 'Beine',
        exercises: [
          { name: 'Kniebeuge', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Beinpresse', weight: '', sets: '4', reps: '10', note: '' },
          { name: 'Rumänisches Kreuzheben', weight: '', sets: '3', reps: '10', note: '' },
          { name: 'Wadenheben stehend', weight: '', sets: '4', reps: '15', note: '' },
        ],
      },
    ],
  },
  {
    id: 'upperlower',
    name: 'Upper Lower',
    icon: 'layers-outline',
    description: '4-Tage-Split – abwechselnd Ober/Unterkörper',
    days: [
      {
        name: 'Oberkörper A',
        exercises: [
          { name: 'Bankdrücken', weight: '', sets: '4', reps: '6', note: '' },
          { name: 'Klimmzüge', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Schulterdrücken', weight: '', sets: '3', reps: '8', note: '' },
          { name: 'Rudern', weight: '', sets: '3', reps: '8', note: '' },
          { name: 'Trizeps Pushdown', weight: '', sets: '3', reps: '12', note: '' },
        ],
      },
      {
        name: 'Unterkörper A',
        exercises: [
          { name: 'Kniebeuge', weight: '', sets: '4', reps: '6', note: '' },
          { name: 'Rumänisches Kreuzheben', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Beinpresse', weight: '', sets: '3', reps: '10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '3', reps: '12', note: '' },
          { name: 'Wadenheben stehend', weight: '', sets: '3', reps: '15', note: '' },
        ],
      },
      {
        name: 'Oberkörper B',
        exercises: [
          { name: 'Schrägbankdrücken', weight: '', sets: '4', reps: '8', note: '' },
          { name: 'Latzug', weight: '', sets: '4', reps: '10', note: '' },
          { name: 'Seitheben', weight: '', sets: '4', reps: '12', note: '' },
          { name: 'Bizeps Curl', weight: '', sets: '3', reps: '12', note: '' },
          { name: 'Skull Crushers', weight: '', sets: '3', reps: '12', note: '' },
        ],
      },
      {
        name: 'Unterkörper B',
        exercises: [
          { name: 'Kreuzheben', weight: '', sets: '4', reps: '5', note: '' },
          { name: 'Ausfallschritte', weight: '', sets: '3', reps: '10', note: '' },
          { name: 'Beinpresse', weight: '', sets: '3', reps: '12', note: '' },
          { name: 'Wadenheben sitzend', weight: '', sets: '3', reps: '15', note: '' },
        ],
      },
    ],
  },
];
