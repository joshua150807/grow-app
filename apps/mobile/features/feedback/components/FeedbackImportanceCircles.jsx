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

const importanceOptions = [
  {
    value: 1,
    image: require('../../../assets/feedback/feedback-importance-circle-1.webp'),
  },
  {
    value: 2,
    image: require('../../../assets/feedback/feedback-importance-circle-2.webp'),
  },
  {
    value: 3,
    image: require('../../../assets/feedback/feedback-importance-circle-3.webp'),
  },
  {
    value: 4,
    image: require('../../../assets/feedback/feedback-importance-circle-4.webp'),
  },
];

export default function FeedbackImportanceCircles({ selectedImportance, onSelect }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {importanceOptions.map(({ value, image }) => {
          const active = selectedImportance === value;

          return (
            <TouchableOpacity
              key={value}
              activeOpacity={0.86}
              onPress={() => onSelect(value)}
              style={styles.circlePressable}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={[styles.circleScaleWrap, active && styles.circleScaleWrapActive]}>
                <ImageBackground
                  source={image}
                  style={styles.circleBackground}
                  imageStyle={styles.circleImage}
                  resizeMode="cover"
                >
                  {!active && <View style={styles.inactiveShade} />}
                  <Text style={[styles.circleNumber, active && styles.circleNumberActive]}>
                    {value}
                  </Text>
                </ImageBackground>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.labels}>
        <Text style={styles.label}>Nicht wichtig</Text>
        <Text style={styles.label}>Sehr wichtig</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: sv(28),
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(6),
    marginTop: sv(2),
    marginBottom: sv(2),
    overflow: 'visible',
  },
  circlePressable: {
    width: s(76),
    height: s(76),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  circleScaleWrap: {
    width: s(72),
    height: s(72),
    borderRadius: s(36),
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  circleScaleWrapActive: {
    transform: [{ scale: 1.1 }],
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 7,
    zIndex: 3,
  },
  circleBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  circleImage: {
    borderRadius: s(36),
  },
  inactiveShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  circleNumber: {
    color: COLORS.white,
    fontSize: sf(24),
    lineHeight: sv(30),
    fontWeight: '300',
    textAlign: 'center',
    backgroundColor: 'transparent',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    zIndex: 2,
  },
  circleNumberActive: {
    color: COLORS.lightGold,
    fontWeight: '500',
    backgroundColor: 'transparent',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: s(7),
    marginTop: sv(1),
  },
  label: {
    color: COLORS.textDim,
    fontSize: sf(11.5),
    fontWeight: '450',
  },
});
