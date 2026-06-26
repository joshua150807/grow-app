import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

const infoCards = [
  {
    key: 'opinion',
    image: require('../../../assets/feedback/feedback-info-opinion.webp'),
    title: 'Deine Meinung\nzählt',
    text: 'Jedes Feedback\nbringt uns weiter.',
  },
  {
    key: 'growth',
    image: require('../../../assets/feedback/feedback-info-growth.webp'),
    title: 'Gemeinsam wachsen',
    text: 'Wir hören zu und setzen um.',
  },
  {
    key: 'points',
    image: require('../../../assets/feedback/feedback-info-points.webp'),
    title: 'Belohnt\nwerden',
    text: 'Gib Feedback\n& sammle\nGrow Points.',
  },
];

export default function FeedbackInfoCards() {
  return (
    <View style={styles.row}>
      {infoCards.map((card) => (
        <View key={card.key} style={styles.cardWrap}>
          <ImageBackground
            source={card.image}
            style={styles.cardBackground}
            imageStyle={styles.cardImage}
            resizeMode="stretch"
          >
            <View style={styles.textLayer} pointerEvents="none">
              <Text style={styles.title}>{card.title}</Text>
              <Text style={styles.text}>{card.text}</Text>
            </View>
          </ImageBackground>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: s(8),
    marginTop: sv(2),
    marginBottom: sv(22),
    overflow: 'visible',
  },
  cardWrap: {
    flex: 1,
    height: sv(176),
    overflow: 'visible',
  },
  cardBackground: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: s(7),
    paddingBottom: sv(60),
    overflow: 'hidden',
  },
  cardImage: {
    borderRadius: s(20),
  },
  textLayer: {
    alignItems: 'center',
    width: '100%',
    transform: [{ translateX: s(-3)}]
  },
  title: {
    color: COLORS.lightGold,
    fontSize: sf(10.5),
    lineHeight: sv(13),
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(212,175,55,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7,
  },
  text: {
    color: COLORS.textDim,
    fontSize: sf(8.5),
    lineHeight: sv(11),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: sv(9),
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});
