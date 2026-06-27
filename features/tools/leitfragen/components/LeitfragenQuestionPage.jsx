import { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import PressableScale from '../../../../components/ui/PressableScale';
import { sv } from '../../../../constants/layout';
import { styles } from '../styles/leitfragenStyles';

const LEITFRAGEN_INPUT_MIN_HEIGHT = sv(120);
const LEITFRAGEN_INPUT_VERTICAL_SPACE = sv(24);

export default function LeitfragenQuestionPage({
  questionPage,
  answer,
  onChangeAnswer,
  inputGestureProps,
  onTextInputTouchEnd,
  formError,
  canSave,
  saving,
  onSave,
}) {
  const prompts = questionPage?.prompts ?? [];
  const exampleAnswer = questionPage?.exampleAnswer?.trim();
  const [inputHeight, setInputHeight] = useState(LEITFRAGEN_INPUT_MIN_HEIGHT);

  useEffect(() => {
    setInputHeight(LEITFRAGEN_INPUT_MIN_HEIGHT);
  }, [questionPage?.key]);

  const measuredAnswerText = answer ? `${answer}\u200B` : ' ';

  const handleMeasuredTextLayout = (event) => {
    const measuredTextHeight = event?.nativeEvent?.layout?.height ?? 0;
    const nextHeight = Math.max(
      LEITFRAGEN_INPUT_MIN_HEIGHT,
      Math.ceil(measuredTextHeight) + LEITFRAGEN_INPUT_VERTICAL_SPACE,
    );

    setInputHeight((currentHeight) => {
      if (Math.abs(currentHeight - nextHeight) < 2) return currentHeight;
      return nextHeight;
    });
  };

  return (
    <View style={styles.bookPageCard}>
      <Text style={styles.leitfragenQuestionTitle}>{questionPage?.title}</Text>

      {prompts.length > 0 && (
        <View style={styles.promptCard}>
          <Text style={styles.promptTitle}>Erklärung</Text>
          {prompts.map((prompt, index) => (
            <View key={`${questionPage?.key}-prompt-${index}`} style={styles.promptRow}>
              <Text style={styles.promptBullet}>•</Text>
              <Text style={styles.promptText}>{prompt}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.answerLabel}>Deine Antwort</Text>
      <View style={[styles.leitfragenInputWrap, { height: inputHeight }]}>
        <View
          pointerEvents="none"
          style={styles.leitfragenInputMeasure}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            onLayout={handleMeasuredTextLayout}
            style={styles.leitfragenInputMeasureText}
          >
            {measuredAnswerText}
          </Text>
        </View>

        <TextInput
          value={answer}
          onChangeText={onChangeAnswer}
          placeholder={questionPage?.placeholder}
          placeholderTextColor={COLORS.textFaint}
          multiline
          scrollEnabled={false}
          {...inputGestureProps}
          onTouchEnd={(event) => onTextInputTouchEnd(event, false)}
          style={[styles.input, styles.leitfragenInput]}
        />
      </View>

      {exampleAnswer ? (
        <View style={styles.exampleCard}>
          <Text style={styles.exampleTitle}>Beispiel-Antwort</Text>
          <Text style={styles.exampleText}>{exampleAnswer}</Text>
        </View>
      ) : null}

      {formError && <Text style={styles.errorText}>{formError}</Text>}

      <PressableScale
        style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={!canSave}
      >
        {saving ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : (
          <Text style={styles.saveText}>Antwort speichern</Text>
        )}
      </PressableScale>
    </View>
  );
}
