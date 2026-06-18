import { logger } from '../../../../../lib/logger';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../../constants/colors';
import { s, sv, sf } from '../../../../../constants/layout';
import { styles } from '../../styles/trainingStyles';
import { PRESET_PLANS } from '../../utils/trainingUtils';

export function PresetSelector({ onSave, onBack, existingPlan = null }) {
  const [saving, setSaving] = useState(false);
  const [savingPresetId, setSavingPresetId] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [previewPresetId, setPreviewPresetId] = useState(null);

  const handlePressPreset = useCallback((preset) => {
    if (saving) return;

    setSaveError(null);
    setSelectedPresetId((currentId) =>
      currentId === preset.id ? null : preset.id
    );

    if (selectedPresetId === preset.id) {
      setPreviewPresetId(null);
    }
  }, [saving, selectedPresetId]);

  const handleTogglePreview = useCallback((preset) => {
    if (saving) return;

    setPreviewPresetId((currentId) =>
      currentId === preset.id ? null : preset.id
    );
  }, [saving]);

  const savePreset = useCallback(
    async (preset) => {
      if (saving) return;

      setSaving(true);
      setSavingPresetId(preset.id);
      setSaveError(null);

      try {
        await onSave(preset.name, preset.days);
      } catch (e) {
        logger.error('[Training Setup] Preset save failed:', e);
        setSaveError('Plan konnte nicht ausgewählt werden. Bitte versuche es erneut.');
      } finally {
        setSaving(false);
        setSavingPresetId(null);
      }
    },
    [onSave, saving]
  );

  const handleSelectPreset = useCallback(
    async (preset) => {
      if (saving) return;

      if (existingPlan) {
        Alert.alert(
          'Trainingsplan ändern?',
          'Du hast bereits einen Trainingsplan. Wenn du einen neuen Plan auswählst, wird dein aktueller Plan überschrieben. Ändere deinen Plan nicht zu häufig, damit dein Fortschritt vergleichbar bleibt.',
          [
            {
              text: 'Abbrechen',
              style: 'cancel',
            },
            {
              text: 'Plan ändern',
              style: 'destructive',
              onPress: () => {
                savePreset(preset);
              },
            },
          ]
        );

        return;
      }

      await savePreset(preset);
    },
    [existingPlan, savePreset, saving]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton} disabled={saving}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Zurück</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="barbell-outline" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>PLÄNE</Text>
          <Text style={styles.subtitle}>Wähle einen fertigen Plan</Text>
        </View>

        {saveError && (
          <Text style={styles.saveErrorText}>{saveError}</Text>
        )}

        {PRESET_PLANS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          const isPreviewOpen = previewPresetId === preset.id;
          const isSavingThisPreset = saving && savingPresetId === preset.id;

          return (
            <View key={preset.id}>
              <Pressable
                style={[
                  styles.presetCard,
                  isSelected && localStyles.selectedPresetCard,
                  saving && localStyles.disabledCard,
                ]}
                onPress={() => handlePressPreset(preset)}
                disabled={saving}
              >
                <View style={styles.presetCardIconWrap}>
                  <Ionicons name={preset.icon} size={s(22)} color={COLORS.gold} />
                </View>

                <View style={styles.presetCardContent}>
                  <Text style={styles.presetCardName}>{preset.name}</Text>
                  <Text style={styles.presetCardDesc}>{preset.description}</Text>
                  <Text style={styles.presetCardBadge}>
                    {preset.days.length} {preset.days.length === 1 ? 'Trainingstag' : 'Trainingstage'}
                  </Text>
                </View>

                <Ionicons
                  name={isSelected ? 'chevron-down' : 'chevron-forward'}
                  size={s(18)}
                  color={isSelected ? COLORS.gold : COLORS.textDim}
                />
              </Pressable>

              {isSelected && (
                <View style={localStyles.actionWrap}>
                  <Pressable
                    style={localStyles.secondaryActionButton}
                    onPress={() => handleTogglePreview(preset)}
                    disabled={saving}
                  >
                    <Ionicons
                      name={isPreviewOpen ? 'eye-off-outline' : 'eye-outline'}
                      size={s(17)}
                      color={COLORS.gold}
                    />
                    <Text style={localStyles.secondaryActionText}>
                      {isPreviewOpen ? 'Ausblenden' : 'Anschauen'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={localStyles.primaryActionButton}
                    onPress={() => handleSelectPreset(preset)}
                    disabled={saving}
                  >
                    {isSavingThisPreset ? (
                      <ActivityIndicator color={COLORS.black} size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-outline" size={s(17)} color={COLORS.black} />
                        <Text style={localStyles.primaryActionText}>Auswählen</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              {isSelected && isPreviewOpen && (
                <View style={localStyles.previewBox}>
                  {preset.days.map((day, dayIndex) => (
                    <View key={day.id ?? `${preset.id}-day-${dayIndex}`} style={localStyles.previewDay}>
                      <Text style={localStyles.previewDayTitle}>
                        {day.name ?? `Tag ${dayIndex + 1}`}
                      </Text>

                      {day.exercises?.length > 0 ? (
                        day.exercises.map((exercise, exerciseIndex) => (
                          <Text
                            key={exercise.id ?? `${preset.id}-exercise-${dayIndex}-${exerciseIndex}`}
                            style={localStyles.previewExercise}
                          >
                            • {exercise.name ?? exercise.title ?? `Übung ${exerciseIndex + 1}`}
                          </Text>
                        ))
                      ) : (
                        <Text style={localStyles.previewExerciseMuted}>
                          Keine Übungen hinterlegt.
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const localStyles = {
  selectedPresetCard: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },

  disabledCard: {
    opacity: 0.5,
  },

  actionWrap: {
    flexDirection: 'row',
    gap: s(10),
    marginTop: sv(-6),
    marginBottom: sv(12),
    paddingHorizontal: s(4),
  },

  secondaryActionButton: {
    flex: 1,
    minHeight: sv(42),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.32)',
    backgroundColor: 'rgba(212,175,55,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: s(7),
  },

  secondaryActionText: {
    color: COLORS.gold,
    fontSize: sf(13),
    fontWeight: '800',
  },

  primaryActionButton: {
    flex: 1,
    minHeight: sv(42),
    borderRadius: s(12),
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: s(7),
  },

  primaryActionText: {
    color: COLORS.black,
    fontSize: sf(13),
    fontWeight: '900',
  },

  previewBox: {
    marginTop: sv(-4),
    marginBottom: sv(14),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: s(14),
    paddingVertical: sv(12),
  },

  previewDay: {
    marginBottom: sv(12),
  },

  previewDayTitle: {
    color: COLORS.white,
    fontSize: sf(14),
    fontWeight: '900',
    marginBottom: sv(5),
  },

  previewExercise: {
    color: COLORS.textSecondary,
    fontSize: sf(12.5),
    fontWeight: '600',
    lineHeight: sf(18),
  },

  previewExerciseMuted: {
    color: COLORS.textDim,
    fontSize: sf(12),
    fontWeight: '600',
  },
};