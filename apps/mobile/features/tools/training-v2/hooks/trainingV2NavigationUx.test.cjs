const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('../testing/loadModule.cjs');
const { createHookHarness } = require('../testing/createHookHarness.cjs');
const turn = () => new Promise(setImmediate);
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return {promise,resolve,reject}; };
function history(api={}) { return loadModule(__dirname,'./useTrainingV2History.js',{react:{},'expo-router':{},'../services/trainingV2Api':api}); }

test('UX1: recent data remains visible during refocus and a failed background read', async () => {
  const pending=deferred();let state,calls=0;
  const {createHistoryRequest}=history();
  const request=createHistoryRequest(async()=>++calls===1?[{id:'saved'}]:pending.promise,next=>{state=next;});
  const blur=request.focus();await turn();blur();request.focus();
  assert.deepEqual(state.data,[{id:'saved'}]);assert.equal(state.loading,false);
  pending.reject(Error('offline'));await turn();
  assert.deepEqual(state.data,[{id:'saved'}]);assert.equal(state.error.message,'offline');
});
test('UX1: refocus refreshes all previously loaded history pages without collapsing the list', async () => {
  let state;const requested=[];const page=n=>({sessions:[{id:String(n)}],pagination:{page:n,hasMore:n===0}});
  const {createHistoryRequest,appendHistoryPage}=history({listTrainingV2Sessions:async({page:index})=>{requested.push(index);return page(index);}});
  const request=createHistoryRequest(async()=>page(0),next=>{state=next;},appendHistoryPage);
  const blur=request.focus();await turn();await request.loadMore();blur();request.focus();await turn();
  assert.deepEqual(state.data.sessions.map(s=>s.id),['0','1']);assert.deepEqual(requested,[1,1]);
});
test('UX1: native retry press events are not interpreted as a pull-to-refresh flag',async()=>{
  const pending=deferred();let calls=0,state;
  const {createHistoryRequest}=history();
  const request=createHistoryRequest(async()=>++calls===1?['existing']:pending.promise,next=>{state=next;});
  request.focus();await turn();const retry=request.refresh({nativeEvent:{}});
  assert.equal(state.refreshing,false);assert.deepEqual(state.data,['existing']);pending.resolve(['fresh']);await retry;
});
for(const template of [false,true]) {
  test(`UX1: ${template?'template':'plan'} refocus keeps its loaded tree visible and rejects stale identity`,async()=>{
    const pending=deferred();let calls=0;let current;
    const first={id:'one',revision:{units:[]}};
    const harness=createHookHarness(react=>{
      const module=loadModule(__dirname,template?'./useTrainingV2TemplateDetail.js':'./useTrainingV2PlanDetail.js',{
        react,'expo-router':{useFocusEffect:callback=>react.useEffect(()=>current.focused?callback():undefined,[callback,current.focused])},
        '../services/trainingV2Api':{getTrainingV2Plan:async()=>++calls===1?first:pending.promise,
          getTrainingV2Template:async()=>++calls===1?{template:first,userPlan:{}}:pending.promise,
          resolveTrainingV2ExerciseNames:async()=>({})},
        '../models/trainingV2ViewModel':{mapTrainingV2PlanDetail:p=>p,mapTrainingV2TemplateDetail:p=>p},
      });
      return props=>{current=props;return template?module.useTrainingV2TemplateDetail(props.id):module.useTrainingV2PlanDetail(props.id);};
    });
    harness.render({id:'one',focused:true});await harness.settle();harness.render({id:'one',focused:false});harness.render({id:'one',focused:true});
    assert.equal(harness.result.loading,false);
    assert.equal((template?harness.result.template:harness.result.plan).id,'one');
    harness.render({id:'two',focused:true});
    assert.equal(template?harness.result.template:harness.result.plan,null,'a previous identity must never be actionable');
    pending.resolve(template?{template:{id:'two'},userPlan:{}}:{id:'two'});await harness.settle();harness.unmount();
  });
  test(`UX1: a definitive ${template?'template':'plan'} 404 removes stale content instead of leaving actions on a deleted resource`,async()=>{
    let focused=true,calls=0;
    const harness=createHookHarness(react=>{
      const module=loadModule(__dirname,template?'./useTrainingV2TemplateDetail.js':'./useTrainingV2PlanDetail.js',{
        react,'expo-router':{useFocusEffect:callback=>react.useEffect(()=>focused?callback():undefined,[callback,focused])},
        '../services/trainingV2Api':{getTrainingV2Plan:async()=>{if(calls++)throw Object.assign(Error('gone'),{status:404});return{id:'one'};},
          getTrainingV2Template:async()=>{if(calls++)throw Object.assign(Error('gone'),{status:404});return{template:{id:'one'},userPlan:{}};},
          resolveTrainingV2ExerciseNames:async()=>({})},
        '../models/trainingV2ViewModel':{mapTrainingV2PlanDetail:p=>p,mapTrainingV2TemplateDetail:p=>p},
      });return ()=>template?module.useTrainingV2TemplateDetail('one'):module.useTrainingV2PlanDetail('one');
    });harness.render();await harness.settle();focused=false;harness.render();focused=true;harness.render();await harness.settle();
    assert.equal(template?harness.result.template:harness.result.plan,null);assert.equal(harness.result.error.status,404);assert.equal(harness.result.loading,false);harness.unmount();
  });
}
