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
    description: '3x pro Woche – A/B im Wechsel',
    days: [
      {
        name: 'Ganzkörper A',
        exercises: [
          { name: 'Brustpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Latzug eng', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Schulterdrücken', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Preacher Curl Maschine', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Trizeps Pushdowns', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Beinbeuger sitzend', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Ganzkörper B',
        exercises: [
          { name: 'Schrägbankdrücken', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'T-Bar Rows', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Seitheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Hammer Curls', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Overhead Trizeps Extension', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Rückenstrecker Maschine', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
    ],
  },
  {
    id: 'upperlower',
    name: 'Upper Lower',
    icon: 'layers-outline',
    description: '4x pro Woche – Upper/Lower im Wechsel',
    days: [
      {
        name: 'Upper',
        exercises: [
          { name: 'Brustpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Schrägbankdrücken', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Latzug eng', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'T-Bar Rows', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Seitheben', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Preacher Curl Maschine', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Hammer Curls', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Trizeps Pushdowns', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Overhead Trizeps Extension', weight: '', sets: '2', reps: '8–12', note: '' },
        ],
      },
      {
        name: 'Lower',
        exercises: [
          { name: 'Beinbeuger sitzend', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Rückenstrecker Maschine', weight: '', sets: '1', reps: '10–15', note: '' },
          { name: 'Shrugs', weight: '', sets: '1', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
    ],
  },
  {
    id: 'ppl',
    name: 'PPL',
    icon: 'git-branch-outline',
    description: 'Push Pull Legs – 6x pro Woche',
    days: [
      {
        name: 'Push',
        exercises: [
          { name: 'Brustpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Schrägbankdrücken', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Butterfly', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Schulterdrücken', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Seitheben', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Trizeps Pushdowns', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Overhead Trizeps Extension', weight: '', sets: '2', reps: '8–12', note: '' },
        ],
      },
      {
        name: 'Pull',
        exercises: [
          { name: 'Latzug eng', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'T-Bar Rows', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Rudermaschine mittlerer Griff', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Reverse Butterfly', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Preacher Curl Maschine', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Hammer Curls', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Shrugs', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Legs',
        exercises: [
          { name: 'Beinbeuger sitzend', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '3', reps: '6–10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Rückenstrecker Maschine', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
    ],
  },
  {
    id: 'arnoldsplit',
    name: 'Arnold Split',
    icon: 'repeat-outline',
    description: 'Brust/Rücken, Schultern/Arme, Beine – 6x pro Woche',
    days: [
      {
        name: 'Brust & Rücken',
        exercises: [
          { name: 'Brustpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Schrägbankdrücken', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Butterfly', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Latzug eng', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'T-Bar Rows', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Mittelbreites Rudern', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Reverse Butterfly', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Schultern & Arme',
        exercises: [
          { name: 'Schulterdrücken', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Seitheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Trizeps Pushdowns', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Overhead Trizeps Extension', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Preacher Curl Maschine', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Hammer Curls', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Shrugs', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Beine',
        exercises: [
          { name: 'Beinbeuger sitzend', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '3', reps: '6–10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Rückenstrecker Maschine', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
    ],
  },
  {
    id: 'torsolimbs',
    name: 'Torso Limbs',
    icon: 'barbell-outline',
    description: '4x pro Woche – Torso/Limbs im Wechsel',
    days: [
      {
        name: 'Torso',
        exercises: [
          { name: 'Brustpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Schrägbankdrücken', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Latzug eng', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'T-Bar Rows', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Mittelbreites Rudern', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Schulterdrücken', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Seitheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Reverse Butterfly', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Limbs',
        exercises: [
          { name: 'Beinbeuger sitzend', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Preacher Curl Maschine', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Hammer Curls', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Trizeps Pushdowns', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Overhead Trizeps Extension', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Rückenstrecker Maschine', weight: '', sets: '1', reps: '10–15', note: '' },
          { name: 'Shrugs', weight: '', sets: '1', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
    ],
  },
  {
    id: 'brosplit',
    name: 'Bro Split',
    icon: 'flame-outline',
    description: '5x pro Woche – klassischer Muskelgruppen-Split',
    days: [
      {
        name: 'Brust',
        exercises: [
          { name: 'Brustpresse', weight: '', sets: '3', reps: '6–10', note: '' },
          { name: 'Schrägbankdrücken', weight: '', sets: '3', reps: '6–10', note: '' },
          { name: 'Butterfly', weight: '', sets: '3', reps: '8–12', note: '' },
          { name: 'Kabel Flys', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Rücken',
        exercises: [
          { name: 'Latzug eng', weight: '', sets: '3', reps: '6–10', note: '' },
          { name: 'T-Bar Rows', weight: '', sets: '3', reps: '6–10', note: '' },
          { name: 'Mittelbreites Rudern', weight: '', sets: '3', reps: '8–12', note: '' },
          { name: 'Reverse Butterfly', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Beine',
        exercises: [
          { name: 'Beinbeuger sitzend', weight: '', sets: '3', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '3', reps: '6–10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '3', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '3', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '3', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Schultern',
        exercises: [
          { name: 'Schulterdrücken', weight: '', sets: '3', reps: '6–10', note: '' },
          { name: 'Seitheben', weight: '', sets: '3', reps: '10–15', note: '' },
          { name: 'Reverse Butterfly', weight: '', sets: '3', reps: '10–15', note: '' },
          { name: 'Shrugs', weight: '', sets: '3', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Arme',
        exercises: [
          { name: 'Preacher Curl Maschine', weight: '', sets: '3', reps: '8–12', note: 'Bizeps' },
          { name: 'Hammer Curls', weight: '', sets: '3', reps: '8–12', note: 'Bizeps' },
          { name: 'Kabel Curls', weight: '', sets: '3', reps: '10–15', note: 'Bizeps' },
          { name: 'Trizeps Pushdowns', weight: '', sets: '3', reps: '8–12', note: 'Trizeps' },
          { name: 'Overhead Trizeps Extension', weight: '', sets: '3', reps: '8–12', note: 'Trizeps' },
          { name: 'Dips', weight: '', sets: '3', reps: '10–15', note: 'Trizeps' },
        ],
      },
    ],
  },

  {
    id: 'ppl_upper_lower',
    name: 'PPL / Upper / Lower',
    icon: 'git-branch-outline',
    description: '5x pro Woche – Push/Pull/Legs plus Upper/Lower',
    days: [
      {
        name: 'Push',
        exercises: [
          { name: 'Schrägbankdrücken', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Brustpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Butterfly', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Schulterdrücken', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Seitheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Trizeps Pushdowns', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Overhead Trizeps Extension', weight: '', sets: '2', reps: '8–12', note: '' },
        ],
      },
      {
        name: 'Pull',
        exercises: [
          { name: 'Latzug eng', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'T-Bar Rows', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Mittelbreites Rudern', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Reverse Butterfly', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Preacher Curl Maschine', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Hammer Curls', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Shrugs', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Legs',
        exercises: [
          { name: 'Beinbeuger sitzend', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '3', reps: '6–10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Rückenstrecker Maschine', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Upper',
        exercises: [
          { name: 'Schrägbankdrücken', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Brustpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Latzug eng', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'T-Bar Rows', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Seitheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Preacher Curl Maschine', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Trizeps Pushdowns', weight: '', sets: '2', reps: '8–12', note: '' },
        ],
      },
      {
        name: 'Lower',
        exercises: [
          { name: 'Beinbeuger sitzend', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Hip Thrust', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
    ],
  },
  {
    id: 'upper_lower_ganzkoerper',
    name: 'Upper / Lower / Ganzkörper',
    icon: 'layers-outline',
    description: '4x pro Woche – Upper/Lower plus Ganzkörper A/B',
    days: [
      {
        name: 'Upper',
        exercises: [
          { name: 'Brustpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Schrägbankdrücken', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Latzug eng', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'T-Bar Rows', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Seitheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Preacher Curl Maschine', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Hammer Curls', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Trizeps Pushdowns', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Overhead Trizeps Extension', weight: '', sets: '2', reps: '8–12', note: '' },
        ],
      },
      {
        name: 'Lower',
        exercises: [
          { name: 'Beinbeuger sitzend', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Hip Thrust', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Rückenstrecker Maschine', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '2', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Ganzkörper A',
        exercises: [
          { name: 'Brustpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Latzug eng', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Schulterdrücken', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Preacher Curl Maschine', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Trizeps Pushdowns', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Beinbeuger sitzend', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '1', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '1', reps: '10–15', note: '' },
        ],
      },
      {
        name: 'Ganzkörper B',
        exercises: [
          { name: 'Schrägbankdrücken', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'T-Bar Rows', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Seitheben', weight: '', sets: '2', reps: '10–15', note: '' },
          { name: 'Hammer Curls', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Overhead Trizeps Extension', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Beinpresse', weight: '', sets: '2', reps: '6–10', note: '' },
          { name: 'Beinstrecker', weight: '', sets: '2', reps: '8–12', note: '' },
          { name: 'Wadenheben', weight: '', sets: '1', reps: '10–15', note: '' },
          { name: 'Bauchmaschine', weight: '', sets: '1', reps: '10–15', note: '' },
        ],
      },
    ],
  },
];
