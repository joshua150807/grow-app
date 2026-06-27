import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { s, sv } from '../../../../constants/layout';

const GROW_COIN_INFO_IMAGE = require('../../../../assets/tool-icons/backgrounds/grow-coin-info-page.webp');
const GROW_COIN_INFO_ASPECT_RATIO = 941 / 1672;

export default function GrowCoinInfoScreen() {
  const { width: windowWidth } = useWindowDimensions();

  const imageWidth = Math.max(0, windowWidth - s(52));
  const imageHeight = imageWidth / GROW_COIN_INFO_ASPECT_RATIO;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <Image
          source={GROW_COIN_INFO_IMAGE}
          style={[
            styles.infoImage,
            {
              width: imageWidth,
              height: imageHeight,
            },
          ]}
          resizeMode="cover"
        />
      </ScrollView>

      <View pointerEvents="box-none" style={styles.backOverlay}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          hitSlop={s(12)}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Feather name="chevron-left" size={s(25)} color={COLORS.softGold ?? COLORS.toolsText} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: s(32),
    paddingTop: sv(120),
    paddingBottom: sv(30),
  },
  infoImage: {
    alignSelf: 'center',
  },
  backOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
  },
  backButton: {
    position: 'absolute',
    top: sv(56),
    left: s(16),
    width: s(44),
    height: s(44),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: s(22),
    backgroundColor: 'rgba(5, 5, 8, 0.78)',
    borderWidth: 1,
    borderColor: COLORS.goldBorderLight ?? COLORS.toolsCardBorder,
  },
  backButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
});
