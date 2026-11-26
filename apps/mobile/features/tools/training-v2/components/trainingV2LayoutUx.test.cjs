const assert=require('node:assert/strict');const test=require('node:test');
const {loadModule}=require('../testing/loadModule.cjs');const {loadJsxModule}=require('../testing/loadJsxModule.cjs');
const {createHookHarness}=require('../testing/createHookHarness.cjs');
const styles=loadModule(__dirname,'../styles/trainingV2Styles.js',{'react-native':{StyleSheet:{create:v=>v}},'../../../../constants/colors':{COLORS:{}},'../../../../constants/layout':{s:v=>v,sf:v=>v,sv:v=>v}}).styles;
function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);return node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];}
test('Screenshot header: back touch target and title have separate wrapping rows',()=>{
  assert.equal(styles.plansHeaderRow.flexDirection,'column');assert.ok(styles.plansBackRow.minHeight>=44);assert.equal(styles.plansHeaderTitle.flex,undefined);
});
test('Screenshot create card: caption grows naturally and the full existing artwork remains visible',()=>{
  const pushes=[];
  const screen=loadJsxModule(__dirname,'../screens/TrainingV2PlansScreen.jsx',{
    'react-native':{useWindowDimensions:()=>({width:390})},'expo-router':{router:{push:v=>pushes.push(v)}},'@expo/vector-icons':{},
    '../../../../constants/colors':{COLORS:{}},'../../../../constants/layout':{s:v=>v},'../../../../constants/toolAssets':{TRAINING_V2_CREATE_PLAN_HERO:'existing-art'},
    '../components/TrainingV2PlanSections':{},'../components/TrainingV2StateView':{},'../styles/trainingV2Styles':{styles},
    '../hooks/useTrainingV2ContentStyle':{useTrainingV2ContentStyle:()=>[{},{paddingLeft:20,paddingRight:20}]},
    '../hooks/useTrainingV2Plans':{useTrainingV2Plans:()=>({plans:[]})},'../hooks/useTrainingV2Templates':{useTrainingV2Templates:()=>({templates:[]})},
    '../models/trainingV2ViewModel':{selectTrainingV2SavedPlans:v=>v},
  }).default();
  const artwork=nodes(screen).find(n=>n.props?.source==='existing-art');assert.equal(artwork.props.resizeMode,'contain');
  assert.equal(artwork.props.children,undefined,'caption must not overflow a fixed-ratio background');
  // Explicit point size from the content width (390 − 2×20), never the 1200 px source size.
  assert.deepEqual(artwork.props.style,{width:350,height:159});
  // Caption overlays the artwork's empty middle: right of the pencil circle (~21 %), left of the athlete (~66 %), inside the frame.
  assert.equal(styles.heroTextWrap.position,'absolute');assert.equal(styles.heroTextWrap.left,'23%');assert.equal(styles.heroTextWrap.right,'35%');
  const title=nodes(screen).find(n=>n.props?.children==='Eigenen Plan erstellen');assert.equal(title.props.style.at(-1).fontSize,14.7);assert.equal(title.props.maxFontSizeMultiplier,1.1);
  assert.equal(styles.heroCard.height,undefined);
  const card=nodes(screen).find(n=>n.props?.accessibilityLabel==='Eigenen Plan erstellen');assert.ok(card);card.props.onPress();assert.equal(pushes[0].pathname,'/tools/training-v2-plan-editor');
});
test('Screenshot active badge: independent bounded row above an unconstrained wrapping title',()=>{
  assert.ok(styles.detailStatusRow);assert.equal(styles.detailStatusBadge.maxWidth,'100%');assert.equal(styles.detailName.minWidth,0);
});
test('Layout safe areas: compact/large/landscape viewports retain notch and floating-tab clearance',()=>{
  for(const [width,height,insets] of [[320,568,{top:20,bottom:0,left:0,right:0}],[430,932,{top:59,bottom:34,left:0,right:0}],[844,390,{top:0,bottom:21,left:59,right:59}]]) {
    const s=v=>Math.round(v*Math.min(Math.max(width/390,0.8),1.15));
    const sv=v=>Math.round(v*Math.min(Math.max(height/844,0.8),1.15));
    const {useTrainingV2ContentStyle}=loadModule(__dirname,'../hooks/useTrainingV2ContentStyle.js',{
      'react-native-safe-area-context':{useSafeAreaInsets:()=>insets},'../../../../constants/layout':{s,sv},'../styles/trainingV2Styles':{styles},
    });
    const [,content]=useTrainingV2ContentStyle();
    assert.ok(content.paddingTop>=insets.top+sv(20));assert.ok(content.paddingBottom>=insets.bottom+sv(68)+sv(23));
    assert.ok(content.paddingLeft>=insets.left+s(16));assert.ok(content.paddingRight>=insets.right+s(16));
  }
});
for(const grow of [false,true]) {
  test(`Screenshot ${grow?'Grow':'own'} detail: long title and revision are below the bounded active status row`,()=>{
    const name='Ein sehr langer Trainingsplanname mit mehreren Wörtern '.repeat(3);
    const plan={id:'p',name,status:'active',isActive:true,sourceTemplateId:grow?'t':null,revision:{revisionNumber:17},units:[]};
    const harness=createHookHarness(react=>{
      const component=loadJsxModule(__dirname,grow?'../screens/TrainingV2GrowPlanDetail.jsx':'../screens/TrainingV2OwnPlanDetail.jsx',{
        react,'react-native':{},'expo-router':{router:{}},'../../../../constants/colors':{COLORS:{}},'../styles/trainingV2Styles':{styles},
        '../hooks/useTrainingV2ContentStyle':{useTrainingV2ContentStyle:()=>[]},
        '../hooks/useTrainingV2PlanDetail':{useTrainingV2PlanDetail:()=>({plan})},'../hooks/useTrainingV2TemplateDetail':{useTrainingV2TemplateDetail:()=>({template:plan})},
        '../hooks/useTrainingV2PlanActions':{useTrainingV2PlanActions:()=>({pending:null})},'../hooks/useTrainingV2TemplateActions':{useTrainingV2TemplateActions:()=>({pending:null})},
        '../hooks/useTrainingV2Plans':{useTrainingV2Plans:()=>({plans:[]})},'../models/trainingV2ViewModel':{},'../components/TrainingV2StateView':{},
        '../services/trainingV2DraftStorage':{},'../services/trainingV2PlansCache':{},'./TrainingV2OwnPlanDetail':{},
      }).default;return ()=>component({planId:'p',templateId:'t'});
    });harness.render();
    const header=nodes(harness.result).find(n=>n.props?.style===styles.detailHeader);
    const children=header.props.children.filter(Boolean);
    assert.equal(children[0].props.style,styles.detailStatusRow);
    assert.equal(children[1].props.children,name);assert.equal(children[1].props.numberOfLines,undefined);
    assert.equal(children[2].props.children.join(''),'Revision 17');
    assert.equal(styles.detailHeader.height,undefined);harness.unmount();
  });
}
