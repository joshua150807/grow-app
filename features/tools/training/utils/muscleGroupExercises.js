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
          'Bankdrücken ist eine der effektivsten Übungen für den gesamten Brustmuskel. Zusätzlich werden Schulter und Trizeps belastet.',
        execution: [
          'Ziehe die Schulterblätter leicht nach hinten und unten.',
          'Senke das Gewicht kontrolliert bis zur Brust ab.',
          'Drücke das Gewicht kraftvoll nach oben, ohne die Spannung in der Brust zu verlieren.',
        ],
        tips: [
          'Die Brust sollte während der gesamten Bewegung angespannt bleiben.',
          'Federe das Gewicht nicht von der Brust ab.',
          'Kontrolle ist wichtiger als Gewicht.',
        ],
      },
      {
        id: 'incline_bench_press',
        name: 'Schrägbankdrücken',
        category: 'Brust',
        description:
          'Schrägbankdrücken trainiert vor allem die obere Brust. Wie bei fast allen Druckübungen arbeitet aber auch die vordere Schulter mit.',
        execution: [
          'Stelle die Bank auf eine leichte bis mittlere Schräglage von etwa 30 bis 45 Grad ein.',
          'Senke das Gewicht kontrolliert bis auf Höhe der oberen Brust ab.',
          'Drücke das Gewicht anschließend wieder nach oben und halte die Brust während der gesamten Bewegung angespannt.',
        ],
        tips: [
          'Eine zu steile Bank verlagert die Belastung stärker auf die Schultern.',
          'Arbeite kontrolliert und vermeide Schwung.',
          'Bilde kein starkes Hohlkreuz.',
        ],
      },
      {
        id: 'dumbbell_press',
        name: 'Kurzhantel Bankdrücken',
        category: 'Brust',
        description:
          'Kurzhantel Bankdrücken trainiert die gesamte Brust und ermöglicht häufig einen größeren Bewegungsradius als die Langhantel.',
        execution: [
          'Senke die Hanteln kontrolliert neben die Brust ab.',
          'Nutze die Dehnung in der Brust am tiefsten Punkt.',
          'Drücke die Hanteln anschließend wieder nach oben.',
        ],
        tips: [
          'Kontrolliere die Hanteln während der gesamten Bewegung.',
          'Halte die Schultern während der Bewegung unten.',
          'Nutze die Dehnung bewusst.',
        ],
      },
      {
        id: 'chest_fly',
        name: 'Butterfly / Chest Fly',
        category: 'Brust',
        description:
          'Butterfly isoliert die Brust und eignet sich besonders gut, um Spannung und Muskelgefühl aufzubauen.',
        execution: [
          'Öffne die Arme kontrolliert, bis eine gute Dehnung in der Brust entsteht.',
          'Führe die Arme anschließend wieder zusammen.',
          'Denke dabei daran, die Ellenbogen zusammenzuführen und nicht nur die Hände.',
        ],
        tips: [
          'Trainiere nicht zu schwer.',
          'Nutze die Dehnung kontrolliert.',
          'Spanne die Brust bewusst an.',
        ],
      },
      {
        id: 'cable_fly',
        name: 'Kabel Flys',
        category: 'Brust',
        description:
          'Kabel Flys halten die Brust über die gesamte Bewegung unter Spannung und ermöglichen verschiedene Belastungsschwerpunkte.',
        execution: [
          'Öffne die Arme kontrolliert und spüre die Dehnung in der Brust.',
          'Führe die Hände vor dem Körper zusammen.',
          'Halte die Spannung kurz und lasse das Gewicht langsam zurück.',
        ],
        tips: [
          'Halte die Ellenbogen leicht gebeugt.',
          'Führe die Bewegung aus der Brust aus.',
          'Ziehe nicht mit den Schultern.',
        ],
      },
      {
        id: 'push_ups',
        name: 'Liegestütze',
        category: 'Brust',
        description:
          'Liegestütze trainieren die gesamte Brust sowie Schulter, Trizeps und Rumpf.',
        execution: [
          'Halte den Körper von Kopf bis Fuß möglichst gerade.',
          'Senke dich kontrolliert bis kurz über den Boden ab.',
          'Drücke dich anschließend wieder nach oben.',
        ],
        tips: [
          'Halte die Körperspannung.',
          'Bilde keinen Buckel.',
          'Lasse die Brust kontrolliert arbeiten.',
        ],
      },
      {
        id: 'dips_chest',
        name: 'Dips Brustfokus',
        category: 'Brust',
        description:
          'Dips mit leichter Vorlage belasten besonders die untere Brust und zusätzlich den Trizeps.',
        execution: [
          'Lehne den Oberkörper leicht nach vorne.',
          'Senke dich kontrolliert ab, bis eine gute Dehnung in der Brust entsteht.',
          'Drücke dich anschließend wieder langsam nach oben.',
        ],
        tips: [
          'Bleibe nicht zu aufrecht, wenn die Brust im Fokus stehen soll.',
          'Führe die Bewegung kontrolliert aus.',
          'Nutze die Dehnung im unteren Bereich.',
        ],
      },
    ],
  },

  back: {
    label: 'Rücken',
    subtitle: 'Übungen für Lat, oberen Rücken und Rückenstrecker',
    exercises: [
      {
        id: 'chin_ups',
        name: 'Chin Ups',
        category: 'Latissimus',
        description:
          'Chin Ups trainieren vor allem den Latissimus und den Bizeps. Durch den Untergriff wird der Bizeps stärker beteiligt als bei normalen Klimmzügen.',
        execution: [
          'Greife die Stange im Untergriff ungefähr schulterbreit.',
          'Ziehe die Ellenbogen Richtung Hüfte.',
          'Senke dich anschließend kontrolliert wieder ab.',
        ],
        tips: [
          'Ziehe mit den Ellenbogen, nicht mit den Händen.',
          'Nutze die Dehnung am unteren Punkt.',
          'Vermeide Schwung aus den Beinen.',
        ],
      },
      {
        id: 'pull_ups',
        name: 'Klimmzüge',
        category: 'Latissimus',
        description:
          'Klimmzüge gehören zu den effektivsten Übungen für den gesamten Rücken und trainieren besonders den Latissimus.',
        execution: [
          'Greife die Stange etwas breiter als schulterbreit.',
          'Ziehe die Ellenbogen nach unten Richtung Hüfte.',
          'Senke dich kontrolliert zurück in die Dehnung.',
        ],
        tips: [
          'Ziehe die Brust leicht zur Stange.',
          'Denke daran, aus dem Rücken und nicht nur aus den Armen zu ziehen.',
          'Nutze die Dehnung gezielt.',
        ],
      },
      {
        id: 'wide_grip_lat_pulldown',
        name: 'Breiter Latzug',
        category: 'Latissimus',
        description:
          'Der breite Latzug trainiert vor allem den oberen und äußeren Bereich des Latissimus.',
        execution: [
          'Greife die Stange breit und lehne dich leicht zurück.',
          'Ziehe die Stange kontrolliert zur oberen Brust.',
          'Lasse das Gewicht langsam wieder nach oben.',
        ],
        tips: [
          'Ziehe die Ellenbogen nach unten.',
          'Ziehe die Stange nicht hinter den Kopf.',
          'Halte die Schultern unten.',
        ],
      },
      {
        id: 'medium_grip_lat_pulldown',
        name: 'Mittlerer Latzug',
        category: 'Latissimus',
        description:
          'Der mittlere Griff bietet häufig die beste Kombination aus Bewegungsradius und Rückenaktivierung.',
        execution: [
          'Greife die Stange etwa schulterbreit.',
          'Ziehe die Ellenbogen Richtung Hosentaschen.',
          'Lasse das Gewicht kontrolliert zurück.',
        ],
        tips: [
          'Lehne dich leicht zurück.',
          'Hebe die Brust an.',
          'Nutze die Dehnung.',
        ],
      },
      {
        id: 'close_grip_lat_pulldown',
        name: 'Enger Latzug',
        category: 'Latissimus',
        description:
          'Der enge Griff belastet besonders den unteren und mittleren Bereich des Latissimus.',
        execution: [
          'Greife den engen Griff und richte die Brust auf.',
          'Ziehe die Ellenbogen eng am Körper Richtung Hüfte.',
          'Lasse das Gewicht langsam zurück.',
        ],
        tips: [
          'Ziehe den Griff zur unteren Brust.',
          'Nutze den großen Bewegungsradius.',
          'Arbeite nicht mit Schwung.',
        ],
      },
      {
        id: 'cable_row',
        name: 'Enges Rudern',
        category: 'Mittlerer Rücken',
        description:
          'Enges Rudern trainiert den mittleren Rücken sowie den Latissimus.',
        execution: [
          'Sitze stabil und halte die Brust aufrecht.',
          'Ziehe den Griff Richtung Bauchnabel.',
          'Lasse das Gewicht kontrolliert zurück in die Dehnung.',
        ],
        tips: [
          'Ziehe die Ellenbogen Richtung Hüfte.',
          'Falle nicht ins Hohlkreuz.',
          'Bewege die Schulterblätter aktiv.',
        ],
      },
      {
        id: 'wide_row',
        name: 'Breites Rudern',
        category: 'Oberer Rücken',
        description:
          'Breites Rudern trainiert vor allem die hintere Schulter, die Rhomboiden und den oberen Rücken.',
        execution: [
          'Greife etwas breiter als schulterbreit.',
          'Ziehe die Ellenbogen nach außen und hinten.',
          'Führe das Gewicht kontrolliert zurück und bewege die Schulterblätter aktiv.',
        ],
        tips: [
          'Halte die Brust aufrecht.',
          'Nutze lieber weniger Gewicht und eine bessere Ausführung.',
          'Arbeite nicht mit Schwung.',
        ],
      },
      {
        id: 't_bar_row',
        name: 'T-Bar Rudern',
        category: 'Oberer Rücken',
        description:
          'T-Bar Rudern trainiert vor allem den oberen Rücken.',
        execution: [
          'Positioniere dich stabil an der Maschine.',
          'Ziehe das Gewicht Richtung unteren Brustkorb und führe die Schulterblätter zusammen.',
          'Senke das Gewicht kontrolliert wieder ab.',
        ],
        tips: [
          'Halte den Rücken stabil.',
          'Führe die Ellenbogen aktiv nach hinten.',
          'Reiße nicht aus dem unteren Rücken.',
        ],
      },
      {
        id: 'single_arm_cable_row',
        name: 'Einarmiges Kabelrudern',
        category: 'Latissimus',
        description:
          'Einarmiges Rudern eignet sich hervorragend, um den Latissimus gezielt zu trainieren und Seitenunterschiede auszugleichen.',
        execution: [
          'Lehne dich leicht in das Gewicht hinein, um mehr Dehnung zu erzeugen.',
          'Ziehe den Ellenbogen Richtung Hosentasche.',
          'Lasse das Gewicht langsam wieder zurück.',
        ],
        tips: [
          'Nutze die Dehnung bewusst.',
          'Rotiere nicht stark mit dem Oberkörper.',
          'Spanne den Latissimus aktiv an.',
        ],
      },
      {
        id: 'high_row',
        name: 'High Row',
        category: 'Oberer Rücken',
        description:
          'Die High Row trainiert den oberen Latissimus, den Teres Major und den oberen Rücken.',
        execution: [
          'Lehne dich leicht in das Gewicht hinein.',
          'Ziehe die Ellenbogen schräg nach unten Richtung Hosentaschen.',
          'Führe das Gewicht kontrolliert zurück.',
        ],
        tips: [
          'Nutze die Dehnung am Startpunkt.',
          'Halte die Brust aufrecht.',
          'Arbeite nicht mit Schwung.',
        ],
      },
      {
        id: 'pullover',
        name: 'Überzüge',
        category: 'Latissimus',
        description:
          'Überzüge trainieren vor allem den Latissimus über eine große Dehnung.',
        execution: [
          'Strecke die Arme leicht gebeugt vor den Körper.',
          'Ziehe das Gewicht in einem Bogen Richtung Hüfte.',
          'Lasse das Gewicht langsam zurück.',
        ],
        tips: [
          'Nutze ein langes Seil.',
          'Führe die Bewegung aus dem Rücken aus.',
          'Nutze die Dehnung.',
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
        category: 'Rückenstrecker',
        description:
          'Kreuzheben trainiert den gesamten hinteren Körper, insbesondere Rückenstrecker, Gesäß und Beinbeuger.',
        execution: [
          'Stelle dich stabil vor die Hantel.',
          'Hebe das Gewicht mit neutralem Rücken an.',
          'Senke die Hantel kontrolliert wieder ab.',
        ],
        tips: [
          'Halte den Rücken neutral.',
          'Baue Spannung im gesamten Körper auf.',
          'Hebe nicht mit rundem Rücken.',
        ],
      },
      {
        id: 'back_extension',
        name: 'Rückenstrecker Maschine',
        category: 'Rückenstrecker',
        description:
          'Diese Übung trainiert vor allem die Rückenstrecker entlang der Wirbelsäule.',
        execution: [
          'Positioniere dich stabil in der Maschine.',
          'Strecke den Oberkörper kontrolliert nach oben.',
          'Senke ihn anschließend langsam wieder ab.',
        ],
        tips: [
          'Überstrecke nicht ins Hohlkreuz.',
          'Führe die Bewegung kontrolliert aus.',
          'Halte die Spannung im unteren Rücken.',
        ],
      },
      {
        id: 'close_grip_lat_machine',
        name: 'Latmaschine enger Griff',
        category: 'Latissimus',
        description:
          'Die Latmaschine mit engem Griff trainiert vor allem den unteren und mittleren Latissimus.',
        execution: [
          'Hebe die Brust an und lehne dich leicht zurück.',
          'Ziehe die Ellenbogen Richtung Hosentaschen.',
          'Führe das Gewicht kontrolliert zurück.',
        ],
        tips: [
          'Nutze die volle Dehnung.',
          'Ziehe nicht nur mit den Armen.',
          'Halte die Spannung im Latissimus.',
        ],
      },
      {
        id: 'wide_grip_lat_machine',
        name: 'Latmaschine breiter Griff',
        category: 'Latissimus',
        description:
          'Die Latmaschine mit breitem Griff trainiert besonders den oberen und äußeren Bereich des Latissimus.',
        execution: [
          'Greife die Griffe breit.',
          'Ziehe die Ellenbogen kontrolliert nach unten.',
          'Lasse das Gewicht langsam zurück.',
        ],
        tips: [
          'Halte die Brust aufrecht.',
          'Halte die Schultern unten.',
          'Ziehe nicht hinter den Kopf.',
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
        name: 'Schulterdrücken Maschine',
        category: 'Vordere Schulter',
        description:
          'Schulterdrücken an der Maschine trainiert vor allem die vordere Schulter. Durch die geführte Bewegung eignet sich die Übung besonders gut für Anfänger und ermöglicht eine stabile Ausführung.',
        execution: [
          'Stelle den Sitz so ein, dass sich die Griffe etwas unterhalb der Schulterhöhe befinden.',
          'Drücke das Gewicht kontrolliert nach oben.',
          'Senke das Gewicht langsam wieder ab, bis du eine gute Dehnung in der Schulter spürst.',
        ],
        tips: [
          'Ziehe die Schultern nicht zu den Ohren.',
          'Greife breit und halte die Ellenbogen in einer Linie mit den Griffen.',
          'Bilde kein starkes Hohlkreuz.',
        ],
      },
      {
        id: 'dumbbell_shoulder_press',
        name: 'Kurzhantel Schulterdrücken',
        category: 'Vordere Schulter',
        description:
          'Diese Übung trainiert hauptsächlich die vordere Schulter und fordert zusätzlich die Stabilität der Schultermuskulatur.',
        execution: [
          'Halte die Hanteln auf Schulterhöhe.',
          'Drücke die Hanteln kontrolliert über den Kopf.',
          'Senke sie anschließend langsam wieder ab und nutze den vollen Bewegungsradius.',
        ],
        tips: [
          'Halte den Oberkörper gerade und stabil.',
          'Stelle die Rückenlehne der Bank leicht nach hinten.',
          'Führe die Übung kontrolliert aus.',
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
        name: 'Kurzhantel Seitheben',
        category: 'Seitliche Schulter',
        description:
          'Kurzhantel Seitheben ist eine der besten Übungen für die seitliche Schulter und sorgt für mehr Schulterbreite.',
        execution: [
          'Halte die Hanteln seitlich neben dem Körper.',
          'Hebe die Arme kontrolliert bis etwa auf Schulterhöhe an.',
          'Senke das Gewicht langsam wieder ab und halte die Schultern stabil.',
        ],
        tips: [
          'Denke daran, die Ellenbogen anzuheben und nicht die Hände.',
          'Halte die Schultern unten.',
          'Arbeite nicht mit Schwung.',
        ],
      },
      {
        id: 'cable_lateral_raise',
        name: 'Seitheben am Kabelturm',
        category: 'Seitliche Schulter',
        description:
          'Durch den konstanten Widerstand des Kabels bleibt die seitliche Schulter während der gesamten Bewegung unter Spannung.',
        execution: [
          'Benutze eine Armschlaufe und stelle das Kabel ungefähr auf Hüfthöhe ein.',
          'Hebe den Arm kontrolliert zur Seite an.',
          'Lasse das Gewicht langsam zurück.',
        ],
        tips: [
          'Führe die Bewegung aus der Schulter aus.',
          'Führe den Ellenbogen nach außen.',
          'Fixiere die Schulterblätter.',
        ],
      },
      {
        id: 'lateral_raise_machine',
        name: 'Seitheben Maschine',
        category: 'Seitliche Schulter',
        description:
          'Die Maschine ermöglicht eine stabile Ausführung und eignet sich hervorragend, um die seitliche Schulter gezielt zu trainieren.',
        execution: [
          'Positioniere die Arme an den Polstern.',
          'Hebe die Arme kontrolliert zur Seite.',
          'Führe das Gewicht langsam zurück.',
        ],
        tips: [
          'Arbeite ohne Schwung.',
          'Halte die Spannung auf der Schulter.',
          'Nutze den gesamten Bewegungsradius.',
        ],
      },
      {
        id: 'reverse_pec_deck',
        name: 'Reverse Butterfly',
        category: 'Hintere Schulter',
        description:
          'Reverse Butterfly trainiert hauptsächlich die hintere Schulter und unterstützt eine ausgeglichene Schulterentwicklung.',
        execution: [
          'Setze dich mit der Brust an das Polster.',
          'Öffne die Arme kontrolliert nach hinten.',
          'Führe das Gewicht langsam wieder zurück.',
        ],
        tips: [
          'Bewege die Ellenbogen nach außen.',
          'Führe die Schulterblätter zusammen und halte sie kurz angespannt.',
          'Spanne die hintere Schulter gezielt an.',
        ],
      },
      {
        id: 'face_pulls',
        name: 'Face Pulls',
        category: 'Hintere Schulter',
        description:
          'Face Pulls trainieren die hintere Schulter und den oberen Rücken und tragen zu einer gesunden Schulterhaltung bei.',
        execution: [
          'Ziehe das Seil auf Augen- oder Stirnhöhe zu dir.',
          'Führe die Ellenbogen dabei nach außen und hinten.',
          'Lasse das Gewicht kontrolliert zurück.',
        ],
        tips: [
          'Halte die Schultern unten.',
          'Achte auf einen stabilen Stand.',
          'Ziehe nicht mit Schwung.',
        ],
      },
      {
        id: 'front_raise',
        name: 'Frontheben',
        category: 'Vordere Schulter',
        description:
          'Frontheben trainiert gezielt die vordere Schulter und eignet sich besonders als Ergänzung zu Druckübungen.',
        execution: [
          'Halte die Hanteln vor dem Körper.',
          'Hebe die Arme kontrolliert bis auf Schulterhöhe an.',
          'Senke das Gewicht langsam wieder ab.',
        ],
        tips: [
          'Hebe die Arme nicht zu hoch.',
          'Arbeite kontrolliert.',
          'Arbeite ohne Schwung.',
        ],
      },
      {
        id: 'reverse_fly',
        name: 'Reverse Flys',
        category: 'Hintere Schulter',
        description:
          'Reverse Flys trainieren vor allem die hintere Schulter und verbessern die Rückansicht der Schulterpartie.',
        execution: [
          'Beuge den Oberkörper leicht nach vorne.',
          'Öffne die Arme kontrolliert nach außen.',
          'Senke das Gewicht langsam wieder ab.',
        ],
        tips: [
          'Führe die Ellenbogen nach außen.',
          'Lasse die hintere Schulter arbeiten.',
          'Arbeite ohne Schwung.',
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

  biceps: {
    label: 'Bizeps',
    subtitle: 'Übungen für Bizeps, Brachialis und Armbeugung',
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
              id: 'preacher_curl',
              name: 'Scottcurl',
              category: 'Bizeps',
              description:
                'Scottcurls trainieren vor allem den kurzen Kopf des Bizeps. Durch die feste Position der Oberarme wird Schwung minimiert und der Bizeps muss die Arbeit übernehmen.',
              execution: [
                'Lege die Oberarme vollständig auf dem Polster ab.',
                'Beuge die Arme kontrolliert nach oben.',
                'Senke das Gewicht langsam wieder ab und nutze die volle Dehnung.',
              ],
              tips: [
                'Halte die Oberarme während der gesamten Bewegung ruhig.',
                'Nutze die Dehnung am untersten Punkt.',
                'Spanne den Bizeps am oberen Punkt bewusst an und nutze keinen Schwung.',
              ],
            },
      {
              id: 'hammer_curl',
              name: 'Hammercurls mit Kurzhanteln',
              category: 'Bizeps',
              description:
                'Hammercurls trainieren besonders den Brachialis und tragen zu mehr Armdicke bei.',
              execution: [
                'Halte die Hanteln mit neutralem Griff neben dem Körper.',
                'Beuge die Arme kontrolliert nach oben.',
                'Senke das Gewicht langsam und kontrolliert wieder ab.',
              ],
              tips: [
                'Halte die Handflächen während der gesamten Bewegung zueinander.',
                'Halte die Ellenbogen nah am Körper.',
                'Vermeide Schwung aus Rücken oder Hüfte.',
              ],
            },
      {
              id: 'cable_hammer_curl',
              name: 'Hammercurls am Kabelturm',
              category: 'Bizeps',
              description:
                'Durch den konstanten Widerstand des Kabels bleibt der Brachialis während der gesamten Bewegung unter Spannung.',
              execution: [
                'Greife das Seil mit neutralem Griff.',
                'Ziehe das Seil kontrolliert nach oben.',
                'Führe das Gewicht langsam zurück.',
              ],
              tips: [
                'Halte die Ellenbogen an einer festen Position.',
                'Nutze die Spannung des Kabels über den gesamten Bewegungsradius.',
                'Spanne die Arme am oberen Punkt bewusst an.',
              ],
            },
      {
              id: 'biceps_curl_machine',
              name: 'Bizepscurls Maschine',
              category: 'Bizeps',
              description:
                'Die Maschine trainiert den Bizeps isoliert und ermöglicht eine sehr kontrollierte Bewegung.',
              execution: [
                'Positioniere die Ellenbogen auf dem Polster.',
                'Beuge die Arme kontrolliert nach oben.',
                'Lasse das Gewicht langsam zurück.',
              ],
              tips: [
                'Nutze den gesamten Bewegungsradius.',
                'Halte die Schultern entspannt.',
                'Konzentriere dich auf die Spannung im Bizeps und nutze keinen Schwung.',
              ],
            },
      {
              id: 'arnold_curl',
              name: 'Arnold Curls',
              category: 'Bizeps',
              description:
                'Arnold Curls kombinieren eine Curlbewegung mit einer Drehung des Unterarms und trainieren den gesamten Bizeps.',
              execution: [
                'Starte mit neutralem Griff.',
                'Drehe die Hände während des Hochcurlens nach außen.',
                'Drehe sie beim Absenken wieder zurück.',
              ],
              tips: [
                'Führe die Drehung kontrolliert aus.',
                'Halte die Oberarme möglichst ruhig.',
                'Nutze die volle Bewegung von unten bis oben.',
              ],
            },
      {
              id: 'incline_curl',
              name: 'Schrägbankcurls',
              category: 'Bizeps',
              description:
                'Schrägbankcurls trainieren besonders den langen Kopf des Bizeps und erzeugen eine starke Dehnung.',
              execution: [
                'Lehne dich an eine Schrägbank und lasse die Arme hinter dem Körper hängen.',
                'Beuge die Arme kontrolliert nach oben.',
                'Senke das Gewicht langsam wieder ab.',
              ],
              tips: [
                'Lasse die Oberarme während der Bewegung hinter dem Körper.',
                'Nutze die Dehnung am unteren Punkt.',
                'Vermeide Schwung aus Schulter oder Rücken.',
              ],
            },
      {
              id: 'cable_curl',
              name: 'Kabelcurls',
              category: 'Bizeps',
              description:
                'Kabelcurls trainieren den gesamten Bizeps und sorgen durch den konstanten Widerstand für eine gleichmäßige Belastung.',
              execution: [
                'Stelle dich aufrecht vor den Kabelturm.',
                'Beuge die Arme kontrolliert nach oben.',
                'Lasse das Gewicht langsam zurück.',
              ],
              tips: [
                'Halte die Ellenbogen an einer festen Position.',
                'Spanne den Bizeps am oberen Punkt bewusst an.',
                'Nutze die Spannung des Kabels während der gesamten Bewegung.',
              ],
            },
    ],
  },

  triceps: {
    label: 'Trizeps',
    subtitle: 'Übungen für alle drei Köpfe des Trizeps',
    exercises: [
      {
              id: 'dips_triceps',
              name: 'Dips',
              category: 'Trizeps',
              description:
                'Dips trainieren vor allem den Trizeps. Je aufrechter der Oberkörper bleibt, desto stärker arbeitet der Trizeps.',
              execution: [
                'Stütze dich auf den Griffen ab und halte den Oberkörper möglichst aufrecht.',
                'Senke dich kontrolliert ab, bis du eine gute Dehnung im Trizeps spürst.',
                'Drücke dich anschließend wieder nach oben und strecke die Arme vollständig aus.',
              ],
              tips: [
                'Halte die Ellenbogen möglichst nah am Körper.',
                'Arbeite kontrolliert und lasse dich nicht nach unten fallen.',
                'Strecke die Arme oben bewusst aus.',
              ],
            },
      {
              id: 'single_arm_triceps_extension',
              name: 'Trizepsstrecken einarmig',
              category: 'Trizeps',
              description:
                'Diese Übung trainiert besonders den langen Kopf des Trizeps und sorgt durch die starke Dehnung häufig für ein sehr gutes Muskelgefühl.',
              execution: [
                'Positioniere dich am Kabelzug und halte den Ellenbogen möglichst ruhig.',
                'Strecke den Arm kontrolliert aus und halte dich dabei am Kabelturm fest.',
                'Lasse das Gewicht langsam zurück, bis eine deutliche Spannung entsteht.',
              ],
              tips: [
                'Halte den Ellenbogen während der Bewegung stabil.',
                'Benutze einen Griff, mit dem sich die Bewegung möglichst natürlich anfühlt.',
                'Arbeite ohne Schwung und kontrolliere das Gewicht.',
              ],
            },
      {
              id: 'triceps_pushdown',
              name: 'Trizepsdrücken am Kabel',
              category: 'Trizeps',
              description:
                'Trizeps Pushdowns trainieren vor allem den seitlichen Kopf des Trizeps und eignen sich hervorragend, um Spannung auf dem Muskel aufzubauen.',
              execution: [
                'Stelle dich aufrecht vor den Kabelturm.',
                'Drücke das Gewicht kontrolliert nach unten.',
                'Strecke die Arme vollständig aus und führe das Gewicht langsam zurück.',
              ],
              tips: [
                'Halte die Ellenbogen eng am Körper.',
                'Spanne die Arme am unteren Punkt bewusst an.',
                'Schwinge nicht mit dem Oberkörper.',
              ],
            },
      {
              id: 'triceps_extension_machine',
              name: 'Trizepsstrecker Maschine',
              category: 'Trizeps',
              description:
                'Die Maschine ermöglicht eine stabile Bewegung und eignet sich besonders gut, um den Trizeps isoliert zu trainieren.',
              execution: [
                'Stelle die Maschine passend auf deine Körpergröße ein und achte dabei auf die Position des Maschinengelenks.',
                'Strecke die Arme kontrolliert aus.',
                'Lasse das Gewicht langsam zurück und nutze den gesamten Bewegungsradius.',
              ],
              tips: [
                'Halte die Arme und Handgelenke stabil.',
                'Spanne den Trizeps aktiv an.',
                'Arbeite kontrolliert und nutze keinen Schwung.',
              ],
            },
      {
              id: 'overhead_extension',
              name: 'Überkopf Trizepsstrecken',
              category: 'Trizeps',
              description:
                'Overhead Extensions trainieren besonders den langen Kopf des Trizeps, da dieser in der Überkopfposition stark gedehnt wird.',
              execution: [
                'Halte das Gewicht über dem Kopf.',
                'Senke es kontrolliert hinter den Kopf ab.',
                'Strecke die Arme anschließend wieder vollständig aus.',
              ],
              tips: [
                'Halte die Ellenbogen möglichst eng am Körper.',
                'Nutze die Dehnung am untersten Punkt.',
                'Achte auf einen stabilen Stand und wenig Schwung.',
              ],
            },
      {
              id: 'skull_crushers',
              name: 'Stirndrücken',
              category: 'Trizeps',
              description:
                'Skull Crusher trainieren den langen Kopf des Trizeps und kombinieren Dehnung und Spannung sehr gut.',
              execution: [
                'Lege dich auf eine Bank und halte das Gewicht über den Schultern.',
                'Senke das Gewicht kontrolliert Richtung Stirn oder leicht hinter den Kopf.',
                'Strecke die Arme anschließend wieder aus.',
              ],
              tips: [
                'Halte die Oberarme möglichst ruhig.',
                'Senke das Gewicht langsam ab.',
                'Benutze ein Gewicht, das du sauber kontrollieren kannst.',
              ],
            },
      {
              id: 'french_press',
              name: 'French Press',
              category: 'Trizeps',
              description:
                'Die French Press trainiert vor allem den langen Kopf des Trizeps.',
              execution: [
                'Lege dich auf die Bank und führe das Gewicht über den Kopf.',
                'Senke das Gewicht langsam hinter den Kopf, bis der Trizeps vollständig gedehnt ist.',
                'Strecke die Arme anschließend wieder vollständig aus.',
              ],
              tips: [
                'Halte die Ellenbogen möglichst stabil.',
                'Arbeite kontrolliert.',
                'Halte den Trizeps während der gesamten Bewegung unter Spannung.',
              ],
            },
    ],
  },

  forearms: {
    label: 'Unterarme',
    subtitle: 'Übungen für Unterarme und Griffkraft',
    exercises: [
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
                'Bewege nicht aus den Ellenbogen.',
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