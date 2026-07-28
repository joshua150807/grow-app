import { TrainingV2Background } from '../../../features/tools/training-v2/components/TrainingV2Background';
import TrainingV2PlansScreen from '../../../features/tools/training-v2/screens/TrainingV2PlansScreen';

export default function TrainingV2PlansRoute() {
  return (
    <TrainingV2Background>
      <TrainingV2PlansScreen />
    </TrainingV2Background>
  );
}
