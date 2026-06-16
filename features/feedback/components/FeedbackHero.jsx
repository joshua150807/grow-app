import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

const feedbackHeroImage = require('../../../assets/feedback/feedback-hero.webp');

export default function FeedbackHero() {
  return (
    <View style={styles.heroStage}>
      <Image
        source={feedbackHeroImage}
        style={styles.heroImage}
        resizeMode="cover"
      />

      <View style={styles.topFade} />
      <View style={styles.bottomFade} />

      <View style={styles.growWrap}>
        <Text style={styles.growTitle}>GROW</Text>
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>Feedback</Text>
        <Text style={styles.subtitle}>Deine Stimme. Unser Wachstum.</Text>
        <Text style={styles.description}>
          Hilf uns, GROW jeden Tag ein Stück besser zu machen.
        </Text>
      </View>

      <View style={styles.heroIntro}>
        <Text style={styles.heroIntroTitle}>Dein Feedback bringt uns weiter.</Text>
        <Text style={styles.heroIntroSubtitle}>Gemeinsam wachsen wir.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroStage: {
    height: sv(420),
    marginHorizontal: -s(20),
    marginBottom: sv(18),
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  heroImage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: sv(52),
    width: '100%',
    height: sv(350),
  },
  topFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: sv(155),
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: sv(42),
    height: sv(110),
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  textBlock: {
    position: 'absolute',
    top: sv(30),
    left: s(20),
    width: '58%',
    zIndex: 3,
  },
  title: {
    color: COLORS.white,
    fontSize: sf(37),
    fontWeight: '800',
    marginBottom: sv(7),
  },
  subtitle: {
    color: COLORS.lightGold,
    fontSize: sf(15),
    fontWeight: '700',
    lineHeight: sv(20),
    marginBottom: sv(9),
  },
  description: {
    color: COLORS.textDim,
    fontSize: sf(13),
    lineHeight: sv(19),
    fontWeight: '500',
  },
  heroIntro: {
    position: 'absolute',
    left: s(20),
    right: s(20),
    bottom: sv(0),
    alignItems: 'center',
    zIndex: 3,
  },
  heroIntroTitle: {
    color: COLORS.lightGold,
    fontSize: sf(16),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: sv(4),
  },
  heroIntroSubtitle: {
    color: COLORS.textDim,
    fontSize: sf(14),
    textAlign: 'center',
  },
});
