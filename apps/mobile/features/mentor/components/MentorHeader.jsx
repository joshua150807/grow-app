import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s } from '../../../constants/layout';
import { mentorStyles as styles } from '../styles/mentorStyles';

export default function MentorHeader({ backLabel, onBack, title = '', right = null }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8} accessibilityRole="button">
          <Ionicons name="chevron-back" size={s(22)} color={COLORS.softGold} />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
      </View>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.headerSideRight}>{right}</View>
    </View>
  );
}
