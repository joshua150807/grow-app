const assert=require('node:assert/strict');const test=require('node:test');
const {loadJsxModule}=require('../testing/loadJsxModule.cjs');const {createHookHarness}=require('../testing/createHookHarness.cjs');
function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);return node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];}
function textOf(node){if(Array.isArray(node))return node.map(textOf).join('');if(typeof node==='string')return node;return node?.props?textOf(node.props.children):'';}
const unit=(id,type='strength')=>({id,name:id,unitType:type,unitTypeLabel:type,exercises:[]});
function screen({draft=null,readDraft,plan={id:'plan',revision:{id:'r1'},weeklyGoal:3,nextUnit:{id:'B'},units:[unit('A'),unit('B'),unit('Pause','rest')]}}={}){
  let data=plan,reads=0,focused=true;const pushes=[],alerts=[];
  const harness=createHookHarness(react=>{
    const component=loadJsxModule(__dirname,'./TrainingV2MyTrainingScreen.jsx',{
      react,'react-native':{Alert:{alert:(...args)=>alerts.push(args)}},'expo-router':{router:{push:route=>pushes.push(route),back(){}},useFocusEffect:callback=>react.useEffect(()=>focused?callback():undefined,[callback,focused])},
      '@expo/vector-icons':{},'../../../../constants/colors':{COLORS:{}},'../../../../constants/layout':{s:v=>v},'../../../../constants/toolAssets':{TRAINING_V2_MY_TRAINING_ASSETS:{}},
      '../components/TrainingV2HistoryViews':{},'../components/TrainingV2StateView':{},'../styles/trainingV2Styles':{styles:{}},
      '../hooks/useTrainingV2ContentStyle':{useTrainingV2ContentStyle:()=>[]},
      '../hooks/useTrainingV2History':{useTrainingV2RecentSessions:()=>({data:[]})},
      '../hooks/useTrainingV2Plans':{useTrainingV2Plans:()=>({plans:data?[data]:[],refresh(){},retry(){}})},
      '../hooks/useTrainingV2PlanDetail':{useTrainingV2PlanDetail:()=>({plan:data,refresh(){}})},
      '../models/trainingV2ViewModel':{findActiveTrainingV2Plan:plans=>plans[0],estimateTrainingV2UnitDurationMinutes:()=>1},
      '../services/trainingV2SessionDraftStorage':{requireTrainingV2SessionOwner:async()=>'owner',findTrainingV2SessionDraftForPlan:async()=>{reads++;return readDraft?readDraft(reads):draft;}},
    }).default;return ()=>component();
  });harness.render();
  const findUnit=id=>nodes(harness.result).find(n=>n.props?.accessibilityLabel===`Einheit ${id} auswählen`)
    ||nodes(harness.result).find(n=>n.props?.onPress&&textOf(n)===id);
  const start=()=>nodes(harness.result).find(n=>n.props?.accessibilityLabel?.startsWith('Ausgewählte Einheit '))
    ||nodes(harness.result).find(n=>n.props?.onPress&&['Training starten','Training fortsetzen'].includes(textOf(n)));
  return {harness,pushes,alerts,findUnit,start,get reads(){return reads;},setPlan(next){data=next;harness.render();},setFocused(value){focused=value;harness.render();}};
}
test('UX5: selecting another unit changes the highlight/hero without navigation or another draft read',async()=>{
  const s=screen();await s.harness.settle();const reads=s.reads;
  s.findUnit('A').props.onPress();s.harness.render();
  assert.equal(s.pushes.length,0);assert.equal(s.reads,reads);
  assert.equal(s.findUnit('A').props.accessibilityState.selected,true);
  assert.equal(s.findUnit('B').props.accessibilityState.selected,false);
  assert.ok(textOf(s.harness.result).includes('AUSGEWÄHLTE EINHEIT'));
  await s.start().props.onPress();assert.equal(s.pushes[0].params.unitId,'A');
});
test('UX5: server next unit is selected instead of blindly picking the first; double start is locked',async()=>{
  const s=screen();await s.harness.settle();
  assert.equal(s.findUnit('B').props.accessibilityState?.selected,true);
  const start=s.start().props.onPress;await Promise.all([start(),start()]);
  assert.equal(s.pushes.length,1);assert.equal(s.pushes[0].params.unitId,'B');
});
test('UX5: non-startable plan units remain visible/selectable but cannot start an unsupported session',async()=>{
  const s=screen();await s.harness.settle();assert.ok(s.findUnit('Pause'));
  s.findUnit('Pause').props.onPress();s.harness.render();
  const start=s.start();assert.ok(start);assert.equal(start.props.disabled,true);assert.equal(s.pushes.length,0);
});
test('UX5: refreshing away the selected ID falls back to the current server suggestion',async()=>{
  const s=screen();await s.harness.settle();s.findUnit('A').props.onPress();s.harness.render();s.pushes.length=0;
  s.setPlan({id:'new-plan',revision:{id:'r2'},nextUnit:{id:'C'},units:[unit('C')]});await s.harness.settle();
  await s.start().props.onPress();assert.equal(s.pushes[0].params.planId,'new-plan');assert.equal(s.pushes[0].params.unitId,'C');
});
test('UX5: another saved draft requires an explicit decision before starting the selected unit',async()=>{
  const s=screen({draft:{planId:'old-plan',unitId:'old-unit',session:{unitName:'Old'}}});await s.harness.settle();
  await s.start().props.onPress();assert.equal(s.pushes.length,0);assert.equal(s.alerts.length,1);
  const button=s.alerts[0][2].find(b=>b.text==='Ausgewählte Einheit starten');assert.ok(button);button.onPress();
  assert.equal(s.pushes.length,1);assert.equal(s.pushes[0].params.unitId,'B');
});
test('UX5: no server suggestion means no implicit first selection',async()=>{
  const s=screen({plan:{id:'plan',revision:{id:'r1'},nextUnit:null,units:[unit('A')]}});await s.harness.settle();
  assert.equal(s.start(),undefined);assert.equal(s.findUnit('A').props.accessibilityState.selected,false);
  s.findUnit('A').props.onPress();s.harness.render();await s.start().props.onPress();assert.equal(s.pushes[0].params.unitId,'A');
});
test('UX5: a refreshed revision/removal invalidates the previous manual selection',async()=>{
  const s=screen();await s.harness.settle();s.findUnit('A').props.onPress();s.harness.render();
  s.setPlan({id:'plan',revision:{id:'r2'},nextUnit:{id:'C'},units:[unit('C')]});await s.harness.settle();
  await s.start().props.onPress();assert.equal(s.pushes[0].params.unitId,'C');
});
test('UX5: a draft for the selected unit resumes without a false conflict',async()=>{
  const s=screen({draft:{planId:'plan',unitId:'B',session:{unitName:'B'}}});await s.harness.settle();
  await s.start().props.onPress();assert.equal(s.alerts.length,0);assert.equal(s.pushes[0].params.unitId,'B');
});
test('UX5: delayed draft check cannot navigate after blur or after the plan changes',async()=>{
  for(const changePlan of [true,false]) {
    let finish;
    const s=screen({readDraft:n=>n===1?null:new Promise(resolve=>{finish=resolve;})});await s.harness.settle();
    const pending=s.start().props.onPress();await new Promise(setImmediate);
    if(changePlan)s.setPlan({id:'other',nextUnit:{id:'C'},units:[unit('C')]});else s.setFocused(false);
    finish(null);await pending;assert.equal(s.pushes.length,0);
  }
});
test('UX5: a failed local draft check never blindly opens a new session',async()=>{
  const s=screen({readDraft:n=>{if(n>1)throw Error('storage unavailable');return null;}});await s.harness.settle();
  await s.start().props.onPress();s.harness.render();assert.equal(s.pushes.length,0);assert.equal(s.start().props.disabled,false);
  assert.ok(textOf(s.harness.result).includes('storage unavailable'));
});
