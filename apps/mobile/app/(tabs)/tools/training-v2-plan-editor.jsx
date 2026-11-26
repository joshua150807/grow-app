import { Stack } from 'expo-router';

import { TrainingV2Background } from '../../../features/tools/training-v2/components/TrainingV2Background';
import TrainingV2PlanEditorScreen from '../../../features/tools/training-v2/screens/TrainingV2PlanEditorScreen';

export default function TrainingV2PlanEditorRoute() {
  return (
    <>
      {/* The long-press back-button history menu can pop straight to an ancestor screen,
          bypassing usePreventRemove's own dirty-state guard in TrainingV2PlanEditorScreen —
          disabling it here, only for this route, closes that one extra escape hatch. */}
      <Stack.Screen options={{ headerBackButtonMenuEnabled: false }} />
      <TrainingV2Background>
        <TrainingV2PlanEditorScreen />
      </TrainingV2Background>
    </>
  );
}
