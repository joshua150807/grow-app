import { TrainingV2Background } from '../../../features/tools/training-v2/components/TrainingV2Background';
import TrainingV2HistoryScreen from '../../../features/tools/training-v2/screens/TrainingV2HistoryScreen';

export default function Route() {
  return (
    <TrainingV2Background>
      <TrainingV2HistoryScreen />
    </TrainingV2Background>
  );
}
