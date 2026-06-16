function clean(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

const RULES = [
  ['Brust', ['bankdrücken', 'bankdruecken', 'brustpresse', 'chest press', 'fly', 'butterfly', 'dips']],
  ['Rücken', ['latziehen', 'lat pull', 'klimmzug', 'pull up', 'pull-up', 'rudern', 'row', 'kreuzheben', 'deadlift', 'hyperextension']],
  ['Schultern', ['schulterdrücken', 'schulterdruecken', 'shoulder press', 'military press', 'seitheben', 'frontheben', 'reverse fly', 'face pull']],
  ['Bizeps', ['bizeps', 'biceps', 'curl']],
  ['Trizeps', ['trizeps', 'triceps', 'pushdown', 'skull crusher', 'french press', 'überkopfstrecken', 'ueberkopfstrecken']],
  ['Beine', ['kniebeuge', 'squat', 'beinpresse', 'leg press', 'ausfallschritt', 'lunge', 'beinstrecker', 'leg extension', 'beinbeuger', 'leg curl', 'hip thrust', 'glute bridge', 'adduktor', 'abduktor']],
  ['Waden', ['waden', 'calf raise']],
  ['Bauch', ['bauch', 'crunch', 'plank', 'sit-up', 'sit up', 'beinheben', 'leg raise', 'ab wheel']],
  ['Unterarme', ['unterarm', 'wrist curl', 'farmer walk', "farmer's walk"]],
];

export function inferMuscleGroup(exerciseName) {
  const name = clean(exerciseName).toLocaleLowerCase('de-DE');
  if (!name) return 'Sonstiges';

  const match = RULES.find(([, keywords]) => keywords.some(keyword => name.includes(keyword)));
  return match?.[0] || 'Sonstiges';
}

export function resolveMuscleGroup(value, exerciseName) {
  const explicit = clean(value);
  return explicit || inferMuscleGroup(exerciseName);
}

export function normalizeMuscleGroupKey(value, exerciseName = '') {
  return resolveMuscleGroup(value, exerciseName)
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('de-DE');
}

export function buildMuscleGroupSections(exercises = []) {
  return exercises.reduce((sections, exercise) => {
    const muscleGroup = resolveMuscleGroup(exercise?.muscle_group ?? exercise?.muscleGroup, exercise?.name);
    const key = normalizeMuscleGroupKey(muscleGroup);
    const last = sections[sections.length - 1];

    if (last && last.key === key) {
      last.exercises.push({ ...exercise, muscle_group: muscleGroup });
      return sections;
    }

    sections.push({
      key,
      title: muscleGroup,
      exercises: [{ ...exercise, muscle_group: muscleGroup }],
    });
    return sections;
  }, []);
}
