import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s } from '../../../constants/layout';
import { MENTOR_MESSAGE_MAX_LENGTH } from '../services/mentorApi';
import { mentorStyles as styles } from '../styles/mentorStyles';

export default function MentorComposer({ value, onChangeText, onSend, sending, disabled }) {
  const canSend = !sending && !disabled && value.trim().length > 0;

  return (
    <View>
      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          value={value}
          onChangeText={onChangeText}
          placeholder="Schreib deinem Mentor…"
          placeholderTextColor={COLORS.textFaint}
          multiline
          maxLength={MENTOR_MESSAGE_MAX_LENGTH}
          editable={!disabled}
          selectionColor={COLORS.gold}
          accessibilityLabel="Nachricht an den Mentor"
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Nachricht senden"
          hitSlop={6}
        >
          <Ionicons name="arrow-up" size={s(20)} color={COLORS.black} />
        </Pressable>
      </View>
      <Text style={styles.disclaimer}>KI kann Fehler machen. Kein Ersatz für Fachleute.</Text>
    </View>
  );
}
