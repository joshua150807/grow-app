import { TrainingV2Background } from '../../../features/tools/training-v2/components/TrainingV2Background';
import TrainingV2SessionDetailScreen from '../../../features/tools/training-v2/screens/TrainingV2SessionDetailScreen';

export default function Route() {
  return (
    <TrainingV2Background>
      <TrainingV2SessionDetailScreen />
    </TrainingV2Background>
  );
}
