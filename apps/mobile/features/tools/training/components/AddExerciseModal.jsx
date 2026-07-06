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
import { s, sv } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';
import { inferMuscleGroup } from '../utils/muscleGroupUtils';

const softPress = (baseStyle, disabled = false) => ({ pressed }) => [
  baseStyle,
  pressed && !disabled && { opacity: 0.9, transform: [{ scale: 0.985 }] },
];

const iconPress = (disabled = false) => ({ pressed }) => [
  pressed && !disabled && { opacity: 0.75, transform: [{ scale: 0.94 }] },
];

export function AddExerciseModal({ visible, onClose, onSave }) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [muscleGroupEdited, setMuscleGroupEdited] = useState(false);
  const [weight, setWeight] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setName('');
    setMuscleGroup('');
    setMuscleGroupEdited(false);
    setWeight('');
    setSets('');
    setReps('');
    setNote('');
    setError(null);
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
      await onSave({ name, muscle_group: muscleGroup || inferMuscleGroup(name), weight, sets, reps, note });
      reset();
    } catch (e) {
      setError(e?.message || 'Übung konnte nicht gespeichert werden.');
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
            <Text style={styles.modalTitle}>Übung hinzufügen</Text>
            <Pressable onPress={handleClose} style={iconPress(saving)} hitSlop={s(10)} disabled={saving}>
              <Ionicons name="close" size={s(24)} color={COLORS.textDim} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: sv(16) }}>
            <Text style={styles.modalLabel}>ÜBUNGSNAME</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="z.B. Kniebeuge"
              placeholderTextColor={COLORS.textFaint}
              value={name}
              onChangeText={(value) => {
                setName(value);
                if (!muscleGroupEdited) setMuscleGroup(inferMuscleGroup(value));
              }}
              editable={!saving}
            />


            <Text style={styles.modalLabel}>MUSKELGRUPPE</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="z.B. Brust"
              placeholderTextColor={COLORS.textFaint}
              value={muscleGroup}
              onChangeText={(value) => {
                setMuscleGroup(value);
                setMuscleGroupEdited(true);
              }}
              editable={!saving}
            />

            <Text style={styles.modalLabel}>GEWICHT (KG)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="z.B. 100"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              editable={!saving}
            />

            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>SÄTZE</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="z.B. 3"
                  placeholderTextColor={COLORS.textFaint}
                  keyboardType="number-pad"
                  value={sets}
                  onChangeText={setSets}
                  editable={!saving}
                />
              </View>
              <View style={styles.modalRowSpacer} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>WDHL.</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="z.B. 8"
                  placeholderTextColor={COLORS.textFaint}
                  keyboardType="number-pad"
                  value={reps}
                  onChangeText={setReps}
                  editable={!saving}
                />
              </View>
            </View>

            <Text style={styles.modalLabel}>NOTIZ</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Optional"
              placeholderTextColor={COLORS.textFaint}
              multiline
              value={note}
              onChangeText={setNote}
              editable={!saving}
            />

            {error ? <Text style={styles.modalError}>{error}</Text> : null}

            <Pressable
              style={softPress([styles.modalSaveBtn, !name.trim() && styles.saveBtnDisabled], !name.trim() || saving)}
              onPress={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.softGold} />
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
