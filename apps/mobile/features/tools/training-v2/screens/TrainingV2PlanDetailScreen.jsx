import { useLocalSearchParams } from 'expo-router';

import TrainingV2GrowPlanDetail from './TrainingV2GrowPlanDetail';
import TrainingV2OwnPlanDetail from './TrainingV2OwnPlanDetail';

function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

// Own plans (sourceTemplateId === null) are opened by planId; every Grow entry — whether
// still untouched in the Grow-Trainingspläne list or already saved/active in the Saved list —
// is opened by templateId instead (see TrainingV2PlansScreen's navigation), since Save/
// Unsave/Activate are template-keyed server actions that transparently create the user's own
// plan copy on first use. This dispatcher is the only thing that changed on the route itself.
export default function TrainingV2PlanDetailScreen() {
  const params = useLocalSearchParams();
  const templateId = firstParam(params.templateId);
  const planId = firstParam(params.planId);

  if (templateId) return <TrainingV2GrowPlanDetail templateId={templateId} planId={planId} />;
  return <TrainingV2OwnPlanDetail planId={planId} />;
}
