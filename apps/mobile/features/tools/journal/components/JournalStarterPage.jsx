import { View, Text, TextInput, ActivityIndicator } from 'react-native';

import { COLORS } from '../../../../constants/colors';
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
  const prompts = starterPage?.prompts ?? [];
  const exampleAnswer = starterPage?.exampleAnswer?.trim();

  return (
    <View style={styles.bookPageCard}>
      <Text style={styles.starterQuestionTitle}>{starterPage?.title}</Text>

      {prompts.length > 0 && (
        <View style={styles.promptCard}>
          <Text style={styles.promptTitle}>Erklärung</Text>
          {prompts.map((prompt, index) => (
            <View key={`${starterPage?.key}-prompt-${index}`} style={styles.promptRow}>
              <Text style={styles.promptBullet}>•</Text>
              <Text style={styles.promptText}>{prompt}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.answerLabel}>Deine Antwort</Text>
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

      {exampleAnswer ? (
        <View style={styles.exampleCard}>
          <Text style={styles.exampleTitle}>Beispiel-Antwort</Text>
          <Text style={styles.exampleText}>{exampleAnswer}</Text>
        </View>
      ) : null}

      {formError && <Text style={styles.errorText}>{formError}</Text>}

      <PressableScale
        style={[styles.saveButton, !canSaveStarter && styles.saveButtonDisabled]}
        onPress={onSaveStarterPage}
        disabled={!canSaveStarter}
      >
        {starterSaving ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : (
          <Text style={styles.saveText}>Antwort speichern</Text>
        )}
      </PressableScale>
    </View>
  );
}
