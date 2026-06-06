import React from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

const sendButtonImage = require('../../../assets/feedback/feedback-send-button.webp');

export default function FeedbackSendButton({ sending, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={sending}
      style={[styles.pressable, sending && styles.pressableDisabled]}
    >
      <ImageBackground
        pointerEvents="none"
        source={sendButtonImage}
        style={styles.background}
        imageStyle={styles.image}
        resizeMode="stretch"
      >
        {sending ? (
          <>
            <ActivityIndicator color={COLORS.nearBlack} />
            <Text style={styles.text}>Wird gesendet...</Text>
          </>
        ) : (
          <Text style={styles.text}>Feedback senden</Text>
        )}
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginHorizontal: -s(4),
    marginTop: sv(8),
    marginBottom: sv(18),
    height: sv(86),
    overflow: 'visible',
  },
  pressableDisabled: {
    opacity: 0.72,
  },
  background: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: s(9),
    paddingHorizontal: s(22),
    paddingRight: s(76),
    overflow: 'hidden',
  },
  image: {
    borderRadius: s(999),
  },
  text: {
    color: COLORS.nearBlack,
    fontSize: sf(17),
    lineHeight: sv(22),
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(255,255,255,0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
