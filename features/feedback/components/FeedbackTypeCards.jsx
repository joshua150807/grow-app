import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

const CARD_TYPES = [
  {
    label: 'Idee',
    title: 'Idee',
    image: require('../../../assets/feedback/feedback-card-idea.webp'),
  },
  {
    label: 'Bug melden',
    title: 'Bug melden',
    image: require('../../../assets/feedback/feedback-card-bug.webp'),
  },
  {
    label: 'Lob & Dank',
    title: 'Lob & Dank',
    image: require('../../../assets/feedback/feedback-card-praise.webp'),
  },
];

export default function FeedbackTypeCards({ selectedType, onSelect }) {
  return (
    <View style={styles.row}>
      {CARD_TYPES.map((item) => {
        const active = selectedType === item.label;

        return (
          <TouchableOpacity
            key={item.label}
            style={styles.cardPressable}
            onPress={() => onSelect(item.label)}
            activeOpacity={0.9}
          >
            <View style={[styles.cardScaleWrap, active && styles.cardScaleWrapActive]}>
              <ImageBackground
                source={item.image}
                style={styles.cardBackground}
                imageStyle={styles.cardImage}
                resizeMode="cover"
              >
                {!active && <View style={styles.inactiveShade} />}

                <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>
                  {item.title}
                </Text>
              </ImageBackground>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: s(8),
    marginBottom: sv(25),
    overflow: 'visible',
  },
  cardPressable: {
    flex: 1,
    height: sv(120),
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardScaleWrap: {
    width: '100%',
    height: '100%',
    borderRadius: s(22),
    overflow: 'hidden',
  },
  cardScaleWrapActive: {
    transform: [{ scale: 1.055 }],
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 7,
    zIndex: 3,
  },
  cardBackground: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: s(7),
    paddingBottom: sv(28),
  },
  cardImage: {
    borderRadius: s(22),
  },
  inactiveShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  cardTitle: {
    color: COLORS.white,
    fontSize: sf(13),
    lineHeight: sv(17),
    fontWeight: '400',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    zIndex: 2,
  },
  cardTitleActive: {
    color: COLORS.lightGold,
    textShadowColor: 'rgba(212,175,55,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  },
});
