import { ImageBackground, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import { TRAINING_PAGE_BG } from '../../../../constants/toolAssets';

export default function TrainingToolsLayout() {
  return (
    <ImageBackground
      source={TRAINING_PAGE_BG}
      style={styles.background}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: styles.stackContent,
        }}
      />
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
  stackContent: {
    backgroundColor: 'transparent',
  },
});
