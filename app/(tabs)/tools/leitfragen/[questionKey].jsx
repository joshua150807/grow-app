import { useLocalSearchParams } from 'expo-router';

import LeitfragenQuestionDetailScreen from '../../../../features/tools/leitfragen/screens/LeitfragenQuestionDetailScreen';

export default function LeitfragenQuestionRoute() {
  const { questionKey } = useLocalSearchParams();
  const normalizedQuestionKey = Array.isArray(questionKey) ? questionKey[0] : questionKey;

  return <LeitfragenQuestionDetailScreen initialQuestionKey={normalizedQuestionKey} />;
}
