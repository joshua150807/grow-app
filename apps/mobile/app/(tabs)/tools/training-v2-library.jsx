import { TrainingV2Background } from '../../../features/tools/training-v2/components/TrainingV2Background';
import TrainingV2LibraryScreen from '../../../features/tools/training-v2/screens/TrainingV2LibraryScreen';

export default function TrainingV2LibraryRoute() {
  return (
    <TrainingV2Background>
      <TrainingV2LibraryScreen />
    </TrainingV2Background>
  );
}
