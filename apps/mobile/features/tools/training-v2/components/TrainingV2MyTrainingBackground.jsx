import { StyleSheet, View } from 'react-native';

import { COLORS } from '../../../../constants/colors';

// "Mein Training" targets a predominantly black background per its reference mockup,
// unlike the hub and the other training-v2 sub-pages, which keep the shared cosmic
// TrainingV2Background. Mirrors TrainingV2PlansBackground's pattern (its own narrowly
// scoped wrapper, per route) rather than reusing that one, since it is named for and
// only ever asserted against the plans route.
export function TrainingV2MyTrainingBackground({ children }) {
  return <View style={styles.background}>{children}</View>;
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
