-- UUIDv5 namespace: c4283e2a-b750-48c6-a890-71cede7c2d0b
-- UUIDv5 name input: the exact UTF-8 system_key value.

create or replace function public.is_training_v2_system_muscle(value text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select value = any(array[
    'abs', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms',
    'front_delts', 'glutes', 'hamstrings', 'hip_flexors', 'lats', 'lower_back',
    'obliques', 'quadriceps', 'rear_delts', 'side_delts', 'traps', 'triceps',
    'upper_back'
  ]::text[]);
$$;

create or replace function public.is_training_v2_system_equipment(value text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select value = any(array[
    'barbell', 'bench', 'cable', 'dip_bars', 'dumbbell', 'elliptical', 'ez_bar',
    'kettlebell', 'landmine', 'machine', 'mat', 'pull_up_bar', 'plyo_box',
    'rowing_machine', 'smith_machine', 'squat_rack', 'stair_climber',
    'stationary_bike', 'treadmill', 'trap_bar'
  ]::text[]);
$$;

create or replace function public.is_training_v2_system_muscle_array(items text[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    public.is_training_v2_clean_text_array(items)
    and not exists (
      select 1
      from unnest(items) as item
      where not public.is_training_v2_system_muscle(item)
    );
$$;

create or replace function public.is_training_v2_system_equipment_array(items text[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    public.is_training_v2_clean_text_array(items)
    and not exists (
      select 1
      from unnest(items) as item
      where not public.is_training_v2_system_equipment(item)
    );
$$;

create temporary table if not exists training_v2_system_catalog_expected (
  id uuid primary key,
  system_key text not null unique,
  name text not null,
  category text not null,
  load_type text not null,
  main_muscle text,
  supporting_muscles text[] not null,
  equipment text[] not null,
  is_home boolean not null,
  is_gym boolean not null,
  is_bodyweight boolean not null
);

truncate table training_v2_system_catalog_expected;

insert into training_v2_system_catalog_expected
  (id,system_key,name,category,load_type,main_muscle,supporting_muscles,equipment,is_home,is_gym,is_bodyweight)
values
  ('bda8916d-056a-5b1c-b535-b6f94443bce1','barbell_back_squat','Kniebeuge mit Langhantel','strength','total_weight','quadriceps','{glutes,hamstrings,lower_back}','{barbell,squat_rack}',false,true,false),
  ('d2caaa38-09c9-5202-8008-f24db63f0878','barbell_front_squat','Frontkniebeuge mit Langhantel','strength','total_weight','quadriceps','{glutes,abs}','{barbell,squat_rack}',false,true,false),
  ('456f0fdd-1aad-512f-809c-ab891715a2b9','goblet_squat','Goblet Squat','strength','total_weight','quadriceps','{glutes,abs}','{dumbbell}',true,true,false),
  ('e2af460d-c886-59f8-b610-8285d4395aa7','smith_machine_squat','Kniebeuge an der Multipresse','strength','total_weight','quadriceps','{glutes,hamstrings}','{smith_machine}',false,true,false),
  ('8a265041-9f19-5d07-ada4-0e593295d5ae','hack_squat_machine','Hackenschmidt-Kniebeuge','strength','total_weight','quadriceps','{glutes}','{machine}',false,true,false),
  ('ceb0ef8b-7a92-53ec-a90c-23d9bd41ac34','leg_press','Beinpresse','strength','total_weight','quadriceps','{glutes,hamstrings}','{machine}',false,true,false),
  ('07b4a807-daad-5f4f-b7c1-e8c6723be9c8','dumbbell_bulgarian_split_squat','Bulgarian Split Squat mit Kurzhanteln','strength','per_hand','quadriceps','{glutes,hamstrings}','{dumbbell,bench}',true,true,false),
  ('e0b6100c-e38f-5033-ad07-0fbdcbc2455c','dumbbell_walking_lunge','Ausfallschritte gehend mit Kurzhanteln','strength','per_hand','quadriceps','{glutes,hamstrings}','{dumbbell}',true,true,false),
  ('022f3e35-307d-5975-8216-eaa7d7186dda','dumbbell_step_up','Step-ups mit Kurzhanteln','strength','per_hand','glutes','{quadriceps,hamstrings}','{dumbbell,plyo_box}',true,true,false),
  ('666969a3-77c3-58b6-a4ab-8eefef42e431','leg_extension','Beinstrecker','strength','total_weight','quadriceps','{}','{machine}',false,true,false),
  ('1de37812-86fe-5791-9151-378d91873198','conventional_deadlift','Kreuzheben konventionell','strength','total_weight','hamstrings','{glutes,lower_back,traps,forearms}','{barbell}',false,true,false),
  ('be7d1159-8121-5d4c-94fa-41eaf7aed317','sumo_deadlift','Sumo-Kreuzheben','strength','total_weight','glutes','{adductors,hamstrings,quadriceps}','{barbell}',false,true,false),
  ('7dc5f693-5bd0-54a0-b871-038a60c0fa7a','trap_bar_deadlift','Kreuzheben mit Trap Bar','strength','total_weight','quadriceps','{glutes,hamstrings,traps,forearms}','{trap_bar}',false,true,false),
  ('238984b5-3620-5d6d-a269-c0e615c81f18','barbell_romanian_deadlift','Rumänisches Kreuzheben mit Langhantel','strength','total_weight','hamstrings','{glutes,lower_back}','{barbell}',false,true,false),
  ('106e3c35-e46c-598e-a0c2-8a2cfdec3d5c','dumbbell_romanian_deadlift','Rumänisches Kreuzheben mit Kurzhanteln','strength','per_hand','hamstrings','{glutes,lower_back}','{dumbbell}',true,true,false),
  ('a21f4280-61d9-56bb-a261-028abb482782','barbell_good_morning','Good Mornings mit Langhantel','strength','total_weight','hamstrings','{glutes,lower_back}','{barbell,squat_rack}',false,true,false),
  ('70583c4d-6d48-5c48-9f6e-7fd26eb365ad','barbell_hip_thrust','Hip Thrust mit Langhantel','strength','total_weight','glutes','{hamstrings}','{barbell,bench}',false,true,false),
  ('e0b0e561-d5b0-5af4-8d46-083ea3b3fb7d','smith_machine_hip_thrust','Hip Thrust an der Multipresse','strength','total_weight','glutes','{hamstrings}','{smith_machine,bench}',false,true,false),
  ('28f936d6-f7bb-5972-8633-098027b74915','bodyweight_glute_bridge','Glute Bridge','strength','bodyweight_only','glutes','{hamstrings}','{mat}',true,true,true),
  ('889f45b4-09b1-5c0d-b6dd-bd35587340d8','lying_leg_curl','Beinbeuger liegend','strength','total_weight','hamstrings','{}','{machine}',false,true,false),
  ('aabd760f-36e4-5e04-a54a-fd99c23bbc8f','seated_leg_curl','Beinbeuger sitzend','strength','total_weight','hamstrings','{}','{machine}',false,true,false),
  ('412e37dc-2eed-5e39-942a-612476dd1e3b','back_extension','Rückenstrecken','strength','added_weight_only','lower_back','{glutes,hamstrings}','{machine}',false,true,true),
  ('c09c9eef-dab8-51b5-a1bf-de5ef733bb8f','standing_calf_raise_machine','Wadenheben stehend an der Maschine','strength','total_weight','calves','{}','{machine}',false,true,false),
  ('7edc552b-20e3-520b-9ae7-f1884e6a058a','seated_calf_raise_machine','Wadenheben sitzend an der Maschine','strength','total_weight','calves','{}','{machine}',false,true,false),
  ('dd373e07-856e-56d0-981d-5eb27fbe3415','hip_abduction_machine','Hüftabduktion an der Maschine','strength','total_weight','abductors','{glutes}','{machine}',false,true,false),
  ('fcbdbca4-8ad6-5b1c-bd99-ae98f68a0e6e','hip_adduction_machine','Hüftadduktion an der Maschine','strength','total_weight','adductors','{}','{machine}',false,true,false),
  ('b64a9117-d288-531c-851d-f0b8e90c8788','barbell_bench_press','Bankdrücken mit Langhantel','strength','total_weight','chest','{triceps,front_delts}','{barbell,bench,squat_rack}',false,true,false),
  ('1d74102d-01bb-58ec-8fab-3c9348314429','incline_barbell_bench_press','Schrägbankdrücken mit Langhantel','strength','total_weight','chest','{front_delts,triceps}','{barbell,bench,squat_rack}',false,true,false),
  ('0ec136c0-a641-5290-9f9f-5065c529cd7c','close_grip_bench_press','Enges Bankdrücken mit Langhantel','strength','total_weight','triceps','{chest,front_delts}','{barbell,bench,squat_rack}',false,true,false),
  ('be1dfbb7-a7da-5c03-b166-781033a508c7','dumbbell_bench_press','Bankdrücken mit Kurzhanteln','strength','per_hand','chest','{triceps,front_delts}','{dumbbell,bench}',true,true,false),
  ('63a23dbd-86af-5398-b8eb-685142bfb6c3','incline_dumbbell_bench_press','Schrägbankdrücken mit Kurzhanteln','strength','per_hand','chest','{front_delts,triceps}','{dumbbell,bench}',true,true,false),
  ('39af5e48-6f7d-5eaf-996e-79be955e20c0','dumbbell_fly','Fliegende mit Kurzhanteln','strength','per_hand','chest','{front_delts}','{dumbbell,bench}',true,true,false),
  ('a20a0502-43b7-5c5c-8b5f-25b2c388365f','chest_press_machine','Brustpresse','strength','total_weight','chest','{triceps,front_delts}','{machine}',false,true,false),
  ('70b0f9a3-2d2c-572a-a24c-a3c72b58ea0a','pec_deck','Butterfly an der Maschine','strength','total_weight','chest','{}','{machine}',false,true,false),
  ('887aba11-c978-5625-afa2-7acc9ade881d','push_up','Liegestütz','strength','bodyweight_only','chest','{triceps,front_delts}','{}',true,true,true),
  ('ada4ba09-0fb6-55c7-9bbc-eca3a2a7084f','parallel_bar_dip','Dips am Barren','strength','added_weight_only','triceps','{chest,front_delts}','{dip_bars}',false,true,true),
  ('9ddb6e3c-1b59-5059-8eec-3ce3ba668412','barbell_overhead_press','Schulterdrücken mit Langhantel','strength','total_weight','front_delts','{triceps,side_delts}','{barbell,squat_rack}',false,true,false),
  ('dd8cc2bc-5b68-58ab-8083-5083392d63fc','dumbbell_shoulder_press','Schulterdrücken mit Kurzhanteln','strength','per_hand','front_delts','{triceps,side_delts}','{dumbbell,bench}',true,true,false),
  ('a3360afd-c12d-5f2b-ba40-e5fc0971701d','shoulder_press_machine','Schulterpresse','strength','total_weight','front_delts','{triceps,side_delts}','{machine}',false,true,false),
  ('b3185a88-5510-5c0a-9c17-26631d0ffb13','dumbbell_lateral_raise','Seitheben mit Kurzhanteln','strength','per_hand','side_delts','{}','{dumbbell}',true,true,false),
  ('b167ae22-2f87-5c85-aa08-408ee84c9efb','cable_lateral_raise','Einarmiges Seitheben am Kabelzug','strength','per_side','side_delts','{}','{cable}',false,true,false),
  ('2514a37a-c71f-5c2b-b983-184a3f599ebc','reverse_pec_deck','Reverse Butterfly','strength','total_weight','rear_delts','{upper_back}','{machine}',false,true,false),
  ('8aabeb43-21f4-503f-925e-cfbbfbedbdd7','dumbbell_rear_delt_fly','Vorgebeugtes Seitheben mit Kurzhanteln','strength','per_hand','rear_delts','{upper_back}','{dumbbell}',true,true,false),
  ('7a4d1307-c2f8-5659-aa15-e6ae254e0359','cable_face_pull','Face Pull am Kabelzug','strength','total_weight','rear_delts','{upper_back,traps}','{cable}',false,true,false),
  ('4fc1a98e-1b0a-5c55-9c41-2854411f2cbf','pull_up','Klimmzug im Obergriff','strength','added_weight_only','lats','{biceps,upper_back}','{pull_up_bar}',true,true,true),
  ('f861e622-dca1-57c3-b55f-041ac046ec02','chin_up','Klimmzug im Untergriff','strength','added_weight_only','lats','{biceps,upper_back}','{pull_up_bar}',true,true,true),
  ('4f49ba81-f024-5a34-8cb5-1d76311f8528','lat_pulldown','Latzug','strength','total_weight','lats','{biceps,upper_back}','{cable}',false,true,false),
  ('b51a9400-7325-5b7f-88d0-5f0f15f98639','bent_over_barbell_row','Vorgebeugtes Rudern mit Langhantel','strength','total_weight','upper_back','{lats,rear_delts,biceps,lower_back}','{barbell}',false,true,false),
  ('63f6d8e1-7517-5397-8766-4d2e660d344c','one_arm_dumbbell_row','Einarmiges Rudern mit Kurzhantel','strength','per_side','lats','{upper_back,biceps,rear_delts}','{dumbbell,bench}',true,true,false),
  ('9af1ba4d-c1a0-59a4-a4c1-62ab586c795b','seated_cable_row','Rudern am Kabelzug sitzend','strength','total_weight','upper_back','{lats,biceps,rear_delts}','{cable}',false,true,false),
  ('d69fa5b0-a965-5877-b6bb-519005878207','chest_supported_row_machine','Brustgestütztes Rudern an der Maschine','strength','total_weight','upper_back','{lats,rear_delts,biceps}','{machine}',false,true,false),
  ('079c4a1f-828d-5109-b511-63c0662f47e5','straight_arm_cable_pulldown','Überzüge mit gestreckten Armen am Kabelzug','strength','total_weight','lats','{}','{cable}',false,true,false),
  ('7ce3bc47-bba3-5481-a0bb-a86540ce707a','inverted_row','Inverted Row','strength','bodyweight_only','upper_back','{lats,biceps,rear_delts}','{barbell,squat_rack}',false,true,true),
  ('565696b8-d8bf-5a91-b33b-73992f7065e2','barbell_biceps_curl','Bizepscurls mit Langhantel','strength','total_weight','biceps','{forearms}','{barbell}',false,true,false),
  ('a297ff50-4687-56bc-89c1-ed99f6376814','dumbbell_biceps_curl','Bizepscurls mit Kurzhanteln','strength','per_hand','biceps','{forearms}','{dumbbell}',true,true,false),
  ('18fa7d9b-98c2-5303-9dd2-4a691ffe5b88','dumbbell_hammer_curl','Hammercurls mit Kurzhanteln','strength','per_hand','biceps','{forearms}','{dumbbell}',true,true,false),
  ('f4a2581e-8fda-585c-8aef-a78e3f30fcd9','cable_biceps_curl','Bizepscurls am Kabelzug','strength','total_weight','biceps','{forearms}','{cable}',false,true,false),
  ('2a0a1fa8-aff9-5cfe-980e-206b21f2060f','cable_triceps_pushdown','Trizepsdrücken am Kabelzug','strength','total_weight','triceps','{}','{cable}',false,true,false),
  ('5048fe35-cc95-5e5a-bfa7-1168ecf603fb','overhead_cable_triceps_extension','Trizepsstrecken über Kopf am Kabelzug','strength','total_weight','triceps','{}','{cable}',false,true,false),
  ('ca3ef7b9-0d71-5986-a47c-d391fdfe293c','ez_bar_skull_crusher','Skull Crusher mit SZ-Stange','strength','total_weight','triceps','{}','{ez_bar,bench}',false,true,false),
  ('9f388264-ff1e-53fe-8ed4-068beda28ba2','dumbbell_overhead_triceps_extension','Trizepsstrecken über Kopf mit Kurzhantel','strength','total_weight','triceps','{}','{dumbbell}',true,true,false),
  ('fd601342-bdc9-5088-807b-af6e66a0072d','hanging_leg_raise','Beinheben hängend','strength','bodyweight_only','abs','{hip_flexors}','{pull_up_bar}',true,true,true),
  ('e2ea8eb7-c1c4-55ee-a848-c2ce05f40f5e','cable_crunch','Cable Crunch','strength','total_weight','abs','{}','{cable}',false,true,false),
  ('d234a932-91e1-54e6-b123-0b2783d492c4','front_plank','Unterarmstütz','strength','no_weight_tracking','abs','{obliques,lower_back}','{mat}',true,true,true),
  ('8233a580-f708-5529-9c37-d14cac202272','side_plank','Seitstütz','strength','no_weight_tracking','obliques','{abs}','{mat}',true,true,true),
  ('4d4726b3-8979-5fd6-b656-cf5eded917e3','cable_woodchop','Woodchopper am Kabelzug','strength','per_side','obliques','{abs}','{cable}',false,true,false),
  ('b5ea4487-4514-5ab9-9faf-9e95102f40b6','kettlebell_swing','Kettlebell Swing','strength','total_weight','glutes','{hamstrings,lower_back}','{kettlebell}',true,true,false),
  ('67b5216d-8d2b-5c77-b835-1a73aa3f1be0','dumbbell_farmer_carry','Farmer Walk mit Kurzhanteln','strength','per_hand','forearms','{traps,abs}','{dumbbell}',true,true,false),
  ('5bcc5f8e-97a9-531a-b45f-bda04c6c5195','landmine_press','Einarmiges Landmine Press','strength','per_side','front_delts','{chest,triceps}','{landmine,barbell}',false,true,false),
  ('15984cb0-523a-50d7-b30e-13fb82bfbca6','landmine_row','Landmine Row','strength','total_weight','upper_back','{lats,biceps}','{landmine,barbell}',false,true,false),
  ('e73fdb9a-2c1f-576f-9c3a-fff1e1b89465','treadmill_run','Laufen auf dem Laufband','cardio','no_weight_tracking',null,'{}','{treadmill}',false,true,false),
  ('b7251ea0-e82f-536c-bc24-4a8e52626aeb','incline_treadmill_walk','Steiles Gehen auf dem Laufband','cardio','no_weight_tracking',null,'{}','{treadmill}',false,true,false),
  ('bbc2637b-bca8-50eb-8a6f-cc8b6b3323e5','stationary_bike','Fahrradergometer','cardio','no_weight_tracking',null,'{}','{stationary_bike}',false,true,false),
  ('ca5d65fc-1d06-5408-af9e-fbc1fe8d8d85','rowing_ergometer','Ruderergometer','cardio','no_weight_tracking',null,'{}','{rowing_machine}',false,true,false),
  ('f0275411-b53a-5f30-ba9c-5a78973e42e0','elliptical_trainer','Crosstrainer','cardio','no_weight_tracking',null,'{}','{elliptical}',false,true,false),
  ('0cbc6da1-77f7-571d-8c82-5229c747281c','stair_climber','Treppensteiger','cardio','no_weight_tracking',null,'{}','{stair_climber}',false,true,false),
  ('9b483853-5bbb-5e8e-b742-85b67fd61111','cat_cow','Katze-Kuh-Mobilisation','mobility','no_weight_tracking',null,'{}','{mat}',true,true,false),
  ('47c8da51-40b0-5b4f-b8d2-b2b47729c44e','thoracic_rotation','Rotation der Brustwirbelsäule','mobility','no_weight_tracking',null,'{}','{mat}',true,true,false),
  ('42c0dd75-ed61-53d3-8ed4-7a5527ab3d82','shoulder_wall_slide','Wall Slides für die Schulter','mobility','no_weight_tracking',null,'{}','{}',true,true,false),
  ('f6a22572-edb0-51ed-9348-3308b6e6da83','hip_90_90_switch','90/90-Hüftwechsel','mobility','no_weight_tracking',null,'{}','{mat}',true,true,false),
  ('459cfd94-fd88-575a-a194-aef9c1f144c7','ankle_dorsiflexion_mobilization','Sprunggelenk-Mobilisation','mobility','no_weight_tracking',null,'{}','{}',true,true,false),
  ('98625ab8-5305-517d-8281-08bba0747d5d','deep_squat_mobility_hold','Tiefe Kniebeugen-Mobilisation','mobility','no_weight_tracking',null,'{}','{}',true,true,false),
  ('6b393bb5-7842-5543-8db1-2e0498cb6179','hamstring_stretch','Dehnung der hinteren Oberschenkel','stretching','no_weight_tracking','hamstrings','{}','{mat}',true,true,false),
  ('4796df41-5c60-5b7b-b166-b0e818e361d3','quadriceps_stretch','Dehnung der vorderen Oberschenkel','stretching','no_weight_tracking','quadriceps','{}','{}',true,true,false),
  ('72c9b0ab-fee3-5429-b537-43aee44f578d','hip_flexor_stretch','Hüftbeuger-Dehnung','stretching','no_weight_tracking','hip_flexors','{}','{mat}',true,true,false),
  ('e6a60ece-c4ee-5d96-9f3a-29569c07d049','calf_stretch','Wadendehnung','stretching','no_weight_tracking','calves','{}','{}',true,true,false),
  ('278048aa-9cd0-5e5a-8a82-b703ccf797e5','chest_doorway_stretch','Brustdehnung im Türrahmen','stretching','no_weight_tracking','chest','{}','{}',true,true,false),
  ('2b9c63d6-b071-52ac-91f4-35b17374f795','lat_stretch','Latissimus-Dehnung','stretching','no_weight_tracking','lats','{}','{}',true,true,false),
  ('a1dbc975-ef02-5418-834e-b6179beabeb3','glute_stretch','Gesäßdehnung','stretching','no_weight_tracking','glutes','{}','{mat}',true,true,false),
  ('317b17be-7fa3-5ab5-b528-45d9d1157952','adductor_stretch','Adduktorendehnung','stretching','no_weight_tracking','adductors','{}','{mat}',true,true,false);

do $$
begin
  if exists (
    select 1
    from training_v2_system_catalog_expected expected
    join public.training_exercises_v2 exercise
      on exercise.system_key = expected.system_key
    where exercise.id <> expected.id
  ) then
    raise exception 'training V2 A2 system_key is already assigned to a different id'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from training_v2_system_catalog_expected expected
    join public.training_exercises_v2 exercise
      on exercise.id = expected.id
    where exercise.system_key is distinct from expected.system_key
  ) then
    raise exception 'training V2 A2 id is already assigned to a different system_key'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from training_v2_system_catalog_expected expected
    join public.training_exercises_v2 exercise
      on exercise.id = expected.id
      and exercise.system_key = expected.system_key
    where exercise.scope <> 'system'
      or exercise.owner_user_id is not null
  ) then
    raise exception 'training V2 A2 expected identity is not an ownerless system exercise'
      using errcode = '55000';
  end if;
end;
$$;

insert into public.training_exercises_v2 (
  id, scope, owner_user_id, system_key, status, category, load_type, name,
  main_muscle, supporting_muscles, difficulty, is_home, is_gym, is_bodyweight,
  equipment, image_reference, execution_instructions, common_mistakes, safety_notes
)
select
  id, 'system', null, system_key, 'active', category, load_type, name,
  main_muscle, supporting_muscles, null, is_home, is_gym, is_bodyweight,
  equipment, null, null, null, null
from training_v2_system_catalog_expected
on conflict (id) do update set
  status = excluded.status,
  category = excluded.category,
  load_type = excluded.load_type,
  name = excluded.name,
  main_muscle = excluded.main_muscle,
  supporting_muscles = excluded.supporting_muscles,
  difficulty = excluded.difficulty,
  is_home = excluded.is_home,
  is_gym = excluded.is_gym,
  is_bodyweight = excluded.is_bodyweight,
  equipment = excluded.equipment,
  image_reference = excluded.image_reference,
  execution_instructions = excluded.execution_instructions,
  common_mistakes = excluded.common_mistakes,
  safety_notes = excluded.safety_notes,
  version = training_exercises_v2.version + 1
where (
  training_exercises_v2.status,
  training_exercises_v2.category,
  training_exercises_v2.load_type,
  training_exercises_v2.name,
  training_exercises_v2.main_muscle,
  training_exercises_v2.supporting_muscles,
  training_exercises_v2.difficulty,
  training_exercises_v2.is_home,
  training_exercises_v2.is_gym,
  training_exercises_v2.is_bodyweight,
  training_exercises_v2.equipment,
  training_exercises_v2.image_reference,
  training_exercises_v2.execution_instructions,
  training_exercises_v2.common_mistakes,
  training_exercises_v2.safety_notes
) is distinct from (
  excluded.status,
  excluded.category,
  excluded.load_type,
  excluded.name,
  excluded.main_muscle,
  excluded.supporting_muscles,
  excluded.difficulty,
  excluded.is_home,
  excluded.is_gym,
  excluded.is_bodyweight,
  excluded.equipment,
  excluded.image_reference,
  excluded.execution_instructions,
  excluded.common_mistakes,
  excluded.safety_notes
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.training_exercises_v2'::regclass
      and conname = 'training_exercises_v2_system_main_muscle_check'
  ) then
    alter table public.training_exercises_v2
      add constraint training_exercises_v2_system_main_muscle_check check (
        scope <> 'system'
        or main_muscle is null
        or public.is_training_v2_system_muscle(main_muscle)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.training_exercises_v2'::regclass
      and conname = 'training_exercises_v2_system_supporting_muscles_check'
  ) then
    alter table public.training_exercises_v2
      add constraint training_exercises_v2_system_supporting_muscles_check check (
        scope <> 'system'
        or public.is_training_v2_system_muscle_array(supporting_muscles)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.training_exercises_v2'::regclass
      and conname = 'training_exercises_v2_system_equipment_taxonomy_check'
  ) then
    alter table public.training_exercises_v2
      add constraint training_exercises_v2_system_equipment_taxonomy_check check (
        scope <> 'system'
        or public.is_training_v2_system_equipment_array(equipment)
      );
  end if;
end;
$$;

revoke all on function public.is_training_v2_system_muscle(text)
  from public, anon, authenticated;
revoke all on function public.is_training_v2_system_equipment(text)
  from public, anon, authenticated;
revoke all on function public.is_training_v2_system_muscle_array(text[])
  from public, anon, authenticated;
revoke all on function public.is_training_v2_system_equipment_array(text[])
  from public, anon, authenticated;
grant execute on function public.is_training_v2_system_muscle(text)
  to service_role;
grant execute on function public.is_training_v2_system_equipment(text)
  to service_role;
grant execute on function public.is_training_v2_system_muscle_array(text[])
  to service_role;
grant execute on function public.is_training_v2_system_equipment_array(text[])
  to service_role;

drop table training_v2_system_catalog_expected;
