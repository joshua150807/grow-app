import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';

const softPress = (baseStyle, disabled = false) => ({ pressed }) => [
  baseStyle,
  pressed && !disabled && { opacity: 0.9, transform: [{ scale: 0.985 }] },
];

const iconPress = (disabled = false) => ({ pressed }) => [
  pressed && !disabled && { opacity: 0.75, transform: [{ scale: 0.94 }] },
];

const DAY_TYPES = [
  { value: 'gym', label: 'Gym', icon: 'barbell-outline' },
  { value: 'run', label: 'Laufen', icon: 'walk-outline' },
  { value: 'rest', label: 'Rest', icon: 'moon-outline' },
];

export function AddDayModal({ visible, onClose, onSave }) {
  const [name, setName] = useState('');
  const [dayType, setDayType] = useState('gym');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setName('');
    setDayType('gym');
    setError(null);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(name, dayType);
      reset();
    } catch {
      setError('Tag konnte nicht hinzugefügt werden.');
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: COLORS.black }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? sv(10) : 0}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tag hinzufügen</Text>
              <Pressable onPress={handleClose} style={iconPress(saving)} hitSlop={s(10)} disabled={saving}>
                <Ionicons name="close" size={s(24)} color={COLORS.textDim} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: sv(16) }}>
              <Text style={styles.modalLabel}>TYP</Text>
              <View style={localStyles.typeRow}>
                {DAY_TYPES.map((typeOption) => {
                  const active = dayType === typeOption.value;

                  return (
                    <Pressable
                      key={typeOption.value}
                      style={({ pressed }) => [
                        localStyles.typePill,
                        active && localStyles.typePillActive,
                        pressed && !saving && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                      ]}
                      onPress={() => setDayType(typeOption.value)}
                      disabled={saving}
                    >
                      <Ionicons
                        name={typeOption.icon}
                        size={s(15)}
                        color={active ? COLORS.black : COLORS.softGold}
                      />
                      <Text style={[localStyles.typeText, active && localStyles.typeTextActive]}>
                        {typeOption.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.modalLabel}>TAGNAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={dayType === 'run' ? 'z.B. Zone 2 Lauf' : dayType === 'rest' ? 'z.B. Rest Day' : 'z.B. Beine, Push, Oberkörper...'}
                placeholderTextColor={COLORS.textFaint}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
                editable={!saving}
              />

              {error ? <Text style={styles.modalError}>{error}</Text> : null}

              <Pressable
                style={softPress([styles.modalSaveBtn, !name.trim() && styles.saveBtnDisabled], !name.trim() || saving)}
                onPress={handleSave}
                disabled={!name.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.black} />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Hinzufügen</Text>
                )}
              </Pressable>

              <View style={{ height: sv(8) }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const localStyles = {
  typeRow: {
    flexDirection: 'row',
    gap: s(8),
    marginBottom: sv(16),
  },
  typePill: {
    flex: 1,
    minHeight: sv(36),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(5),
  },
  typePillActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  typeText: {
    color: COLORS.softGold,
    fontSize: sf(11),
    fontWeight: '800',
  },
  typeTextActive: {
    color: COLORS.black,
  },
};