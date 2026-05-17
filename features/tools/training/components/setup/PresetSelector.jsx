import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../../constants/colors';
import { s } from '../../../../../constants/layout';
import { styles } from '../../styles/trainingStyles';
import { PRESET_PLANS } from '../../utils/trainingUtils';

export function PresetSelector({ onSave, onBack }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleSelectPreset = useCallback(
    async (preset) => {
      if (saving) return;

      setSaving(true);
      setSaveError(null);

      try {
        await onSave(preset.name, preset.days);
      } catch (e) {
        console.error('[Training Setup] Preset save failed:', e);
        setSaveError('Plan konnte nicht ausgewählt werden. Bitte versuche es erneut.');
      } finally {
        setSaving(false);
      }
    },
    [onSave, saving]
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

        {PRESET_PLANS.map(preset => (
          <Pressable
            key={preset.id}
            style={styles.presetCard}
            onPress={() => handleSelectPreset(preset)}
            disabled={saving}
            opacity={saving ? 0.5 : 1}
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
            {saving ? (
              <ActivityIndicator color={COLORS.gold} />
            ) : (
              <Ionicons name="chevron-forward" size={s(18)} color={COLORS.textDim} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}