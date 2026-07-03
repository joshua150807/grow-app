import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

const GROW_COIN_INFO_IMAGE = require('../../../../assets/tool-icons/backgrounds/grow-coin-info-page.webp');
const GROW_COIN_INFO_ASPECT_RATIO = 941 / 1672;

export default function GrowCoinInfoScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const imageWidth = windowWidth;
  const imageHeight = imageWidth / GROW_COIN_INFO_ASPECT_RATIO;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
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
          resizeMode="contain"
          onLoadStart={() => {
            setImageError(false);
            setImageLoading(true);
          }}
          onLoadEnd={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
        />
      </ScrollView>

      {(imageLoading || imageError) && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          {imageError ? (
            <>
              <Feather name="alert-circle" size={s(30)} color={COLORS.softGold ?? COLORS.toolsText} />
              <Text style={styles.loadingText}>Bild konnte nicht geladen werden.</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={COLORS.softGold ?? COLORS.toolsText} />
              <Text style={styles.loadingText}>Grow Points & Coins werden geladen ...</Text>
            </>
          )}
        </View>
      )}

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
    paddingTop: sv(70),
    paddingBottom: sv(18),
  },
  infoImage: {
    alignSelf: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(28),
    backgroundColor: COLORS.black,
    zIndex: 90,
    elevation: 90,
  },
  loadingText: {
    marginTop: sv(14),
    color: COLORS.toolsTextMuted ?? COLORS.textSecondary,
    fontSize: sf(13),
    lineHeight: sf(19),
    textAlign: 'center',
  },
  backOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
  },
  backButton: {
    position: 'absolute',
    top: sv(46),
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
