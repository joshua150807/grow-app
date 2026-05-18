export const MUSCLE_GROUP_EXERCISES = {
  chest: {
    label: 'Brust',
    subtitle: 'Übungen für Brust, Push-Kraft und Oberkörper',
    exercises: [
      {
        id: 'bench_press',
        name: 'Bankdrücken',
        category: 'Brust',
        description:
          'Bankdrücken ist eine Grundübung für Brust, vordere Schulter und Trizeps. Sie eignet sich sehr gut, um Druckkraft im Oberkörper aufzubauen.',
        execution: [
          'Lege dich stabil auf die Bank und stelle beide Füße fest auf den Boden.',
          'Greife die Stange etwas breiter als schulterbreit.',
          'Ziehe die Schulterblätter leicht nach hinten unten und halte den oberen Rücken stabil.',
          'Senke die Stange kontrolliert zur Brust ab.',
          'Drücke die Stange kraftvoll nach oben, ohne die Schultern nach vorne fallen zu lassen.',
        ],
        tips: [
          'Halte die Handgelenke möglichst gerade.',
          'Arbeite kontrolliert und vermeide ein starkes Abfedern auf der Brust.',
          'Bei schweren Sätzen ist ein Spotter sinnvoll.',
        ],
      },
      {
        id: 'incline_bench_press',
        name: 'Schrägbankdrücken',
        category: 'Brust',
        description:
          'Schrägbankdrücken trainiert besonders den oberen Brustbereich sowie vordere Schulter und Trizeps.',
        execution: [
          'Stelle die Bank auf eine moderate Schräglage ein.',
          'Lege dich stabil auf die Bank und fixiere deine Füße am Boden.',
          'Senke die Hantel kontrolliert Richtung oberer Brust ab.',
          'Drücke die Hantel wieder nach oben, ohne die Schultern hochzuziehen.',
        ],
        tips: [
          'Eine zu steile Bank belastet stärker die Schulter als die Brust.',
          'Halte die Bewegung sauber und kontrolliert.',
          'Spanne den Rumpf während der gesamten Bewegung an.',
        ],
      },
      {
        id: 'dumbbell_press',
        name: 'Kurzhantel Bankdrücken',
        category: 'Brust',
        description:
          'Kurzhantel Bankdrücken ist eine Brustübung mit größerem Bewegungsradius als klassisches Bankdrücken mit der Langhantel.',
        execution: [
          'Setze dich mit den Kurzhanteln auf die Bank und lege dich kontrolliert zurück.',
          'Starte mit den Hanteln neben der Brust.',
          'Drücke beide Hanteln kontrolliert nach oben.',
          'Senke sie langsam wieder ab, bis du eine gute Dehnung in der Brust spürst.',
        ],
        tips: [
          'Führe beide Seiten gleichmäßig.',
          'Lasse die Hanteln unten nicht unkontrolliert absacken.',
          'Nutze ein Gewicht, das du stabil kontrollieren kannst.',
        ],
      },
      {
        id: 'chest_fly',
        name: 'Butterfly / Chest Fly',
        category: 'Brust',
        description:
          'Butterfly oder Chest Flys isolieren die Brust stärker und eignen sich gut, um die Brust kontrolliert zu spüren.',
        execution: [
          'Setze dich stabil an die Maschine oder lege dich auf eine Bank.',
          'Führe die Arme mit leicht gebeugten Ellenbogen zusammen.',
          'Spanne die Brust am Ende der Bewegung bewusst an.',
          'Führe die Arme langsam wieder zurück.',
        ],
        tips: [
          'Die Bewegung kommt aus der Brust, nicht aus den Händen.',
          'Halte die Ellenbogen leicht gebeugt.',
          'Nimm weniger Gewicht, wenn du die Schultern zu stark spürst.',
        ],
      },
      {
        id: 'cable_fly',
        name: 'Kabel Flys',
        category: 'Brust',
        description:
          'Kabel Flys trainieren die Brust über einen konstanten Widerstand und eignen sich gut für kontrollierte, saubere Wiederholungen.',
        execution: [
          'Stelle dich mittig zwischen die Kabelzüge.',
          'Greife beide Griffe und bringe einen stabilen Stand ein.',
          'Führe die Hände kontrolliert vor dem Körper zusammen.',
          'Halte kurz die Spannung und führe die Arme langsam zurück.',
        ],
        tips: [
          'Halte den Oberkörper stabil.',
          'Vermeide Schwung.',
          'Konzentriere dich auf die Brustspannung.',
        ],
      },
      {
        id: 'push_ups',
        name: 'Liegestütze',
        category: 'Brust',
        description:
          'Liegestütze sind eine effektive Körpergewichtsübung für Brust, Schulter, Trizeps und Rumpf.',
        execution: [
          'Starte in einer stabilen Plank-Position.',
          'Platziere die Hände etwa schulterbreit oder leicht breiter.',
          'Senke den Körper kontrolliert Richtung Boden.',
          'Drücke dich wieder nach oben, ohne die Hüfte durchhängen zu lassen.',
        ],
        tips: [
          'Halte den Körper gerade.',
          'Spanne Bauch und Gesäß an.',
          'Passe die Schwierigkeit über Knie-Liegestütze oder erhöhte Hände an.',
        ],
      },
      {
        id: 'dips_chest',
        name: 'Dips Brustfokus',
        category: 'Brust',
        description:
          'Dips mit Brustfokus trainieren vor allem untere Brust, vordere Schulter und Trizeps.',
        execution: [
          'Stütze dich an den Dip-Barren ab.',
          'Lehne den Oberkörper leicht nach vorne.',
          'Senke dich kontrolliert ab.',
          'Drücke dich wieder nach oben, ohne die Schultern hochzuziehen.',
        ],
        tips: [
          'Gehe nur so tief, wie deine Schultern es sauber erlauben.',
          'Eine leichte Vorneigung erhöht den Brustfokus.',
          'Arbeite ohne Schwung.',
        ],
      },
    ],
  },

  back: {
    label: 'Rücken',
    subtitle: 'Übungen für Lat, oberen Rücken und Rückenstrecker',
    exercises: [
      {
        id: 'pull_ups',
        name: 'Klimmzüge',
        category: 'Rücken',
        description:
          'Klimmzüge sind eine starke Grundübung für den Lat, oberen Rücken und Bizeps.',
        execution: [
          'Greife die Stange etwas breiter als schulterbreit.',
          'Hänge stabil und spanne den Rumpf an.',
          'Ziehe dich kontrolliert nach oben, bis dein Kinn etwa auf Stangenhöhe ist.',
          'Senke dich langsam wieder ab.',
        ],
        tips: [
          'Ziehe die Schulterblätter zuerst aktiv nach unten.',
          'Vermeide Schwung aus den Beinen.',
          'Nutze ein Band oder eine Maschine, wenn freie Klimmzüge noch zu schwer sind.',
        ],
      },
      {
        id: 'lat_pulldown',
        name: 'Latzug',
        category: 'Rücken',
        description:
          'Der Latzug trainiert hauptsächlich den breiten Rückenmuskel und ist eine gute Alternative oder Vorbereitung für Klimmzüge.',
        execution: [
          'Setze dich stabil an den Latzug und fixiere deine Oberschenkel.',
          'Greife die Stange etwas breiter als schulterbreit.',
          'Ziehe die Stange kontrolliert Richtung oberer Brust.',
          'Führe die Stange langsam wieder nach oben.',
        ],
        tips: [
          'Ziehe mit den Ellenbogen nach unten, nicht nur mit den Händen.',
          'Halte den Oberkörper relativ stabil.',
          'Vermeide starkes Zurücklehnen.',
        ],
      },
      {
        id: 'barbell_row',
        name: 'Langhantelrudern',
        category: 'Rücken',
        description:
          'Langhantelrudern ist eine schwere Grundübung für oberen Rücken, Lat, hintere Schulter und Rumpfstabilität.',
        execution: [
          'Stelle dich etwa hüftbreit hin und greife die Langhantel.',
          'Beuge die Hüfte nach hinten und halte den Rücken gerade.',
          'Ziehe die Hantel kontrolliert Richtung Bauch.',
          'Senke die Hantel langsam wieder ab.',
        ],
        tips: [
          'Halte den Rücken neutral.',
          'Vermeide Schwung aus dem Oberkörper.',
          'Ziehe die Ellenbogen bewusst nach hinten.',
        ],
      },
      {
        id: 'cable_row',
        name: 'Kabelrudern',
        category: 'Rücken',
        description:
          'Kabelrudern trainiert den mittleren Rücken, Lat und hintere Schulter mit kontrollierbarer Belastung.',
        execution: [
          'Setze dich stabil an den Kabelzug.',
          'Greife den Griff und richte den Oberkörper auf.',
          'Ziehe den Griff kontrolliert Richtung Bauch.',
          'Führe das Gewicht langsam zurück.',
        ],
        tips: [
          'Halte die Brust aufrecht.',
          'Ziehe die Schulterblätter am Ende leicht zusammen.',
          'Lasse dich nicht vom Gewicht nach vorne reißen.',
        ],
      },
      {
        id: 'one_arm_row',
        name: 'Einarmiges Kurzhantelrudern',
        category: 'Rücken',
        description:
          'Einarmiges Kurzhantelrudern trainiert den Lat und oberen Rücken einseitig und hilft, muskuläre Unterschiede auszugleichen.',
        execution: [
          'Stütze dich mit einer Hand und einem Knie auf einer Bank ab.',
          'Halte den Rücken gerade.',
          'Ziehe die Kurzhantel kontrolliert Richtung Hüfte.',
          'Senke sie langsam wieder ab.',
        ],
        tips: [
          'Ziehe den Ellenbogen Richtung Hüfte.',
          'Drehe den Oberkörper nicht stark auf.',
          'Kontrolliere die negative Phase.',
        ],
      },
      {
        id: 'deadlift',
        name: 'Kreuzheben',
        category: 'Rücken',
        description:
          'Kreuzheben ist eine komplexe Grundübung für Rückenstrecker, Beine, Gesäß, Griffkraft und Rumpf.',
        execution: [
          'Stelle dich mit den Füßen etwa hüftbreit vor die Langhantel.',
          'Greife die Stange und halte den Rücken neutral.',
          'Spanne den Rumpf an und drücke dich über die Beine nach oben.',
          'Führe die Hantel kontrolliert wieder nach unten.',
        ],
        tips: [
          'Halte die Stange nah am Körper.',
          'Runde den Rücken nicht ein.',
          'Starte mit leichtem Gewicht, bis die Technik sicher sitzt.',
        ],
      },
      {
        id: 'back_extension',
        name: 'Back Extension',
        category: 'Rücken',
        description:
          'Back Extensions trainieren Rückenstrecker, Gesäß und hintere Oberschenkel.',
        execution: [
          'Positioniere dich stabil auf der Back-Extension-Bank.',
          'Senke den Oberkörper kontrolliert ab.',
          'Richte dich wieder auf, bis dein Körper eine gerade Linie bildet.',
          'Halte oben kurz die Spannung.',
        ],
        tips: [
          'Überstrecke den Rücken oben nicht.',
          'Spanne Gesäß und Bauch leicht an.',
          'Arbeite langsam und sauber.',
        ],
      },
    ],
  },

  legs: {
    label: 'Beine',
    subtitle: 'Übungen für Quadrizeps, Beinbeuger, Gesäß und Waden',
    exercises: [
      {
        id: 'squat',
        name: 'Kniebeugen',
        category: 'Beine',
        description:
          'Kniebeugen sind eine Grundübung für Beine, Gesäß und Rumpfstabilität.',
        execution: [
          'Stelle dich etwa schulterbreit hin.',
          'Spanne den Rumpf an und halte den Oberkörper stabil.',
          'Beuge Knie und Hüfte kontrolliert.',
          'Drücke dich kraftvoll wieder nach oben.',
        ],
        tips: [
          'Die Knie sollten stabil in Richtung der Zehen zeigen.',
          'Halte die Fersen am Boden.',
          'Gehe nur so tief, wie du die Technik sauber halten kannst.',
        ],
      },
      {
        id: 'leg_press',
        name: 'Beinpresse',
        category: 'Beine',
        description:
          'Die Beinpresse trainiert Quadrizeps, Gesäß und Beinbeuger mit geführter Bewegung.',
        execution: [
          'Setze dich stabil in die Maschine.',
          'Platziere die Füße etwa schulterbreit auf der Plattform.',
          'Senke das Gewicht kontrolliert ab.',
          'Drücke die Plattform wieder nach oben, ohne die Knie komplett hart durchzudrücken.',
        ],
        tips: [
          'Lasse die Knie nicht nach innen fallen.',
          'Halte den unteren Rücken an der Lehne.',
          'Kontrolliere die Tiefe der Bewegung.',
        ],
      },
      {
        id: 'lunges',
        name: 'Ausfallschritte',
        category: 'Beine',
        description:
          'Ausfallschritte trainieren Beine und Gesäß einseitig und verbessern Stabilität.',
        execution: [
          'Mache einen kontrollierten Schritt nach vorne.',
          'Senke den Körper ab, bis beide Knie etwa gebeugt sind.',
          'Drücke dich über das vordere Bein zurück nach oben.',
          'Wechsle die Seite oder führe alle Wiederholungen auf einer Seite aus.',
        ],
        tips: [
          'Halte den Oberkörper aufrecht.',
          'Das vordere Knie bleibt stabil.',
          'Starte ohne Zusatzgewicht, wenn die Balance schwerfällt.',
        ],
      },
      {
        id: 'leg_extension',
        name: 'Beinstrecker',
        category: 'Beine',
        description:
          'Der Beinstrecker isoliert hauptsächlich den Quadrizeps an der Vorderseite des Oberschenkels.',
        execution: [
          'Setze dich stabil in die Maschine.',
          'Positioniere das Polster oberhalb der Fußgelenke.',
          'Strecke die Beine kontrolliert nach vorne.',
          'Senke das Gewicht langsam wieder ab.',
        ],
        tips: [
          'Arbeite kontrolliert ohne Schwung.',
          'Halte oben kurz die Spannung.',
          'Wähle ein Gewicht, bei dem die Knie sich gut anfühlen.',
        ],
      },
      {
        id: 'leg_curl',
        name: 'Beinbeuger',
        category: 'Beine',
        description:
          'Der Beinbeuger trainiert die hintere Oberschenkelmuskulatur.',
        execution: [
          'Positioniere dich korrekt in der Maschine.',
          'Ziehe das Polster kontrolliert Richtung Gesäß.',
          'Halte kurz die Spannung.',
          'Führe das Gewicht langsam zurück.',
        ],
        tips: [
          'Vermeide Schwung.',
          'Halte die Hüfte stabil.',
          'Kontrolliere besonders die Rückbewegung.',
        ],
      },
      {
        id: 'romanian_deadlift',
        name: 'Rumänisches Kreuzheben',
        category: 'Beine',
        description:
          'Rumänisches Kreuzheben trainiert Beinbeuger, Gesäß und Rückenstrecker.',
        execution: [
          'Halte die Hantel vor dem Körper.',
          'Schiebe die Hüfte nach hinten und halte den Rücken gerade.',
          'Senke die Hantel kontrolliert entlang der Beine ab.',
          'Richte dich über Hüfte und Gesäß wieder auf.',
        ],
        tips: [
          'Die Knie bleiben leicht gebeugt.',
          'Spüre die Dehnung in den hinteren Oberschenkeln.',
          'Runde den Rücken nicht ein.',
        ],
      },
      {
        id: 'calf_raises',
        name: 'Wadenheben',
        category: 'Waden',
        description:
          'Wadenheben trainiert die Wadenmuskulatur und kann stehend oder sitzend ausgeführt werden.',
        execution: [
          'Stelle dich stabil auf oder in die Maschine.',
          'Senke die Fersen kontrolliert ab.',
          'Drücke dich über die Fußballen nach oben.',
          'Halte oben kurz die Spannung.',
        ],
        tips: [
          'Nutze den vollen Bewegungsradius.',
          'Arbeite langsam und kontrolliert.',
          'Vermeide Wippen mit Schwung.',
        ],
      },
    ],
  },

  shoulders: {
    label: 'Schulter',
    subtitle: 'Übungen für vordere, seitliche und hintere Schulter',
    exercises: [
      {
        id: 'shoulder_press',
        name: 'Schulterdrücken',
        category: 'Schulter',
        description:
          'Schulterdrücken trainiert vor allem die vordere und seitliche Schulter sowie den Trizeps.',
        execution: [
          'Setze oder stelle dich stabil hin.',
          'Starte mit den Hanteln etwa auf Schulterhöhe.',
          'Drücke das Gewicht kontrolliert nach oben.',
          'Senke es langsam wieder auf Schulterhöhe ab.',
        ],
        tips: [
          'Spanne den Bauch an.',
          'Vermeide ein starkes Hohlkreuz.',
          'Ziehe die Schultern nicht unnötig hoch.',
        ],
      },
      {
        id: 'arnold_press',
        name: 'Arnold Press',
        category: 'Schulter',
        description:
          'Die Arnold Press ist eine Schulterübung mit Rotation und beansprucht mehrere Schulteranteile.',
        execution: [
          'Starte mit den Kurzhanteln vor der Brust, Handflächen zu dir.',
          'Drücke die Hanteln nach oben und rotiere die Handflächen nach vorne.',
          'Senke die Hanteln kontrolliert zurück in die Startposition.',
        ],
        tips: [
          'Nutze eher moderate Gewichte.',
          'Führe die Rotation kontrolliert aus.',
          'Halte den Rumpf stabil.',
        ],
      },
      {
        id: 'lateral_raise',
        name: 'Seitheben',
        category: 'Schulter',
        description:
          'Seitheben trainiert besonders die seitliche Schulter und sorgt optisch für mehr Schulterbreite.',
        execution: [
          'Halte die Kurzhanteln seitlich am Körper.',
          'Hebe die Arme mit leicht gebeugten Ellenbogen seitlich an.',
          'Stoppe ungefähr auf Schulterhöhe.',
          'Senke die Hanteln langsam wieder ab.',
        ],
        tips: [
          'Arbeite ohne Schwung.',
          'Die Ellenbogen führen die Bewegung.',
          'Nimm lieber weniger Gewicht und führe sauber aus.',
        ],
      },
      {
        id: 'front_raise',
        name: 'Frontheben',
        category: 'Schulter',
        description:
          'Frontheben trainiert vor allem die vordere Schulter.',
        execution: [
          'Halte die Hanteln vor dem Körper.',
          'Hebe einen oder beide Arme kontrolliert nach vorne an.',
          'Stoppe etwa auf Schulterhöhe.',
          'Senke das Gewicht langsam wieder ab.',
        ],
        tips: [
          'Vermeide Schwung aus dem Rücken.',
          'Halte den Rumpf angespannt.',
          'Nicht zu schwer wählen.',
        ],
      },
      {
        id: 'reverse_fly',
        name: 'Reverse Flys',
        category: 'Hintere Schulter',
        description:
          'Reverse Flys trainieren hintere Schulter und oberen Rücken.',
        execution: [
          'Beuge den Oberkörper leicht nach vorne oder nutze eine Maschine.',
          'Führe die Arme mit leicht gebeugten Ellenbogen nach außen.',
          'Ziehe die Schulterblätter leicht zusammen.',
          'Führe die Arme langsam zurück.',
        ],
        tips: [
          'Arbeite kontrolliert.',
          'Nimm wenig Gewicht.',
          'Vermeide ein Hochziehen der Schultern.',
        ],
      },
      {
        id: 'face_pulls',
        name: 'Face Pulls',
        category: 'Hintere Schulter',
        description:
          'Face Pulls trainieren hintere Schulter, oberen Rücken und Schulterstabilität.',
        execution: [
          'Stelle den Kabelzug etwa auf Gesichtshöhe ein.',
          'Greife das Seil mit beiden Händen.',
          'Ziehe das Seil kontrolliert Richtung Gesicht.',
          'Führe die Hände langsam wieder nach vorne.',
        ],
        tips: [
          'Die Ellenbogen bleiben hoch.',
          'Ziehe nicht mit dem unteren Rücken.',
          'Perfekt als saubere Kontrollübung.',
        ],
      },
      {
        id: 'upright_row',
        name: 'Aufrechtes Rudern',
        category: 'Schulter',
        description:
          'Aufrechtes Rudern trainiert Schulter und oberen Trapezmuskel.',
        execution: [
          'Halte eine Langhantel, Kurzhanteln oder ein Kabel vor dem Körper.',
          'Ziehe das Gewicht kontrolliert nach oben.',
          'Führe die Ellenbogen nach außen oben.',
          'Senke das Gewicht langsam wieder ab.',
        ],
        tips: [
          'Gehe nur so hoch, wie es sich für deine Schultern gut anfühlt.',
          'Vermeide ruckartige Bewegungen.',
          'Bei Schulterproblemen vorsichtig einsetzen.',
        ],
      },
    ],
  },

  arms: {
    label: 'Arme',
    subtitle: 'Übungen für Bizeps, Trizeps und Unterarme',
    exercises: [
      {
        id: 'biceps_curl',
        name: 'Bizeps Curls',
        category: 'Bizeps',
        description:
          'Bizeps Curls trainieren hauptsächlich den Bizeps und sind eine klassische Armübung.',
        execution: [
          'Halte die Hanteln seitlich am Körper.',
          'Beuge die Ellenbogen und führe die Hanteln kontrolliert nach oben.',
          'Spanne den Bizeps oben kurz an.',
          'Senke die Hanteln langsam wieder ab.',
        ],
        tips: [
          'Die Ellenbogen bleiben möglichst ruhig.',
          'Vermeide Schwung aus dem Oberkörper.',
          'Kontrolliere besonders die Abwärtsbewegung.',
        ],
      },
      {
        id: 'hammer_curl',
        name: 'Hammer Curls',
        category: 'Bizeps',
        description:
          'Hammer Curls trainieren Bizeps, Brachialis und Unterarme.',
        execution: [
          'Halte die Kurzhanteln mit neutralem Griff.',
          'Beuge die Ellenbogen und führe die Hanteln nach oben.',
          'Halte oben kurz die Spannung.',
          'Senke die Hanteln kontrolliert ab.',
        ],
        tips: [
          'Die Handflächen zeigen zueinander.',
          'Arbeite ohne Schwung.',
          'Sehr gut für dickere Arme und Unterarmkraft.',
        ],
      },
      {
        id: 'preacher_curl',
        name: 'Preacher Curls',
        category: 'Bizeps',
        description:
          'Preacher Curls isolieren den Bizeps stärker, weil die Oberarme fixiert sind.',
        execution: [
          'Setze dich an die Preacher-Bank.',
          'Lege die Oberarme stabil auf das Polster.',
          'Beuge die Ellenbogen kontrolliert.',
          'Senke das Gewicht langsam wieder ab.',
        ],
        tips: [
          'Nicht unten ruckartig aus der Dehnung ziehen.',
          'Nutze kontrollierte Wiederholungen.',
          'Wähle ein Gewicht, das du sauber bewegen kannst.',
        ],
      },
      {
        id: 'triceps_pushdown',
        name: 'Trizepsdrücken am Kabel',
        category: 'Trizeps',
        description:
          'Trizepsdrücken am Kabel trainiert den Trizeps kontrolliert und gelenkschonend.',
        execution: [
          'Stelle dich stabil vor den Kabelzug.',
          'Halte die Ellenbogen nah am Körper.',
          'Drücke den Griff nach unten, bis die Arme fast gestreckt sind.',
          'Führe das Gewicht langsam zurück.',
        ],
        tips: [
          'Die Oberarme bleiben ruhig.',
          'Spanne den Trizeps unten bewusst an.',
          'Vermeide Schwung aus Schulter oder Rücken.',
        ],
      },
      {
        id: 'skull_crushers',
        name: 'Skull Crushers',
        category: 'Trizeps',
        description:
          'Skull Crushers trainieren den Trizeps mit Fokus auf Armstreckung im Liegen.',
        execution: [
          'Lege dich auf eine Bank und halte die Hantel über dir.',
          'Beuge die Ellenbogen kontrolliert.',
          'Senke das Gewicht Richtung Stirn oder leicht dahinter.',
          'Strecke die Arme wieder nach oben.',
        ],
        tips: [
          'Halte die Oberarme möglichst stabil.',
          'Bewege nur die Unterarme.',
          'Starte mit leichtem Gewicht.',
        ],
      },
      {
        id: 'overhead_extension',
        name: 'Overhead Trizeps Extension',
        category: 'Trizeps',
        description:
          'Overhead Trizeps Extensions trainieren besonders den langen Kopf des Trizeps.',
        execution: [
          'Halte eine Kurzhantel oder ein Seil über bzw. hinter dem Kopf.',
          'Beuge die Ellenbogen kontrolliert.',
          'Strecke die Arme wieder nach oben oder vorne.',
          'Halte die Bewegung ruhig und stabil.',
        ],
        tips: [
          'Die Ellenbogen bleiben möglichst eng.',
          'Nicht ins Hohlkreuz fallen.',
          'Sehr gut als Ergänzung zu Pushdowns.',
        ],
      },
      {
        id: 'wrist_curl',
        name: 'Wrist Curls',
        category: 'Unterarme',
        description:
          'Wrist Curls trainieren die Unterarmbeuger und Griffkraft.',
        execution: [
          'Setze dich hin und lege die Unterarme auf die Oberschenkel oder eine Bank.',
          'Halte eine leichte Hantel.',
          'Beuge die Handgelenke kontrolliert nach oben.',
          'Senke sie langsam wieder ab.',
        ],
        tips: [
          'Nutze leichte Gewichte.',
          'Arbeite langsam und sauber.',
          'Nicht aus den Ellenbogen bewegen.',
        ],
      },
    ],
  },

  core: {
    label: 'Bauch',
    subtitle: 'Übungen für Core, Bauch und Rumpfstabilität',
    exercises: [
      {
        id: 'crunches',
        name: 'Crunches',
        category: 'Bauch',
        description:
          'Crunches trainieren die gerade Bauchmuskulatur und eignen sich gut für kontrollierte Bauchspannung.',
        execution: [
          'Lege dich auf den Rücken und stelle die Beine auf.',
          'Hebe den oberen Rücken kontrolliert vom Boden ab.',
          'Spanne den Bauch oben bewusst an.',
          'Senke dich langsam wieder ab.',
        ],
        tips: [
          'Ziehe nicht am Nacken.',
          'Die Bewegung ist klein und kontrolliert.',
          'Atme beim Hochkommen aus.',
        ],
      },
      {
        id: 'leg_raises',
        name: 'Leg Raises',
        category: 'Bauch',
        description:
          'Leg Raises trainieren vor allem unteren Bauchbereich und Hüftbeuger.',
        execution: [
          'Lege dich flach auf den Rücken.',
          'Halte die Beine möglichst gestreckt.',
          'Hebe die Beine kontrolliert nach oben.',
          'Senke sie langsam ab, ohne den unteren Rücken stark abzuheben.',
        ],
        tips: [
          'Spanne den Bauch aktiv an.',
          'Gehe nur so tief, wie du die Kontrolle hältst.',
          'Bei Bedarf die Knie leicht beugen.',
        ],
      },
      {
        id: 'plank',
        name: 'Plank',
        category: 'Core',
        description:
          'Die Plank trainiert die Rumpfstabilität, Bauchmuskulatur, Schultern und Gesäß.',
        execution: [
          'Stütze dich auf Unterarme und Zehen.',
          'Halte den Körper in einer geraden Linie.',
          'Spanne Bauch und Gesäß aktiv an.',
          'Halte die Position kontrolliert.',
        ],
        tips: [
          'Lasse die Hüfte nicht durchhängen.',
          'Halte den Nacken neutral.',
          'Qualität ist wichtiger als lange Zeit.',
        ],
      },
      {
        id: 'russian_twists',
        name: 'Russian Twists',
        category: 'Core',
        description:
          'Russian Twists trainieren die seitliche Bauchmuskulatur und Rumpfrotation.',
        execution: [
          'Setze dich auf den Boden und lehne den Oberkörper leicht zurück.',
          'Spanne den Bauch an.',
          'Rotiere den Oberkörper kontrolliert von Seite zu Seite.',
          'Optional kannst du ein Gewicht halten.',
        ],
        tips: [
          'Bewege nicht nur die Arme, sondern rotiere den Oberkörper.',
          'Halte den Rücken stabil.',
          'Arbeite langsam statt hektisch.',
        ],
      },
      {
        id: 'ab_wheel',
        name: 'Ab Wheel',
        category: 'Core',
        description:
          'Das Ab Wheel ist eine anspruchsvolle Core-Übung für Bauch, Rumpfspannung und Schulterstabilität.',
        execution: [
          'Starte kniend mit dem Ab Wheel vor dir.',
          'Spanne Bauch und Gesäß fest an.',
          'Rolle kontrolliert nach vorne.',
          'Ziehe dich über die Bauchspannung wieder zurück.',
        ],
        tips: [
          'Nicht ins Hohlkreuz fallen.',
          'Starte mit kleinem Bewegungsradius.',
          'Diese Übung ist deutlich schwerer als sie aussieht.',
        ],
      },
      {
        id: 'cable_crunch',
        name: 'Cable Crunches',
        category: 'Bauch',
        description:
          'Cable Crunches trainieren die Bauchmuskulatur mit Zusatzgewicht am Kabelzug.',
        execution: [
          'Knie dich vor den Kabelzug und greife das Seil.',
          'Halte die Hüfte relativ stabil.',
          'Rolle den Oberkörper kontrolliert nach unten ein.',
          'Führe den Oberkörper langsam zurück.',
        ],
        tips: [
          'Ziehe nicht nur mit den Armen.',
          'Konzentriere dich auf das Einrollen des Bauchs.',
          'Nutze ein moderates Gewicht.',
        ],
      },
      {
        id: 'hanging_knee_raise',
        name: 'Hanging Knee Raises',
        category: 'Bauch',
        description:
          'Hanging Knee Raises trainieren Bauch, Hüftbeuger und Griffkraft.',
        execution: [
          'Hänge dich stabil an eine Stange oder nutze eine Dip-Station.',
          'Spanne den Bauch an.',
          'Ziehe die Knie kontrolliert Richtung Brust.',
          'Senke die Beine langsam wieder ab.',
        ],
        tips: [
          'Vermeide starkes Schwingen.',
          'Arbeite kontrolliert.',
          'Für mehr Schwierigkeit kannst du gestreckte Beine nutzen.',
        ],
      },
    ],
  },
};