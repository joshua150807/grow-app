import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { mentorStyles as styles } from '../styles/mentorStyles';
import MentorActionCard from './MentorActionCard';

function MentorMessageBubble({ message, actionState, onConfirmAction, onRejectAction }) {
  const isUser = message.role === 'user';
  const actions = !isUser && Array.isArray(message.actions) ? message.actions : [];

  return (
    <View>
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
            message.failed && styles.bubbleFailed,
          ]}
        >
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]} selectable>
            {message.content}
          </Text>
        </View>
      </View>
      {actions.map((action) => (
        <MentorActionCard
          key={action.id}
          action={action}
          pending={actionState?.[action.id]?.pending === true}
          error={actionState?.[action.id]?.error ?? null}
          onConfirm={onConfirmAction}
          onReject={onRejectAction}
        />
      ))}
    </View>
  );
}

export default memo(MentorMessageBubble);
