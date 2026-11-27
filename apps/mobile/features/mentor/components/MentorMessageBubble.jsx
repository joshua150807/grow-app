import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { mentorStyles as styles } from '../styles/mentorStyles';

function MentorMessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
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
  );
}

export default memo(MentorMessageBubble);
