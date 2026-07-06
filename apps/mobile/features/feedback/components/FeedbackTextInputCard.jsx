import React from 'react';
import { ImageBackground, StyleSheet, Text, TextInput, View } from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
import TourTarget from '../../onboarding/components/TourTarget';

const feedbackFieldImage = require('../../../assets/feedback/feedback-large-field.webp');

export default function FeedbackTextInputCard({ value, onChangeText }) {
  return (
    <TourTarget id="feedback-form" style={styles.tourTarget}>
      <ImageBackground
        source={feedbackFieldImage}
        style={styles.fieldBackground}
        imageStyle={styles.fieldImage}
        resizeMode="stretch"
      >
        <TextInput
          style={styles.input}
          multiline
          maxLength={500}
          value={value}
          onChangeText={onChangeText}
          placeholder="Teile deine Idee, dein Feedback oder was dir fehlt. Je mehr Details, desto besser."
          placeholderTextColor={COLORS.textDim}
        />

        <View style={styles.counterWrap} pointerEvents="none">
          <Text style={styles.counter}>{value.length}/500</Text>
        </View>
      </ImageBackground>
    </TourTarget>
  );
}

const styles = StyleSheet.create({
  tourTarget: {
    marginHorizontal: -s(20),
    marginBottom: sv(28),
  },
  fieldBackground: {
    minHeight: sv(148),
    overflow: 'hidden',
    paddingTop: sv(19),
    paddingHorizontal: s(20),
    paddingBottom: sv(30),
  },
  fieldImage: {
    borderRadius: s(18),
  },
  input: {
    flex: 1,
    minHeight: sv(92),
    color: COLORS.white,
    fontSize: sf(15),
    lineHeight: sv(22),
    fontWeight: '500',
    textAlignVertical: 'top',
    padding: 10,
  },
  counterWrap: {
    position: 'absolute',
    right: s(40),
    bottom: sv(17),
  },
  counter: {
    color: COLORS.textFaint,
    fontSize: sf(12),
    fontWeight: '500',
  },
});
