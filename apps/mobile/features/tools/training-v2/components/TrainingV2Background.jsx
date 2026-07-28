import { ImageBackground, StyleSheet, View } from 'react-native';

import { TRAINING_PAGE_BG } from '../../../../constants/toolAssets';

// Training-V2 sub-pages live as flat, sibling routes directly under app/(tabs)/tools/ (not
// inside the (training) group), so that popping/swiping back from one of them is handled by
// a single Stack navigator instead of racing with a nested one — see the training-v2-*.jsx
// route files. That means they no longer inherit their background from (training)/_layout.jsx
// the way the hub and the other training screens still do, so each of them wraps itself with
// this component instead, reproducing the exact same visual treatment.
export function TrainingV2Background({ children }) {
  return (
    <ImageBackground
      source={TRAINING_PAGE_BG}
      style={styles.background}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.content}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  backgroundImage: {
    opacity: 0.82,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
