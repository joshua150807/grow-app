import { TrainingV2Background } from '../../../features/tools/training-v2/components/TrainingV2Background';
import TrainingV2PlanEditorScreen from '../../../features/tools/training-v2/screens/TrainingV2PlanEditorScreen';

export default function TrainingV2PlanEditorRoute() {
  return (
    <TrainingV2Background>
      <TrainingV2PlanEditorScreen />
    </TrainingV2Background>
  );
}
