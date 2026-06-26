function clean(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

// Exakte Zuordnung aller Übungen aus dem aktuellen Übungskatalog.
// Dadurch werden ähnlich benannte Übungen wie Dips und Dips Brustfokus
// zuverlässig unterschiedlichen Muskelgruppen zugeordnet.
const EXERCISE_GROUPS = {
  'Bankdrücken': 'Brust',
  'Brustpresse': 'Brust',
  'Schrägbankdrücken': 'Brust',
  'Kurzhantel Bankdrücken': 'Brust',
  'Butterfly / Chest Fly': 'Brust',
  'Butterfly': 'Brust',
  'Kabel Flys': 'Brust',
  'Liegestütze': 'Brust',
  'Dips Brustfokus': 'Brust',
  'Chin Ups': 'Rücken',
  'Klimmzüge': 'Rücken',
  'Breiter Latzug': 'Rücken',
  'Mittlerer Latzug': 'Rücken',
  'Enger Latzug': 'Rücken',
  'Latzug eng': 'Rücken',
  'Enges Rudern': 'Rücken',
  'Breites Rudern': 'Rücken',
  'T-Bar Rudern': 'Rücken',
  'T-Bar Rows': 'Rücken',
  'Mittelbreites Rudern': 'Rücken',
  'Rudermaschine mittlerer Griff': 'Rücken',
  'Einarmiges Kabelrudern': 'Rücken',
  'High Row': 'Rücken',
  'Überzüge': 'Rücken',
  'Langhantelrudern': 'Rücken',
  'Einarmiges Kurzhantelrudern': 'Rücken',
  'Kreuzheben': 'Rücken',
  'Rückenstrecker Maschine': 'Rücken',
  'Latmaschine enger Griff': 'Rücken',
  'Latmaschine breiter Griff': 'Rücken',
  'Kniebeugen': 'Beine',
  'Beinpresse': 'Beine',
  'Ausfallschritte': 'Beine',
  'Beinstrecker': 'Beine',
  'Beinbeuger': 'Beine',
  'Beinbeuger sitzend': 'Beine',
  'Rumänisches Kreuzheben': 'Beine',
  'Wadenheben': 'Beine',
  'Adduktoren Maschine': 'Beine',
  'Abduktoren Maschine': 'Beine',
  'Hip Thrust': 'Beine',
  'Schulterdrücken Maschine': 'Schulter',
  'Schulterdrücken': 'Schulter',
  'Kurzhantel Schulterdrücken': 'Schulter',
  'Arnold Schulterdrücken': 'Schulter',
  'Kurzhantel Seitheben': 'Schulter',
  'Seitheben': 'Schulter',
  'Seitheben am Kabelturm': 'Schulter',
  'Seitheben Maschine': 'Schulter',
  'Reverse Butterfly': 'Schulter',
  'Face Pulls': 'Schulter',
  'Frontheben': 'Schulter',
  'Reverse Flys': 'Schulter',
  'Aufrechtes Rudern': 'Schulter',
  'Shrugs': 'Schulter',
  'Bizepscurls': 'Bizeps',
  'Scottcurl': 'Bizeps',
  'Preacher Curl Maschine': 'Bizeps',
  'Hammercurls mit Kurzhanteln': 'Bizeps',
  'Hammer Curls': 'Bizeps',
  'Hammercurls am Kabelturm': 'Bizeps',
  'Bizepscurls Maschine': 'Bizeps',
  'Arnold Curls': 'Bizeps',
  'Schrägbankcurls': 'Bizeps',
  'Kabelcurls': 'Bizeps',
  'Kabel Curls': 'Bizeps',
  'Dips': 'Trizeps',
  'Trizepsstrecken einarmig': 'Trizeps',
  'Trizepsdrücken am Kabel': 'Trizeps',
  'Trizeps Pushdowns': 'Trizeps',
  'Trizepsstrecker Maschine': 'Trizeps',
  'Überkopf Trizepsstrecken': 'Trizeps',
  'Overhead Trizeps Extension': 'Trizeps',
  'Stirndrücken': 'Trizeps',
  'French Press': 'Trizeps',
  'Handgelenkcurls': 'Unterarme',
  'Crunches': 'Bauch',
  'Bauchmaschine': 'Bauch',
  'Beinheben': 'Bauch',
  'Unterarmstütz': 'Bauch',
  'Russische Drehung': 'Bauch',
  'Ab Wheel Rollout': 'Bauch',
  'Kabel Crunches': 'Bauch',
  'Hängendes Knieheben': 'Bauch',
};

const NORMALIZED_EXERCISE_GROUPS = Object.fromEntries(
  Object.entries(EXERCISE_GROUPS).map(([name, group]) => [
    name.toLocaleLowerCase('de-DE'),
    group,
  ])
);

const RULES = [
  ['Brust', ['bankdrücken', 'bankdruecken', 'brustpresse', 'chest press', 'chest fly', 'kabel fly', 'butterfly', 'liegestütz', 'push up']],
  ['Rücken', ['chin up', 'klimmzug', 'pull up', 'pull-up', 'latzug', 'lat pulldown', 'latmaschine', 'rudern', 'row', 'rows', 'überzug', 'ueberzug', 'pullover', 'kreuzheben', 'deadlift', 'rückenstrecker', 'rueckenstrecker', 'back extension']],
  ['Schulter', ['schulterdrücken', 'schulterdruecken', 'shoulder press', 'arnold press', 'seitheben', 'lateral raise', 'frontheben', 'front raise', 'reverse butterfly', 'reverse pec deck', 'reverse fly', 'face pull', 'aufrechtes rudern', 'upright row', 'shrug', 'trapez', 'nacken']],
  ['Bizeps', ['bizeps', 'biceps', 'scottcurl', 'preacher curl', 'hammer curl', 'hammercurl', 'arnold curl', 'schrägbankcurl', 'schraegbankcurl', 'incline curl', 'kabelcurl', 'kabel curl', 'cable curl']],
  ['Trizeps', ['trizeps', 'triceps', 'pushdown', 'skull crusher', 'stirndrücken', 'stirndruecken', 'french press', 'überkopf trizeps', 'ueberkopf trizeps']],
  ['Beine', ['kniebeuge', 'squat', 'beinpresse', 'leg press', 'ausfallschritt', 'lunge', 'beinstrecker', 'leg extension', 'beinbeuger', 'leg curl', 'rumänisches kreuzheben', 'rumaenisches kreuzheben', 'romanian deadlift', 'waden', 'calf raise', 'hip thrust', 'glute bridge', 'adduktor', 'abduktor']],
  ['Bauch', ['bauch', 'crunch', 'plank', 'unterarmstütz', 'unterarmstuetz', 'russian twist', 'russische drehung', 'beinheben', 'leg raise', 'ab wheel', 'knee raise', 'knieheben']],
  ['Unterarme', ['unterarm', 'handgelenkcurl', 'wrist curl', 'farmer walk', "farmer's walk"]],
];

export function inferMuscleGroup(exerciseName) {
  const name = clean(exerciseName).toLocaleLowerCase('de-DE');
  if (!name) return 'Sonstiges';

  const exactMatch = NORMALIZED_EXERCISE_GROUPS[name];
  if (exactMatch) return exactMatch;

  const ruleMatch = RULES.find(([, keywords]) =>
    keywords.some((keyword) => name.includes(keyword))
  );

  return ruleMatch?.[0] || 'Sonstiges';
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
    const muscleGroup = resolveMuscleGroup(
      exercise?.muscle_group ?? exercise?.muscleGroup,
      exercise?.name
    );
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
