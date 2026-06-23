import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';
import { styles } from '../styles/journalStyles';

export default function JournalStarterPage({
  starterPage,
  starterAnswer,
  onChangeStarterAnswer,
  inputGestureProps,
  onTextInputTouchEnd,
  formError,
  canSaveStarter,
  starterSaving,
  onSaveStarterPage,
}) {
  return (
    <View style={styles.bookPageCard}>
      <View style={styles.pageHeaderRow}>
        <View style={styles.pageBadge}>
          <Ionicons name="sparkles-outline" size={s(16)} color={COLORS.gold} />
          <Text style={styles.pageBadgeText}>{starterPage?.eyebrow}</Text>
        </View>
      </View>

      <Text style={styles.bookPageTitle}>{starterPage?.title}</Text>
      <Text style={styles.bookPageDescription}>{starterPage?.description}</Text>

      <TextInput
        value={starterAnswer}
        onChangeText={onChangeStarterAnswer}
        placeholder={starterPage?.placeholder}
        placeholderTextColor={COLORS.textFaint}
        multiline
        scrollEnabled={false}
        {...inputGestureProps}
        onTouchEnd={(event) => onTextInputTouchEnd(event, false)}
        style={[styles.input, styles.starterInput]}
      />

      {formError && <Text style={styles.errorText}>{formError}</Text>}

      <PressableScale
        style={[styles.saveButton, !canSaveStarter && styles.saveButtonDisabled]}
        onPress={onSaveStarterPage}
        disabled={!canSaveStarter}
      >
        {starterSaving ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : (
          <Text style={styles.saveText}>Startseite speichern</Text>
        )}
      </PressableScale>
    </View>
  );
}
