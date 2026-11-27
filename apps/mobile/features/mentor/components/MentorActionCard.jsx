import React, { memo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s } from '../../../constants/layout';
import { mentorStyles as styles } from '../styles/mentorStyles';

const STATUS_DISPLAY = {
  executing: { icon: 'time-outline', text: 'Wird ausgeführt…', color: COLORS.textMuted },
  executed: { icon: 'checkmark-circle', text: 'Erledigt', color: COLORS.gold },
  rejected: { icon: 'close-circle-outline', text: 'Abgelehnt', color: COLORS.textDim },
  failed: { icon: 'alert-circle-outline', text: 'Hat nicht geklappt', color: COLORS.errorLight },
  expired: { icon: 'hourglass-outline', text: 'Abgelaufen', color: COLORS.textDim },
};

function MentorActionCard({ action, pending, error, onConfirm, onReject }) {
  const isOpen = action.status === 'proposed';
  const display = STATUS_DISPLAY[action.status];

  return (
    <View style={[styles.actionCard, !isOpen && styles.actionCardDone]}>
      <View style={styles.actionHeader}>
        <Ionicons name="flash-outline" size={s(14)} color={COLORS.mutedGold} />
        <Text style={styles.actionLabel}>Vorschlag</Text>
      </View>
      <Text style={styles.actionSummary}>{action.summary}</Text>

      {isOpen ? (
        <View style={styles.actionButtons}>
          <Pressable
            onPress={() => onReject(action)}
            disabled={pending}
            style={[styles.actionReject, pending && styles.actionButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={`Ablehnen: ${action.summary}`}
          >
            <Text style={styles.actionRejectText}>Ablehnen</Text>
          </Pressable>
          <Pressable
            onPress={() => onConfirm(action)}
            disabled={pending}
            style={[styles.actionConfirm, pending && styles.actionButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={`Bestätigen: ${action.summary}`}
          >
            {pending
              ? <ActivityIndicator size="small" color={COLORS.black} />
              : <Text style={styles.actionConfirmText}>Bestätigen</Text>}
          </Pressable>
        </View>
      ) : display ? (
        <View style={styles.actionStatusRow}>
          <Ionicons name={display.icon} size={s(16)} color={display.color} />
          <Text style={styles.actionStatusText}>{display.text}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.actionError}>{error}</Text> : null}
    </View>
  );
}

export default memo(MentorActionCard);
