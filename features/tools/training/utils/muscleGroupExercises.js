export const MUSCLE_GROUP_EXERCISES = {
  chest: {
    label: 'Brust',
    subtitle: 'Übungen für Brust, Push-Kraft und Oberkörper',
    exercises: [
      { id: 'bench_press', name: 'Bankdrücken', category: 'Brust' },
      { id: 'incline_bench_press', name: 'Schrägbankdrücken', category: 'Brust' },
      { id: 'dumbbell_press', name: 'Kurzhantel Bankdrücken', category: 'Brust' },
      { id: 'chest_fly', name: 'Butterfly / Chest Fly', category: 'Brust' },
      { id: 'cable_fly', name: 'Kabel Flys', category: 'Brust' },
      { id: 'push_ups', name: 'Liegestütze', category: 'Brust' },
      { id: 'dips_chest', name: 'Dips Brustfokus', category: 'Brust' },
    ],
  },

  back: {
    label: 'Rücken',
    subtitle: 'Übungen für Lat, oberen Rücken und Rückenstrecker',
    exercises: [
      { id: 'pull_ups', name: 'Klimmzüge', category: 'Rücken' },
      { id: 'lat_pulldown', name: 'Latzug', category: 'Rücken' },
      { id: 'barbell_row', name: 'Langhantelrudern', category: 'Rücken' },
      { id: 'cable_row', name: 'Kabelrudern', category: 'Rücken' },
      { id: 'one_arm_row', name: 'Einarmiges Kurzhantelrudern', category: 'Rücken' },
      { id: 'deadlift', name: 'Kreuzheben', category: 'Rücken' },
      { id: 'back_extension', name: 'Back Extension', category: 'Rücken' },
    ],
  },

  legs: {
    label: 'Beine',
    subtitle: 'Übungen für Quadrizeps, Beinbeuger, Gesäß und Waden',
    exercises: [
      { id: 'squat', name: 'Kniebeugen', category: 'Beine' },
      { id: 'leg_press', name: 'Beinpresse', category: 'Beine' },
      { id: 'lunges', name: 'Ausfallschritte', category: 'Beine' },
      { id: 'leg_extension', name: 'Beinstrecker', category: 'Beine' },
      { id: 'leg_curl', name: 'Beinbeuger', category: 'Beine' },
      { id: 'romanian_deadlift', name: 'Rumänisches Kreuzheben', category: 'Beine' },
      { id: 'calf_raises', name: 'Wadenheben', category: 'Waden' },
    ],
  },

  shoulders: {
    label: 'Schulter',
    subtitle: 'Übungen für vordere, seitliche und hintere Schulter',
    exercises: [
      { id: 'shoulder_press', name: 'Schulterdrücken', category: 'Schulter' },
      { id: 'arnold_press', name: 'Arnold Press', category: 'Schulter' },
      { id: 'lateral_raise', name: 'Seitheben', category: 'Schulter' },
      { id: 'front_raise', name: 'Frontheben', category: 'Schulter' },
      { id: 'reverse_fly', name: 'Reverse Flys', category: 'Hintere Schulter' },
      { id: 'face_pulls', name: 'Face Pulls', category: 'Hintere Schulter' },
      { id: 'upright_row', name: 'Aufrechtes Rudern', category: 'Schulter' },
    ],
  },

  arms: {
    label: 'Arme',
    subtitle: 'Übungen für Bizeps, Trizeps und Unterarme',
    exercises: [
      { id: 'biceps_curl', name: 'Bizeps Curls', category: 'Bizeps' },
      { id: 'hammer_curl', name: 'Hammer Curls', category: 'Bizeps' },
      { id: 'preacher_curl', name: 'Preacher Curls', category: 'Bizeps' },
      { id: 'triceps_pushdown', name: 'Trizepsdrücken am Kabel', category: 'Trizeps' },
      { id: 'skull_crushers', name: 'Skull Crushers', category: 'Trizeps' },
      { id: 'overhead_extension', name: 'Overhead Trizeps Extension', category: 'Trizeps' },
      { id: 'wrist_curl', name: 'Wrist Curls', category: 'Unterarme' },
    ],
  },

  core: {
    label: 'Bauch',
    subtitle: 'Übungen für Core, Bauch und Rumpfstabilität',
    exercises: [
      { id: 'crunches', name: 'Crunches', category: 'Bauch' },
      { id: 'leg_raises', name: 'Leg Raises', category: 'Bauch' },
      { id: 'plank', name: 'Plank', category: 'Core' },
      { id: 'russian_twists', name: 'Russian Twists', category: 'Core' },
      { id: 'ab_wheel', name: 'Ab Wheel', category: 'Core' },
      { id: 'cable_crunch', name: 'Cable Crunches', category: 'Bauch' },
      { id: 'hanging_knee_raise', name: 'Hanging Knee Raises', category: 'Bauch' },
    ],
  },
};