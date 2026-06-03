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

const circleImage = require('../../../assets/feedback/feedback-importance-circle.webp');

const values = [1, 2, 3, 4];

export default function FeedbackImportanceCircles({ selectedImportance, onSelect }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {values.map((value) => {
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
                  source={circleImage}
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
    paddingHorizontal: s(13),
    marginTop: sv(2),
    marginBottom: sv(3),
    overflow: 'visible',
  },
  circlePressable: {
    width: s(68),
    height: s(68),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  circleScaleWrap: {
    width: '100%',
    height: '100',
    borderRadius: s(29),
    overflow: 'hidden',
  },
  circleScaleWrapActive: {
    transform: [{ scale: 1.12 }],
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    elevation: 7,
    zIndex: 3,
  },
  circleBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleImage: {
    borderRadius: s(29),
  },
  inactiveShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  circleNumber: {
    color: COLORS.white,
    fontSize: sf(25),
    lineHeight: sv(30),
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    zIndex: 2,
  },
  circleNumberActive: {
    color: COLORS.lightGold,
    fontWeight: '800',
    textShadowColor: 'rgba(212,175,55,0.72)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: s(11),
  },
  label: {
    color: COLORS.textDim,
    fontSize: sf(11),
    fontWeight: '500',
  },
});
