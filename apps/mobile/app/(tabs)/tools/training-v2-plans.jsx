import { TrainingV2PlansBackground } from '../../../features/tools/training-v2/components/TrainingV2PlansBackground';
import TrainingV2PlansScreen from '../../../features/tools/training-v2/screens/TrainingV2PlansScreen';

export default function TrainingV2PlansRoute() {
  return (
    <TrainingV2PlansBackground>
      <TrainingV2PlansScreen />
    </TrainingV2PlansBackground>
  );
}
