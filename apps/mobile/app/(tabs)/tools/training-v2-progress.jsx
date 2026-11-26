import { useLocalSearchParams } from 'expo-router';
import { TrainingV2Background } from '../../../features/tools/training-v2/components/TrainingV2Background';
import Screen from '../../../features/tools/training-v2/screens/TrainingV2ProgressScreen';
export default function Route() {
  const params = useLocalSearchParams();
  return <TrainingV2Background><Screen mode={params.mode} exerciseId={params.exerciseId} /></TrainingV2Background>;
}
