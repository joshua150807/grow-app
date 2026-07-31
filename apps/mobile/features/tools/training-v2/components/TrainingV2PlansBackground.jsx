import { StyleSheet, View } from 'react-native';

import { COLORS } from '../../../../constants/colors';

// The plans list route (app/(tabs)/tools/training-v2-plans.jsx) targets a predominantly
// black background per its reference mockup, unlike the hub and the other training-v2
// sub-pages, which keep the shared cosmic TrainingV2Background. This is a separate,
// narrowly-scoped wrapper used only by that one route, so it can never affect them.
export function TrainingV2PlansBackground({ children }) {
  return <View style={styles.background}>{children}</View>;
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
