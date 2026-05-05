import { useState, useEffect } from 'react';
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

export function EditExerciseModal({ visible, exercise, onClose, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (exercise) {
      setName(exercise.name ?? '');
      setWeight(exercise.weight != null ? String(exercise.weight) : '');
      setSets(exercise.sets != null ? String(exercise.sets) : '');
      setReps(exercise.reps != null ? String(exercise.reps) : '');
      setNote(exercise.note ?? '');
      setError(null);
    }
  }, [exercise]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, weight, sets, reps, note });
    } catch {
      setError('Übung konnte nicht gespeichert werden.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch {
      setError('Übung konnte nicht gelöscht werden.');
      setDeleting(false);
    }
  };

  const busy = saving || deleting;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Übung bearbeiten</Text>
            <Pressable onPress={onClose} hitSlop={s(10)} disabled={busy}>
              <Ionicons name="close" size={s(24)} color={COLORS.textDim} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalLabel}>ÜBUNGSNAME</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="z.B. Bankdrücken"
              placeholderTextColor={COLORS.textFaint}
              value={name}
              onChangeText={setName}
              editable={!busy}
            />

            <Text style={styles.modalLabel}>GEWICHT (KG)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="z.B. 80"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              editable={!busy}
            />

            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>SÄTZE</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="z.B. 4"
                  placeholderTextColor={COLORS.textFaint}
                  keyboardType="number-pad"
                  value={sets}
                  onChangeText={setSets}
                  editable={!busy}
                />
              </View>
              <View style={styles.modalRowSpacer} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>WDHL.</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="z.B. 10"
                  placeholderTextColor={COLORS.textFaint}
                  keyboardType="number-pad"
                  value={reps}
                  onChangeText={setReps}
                  editable={!busy}
                />
              </View>
            </View>

            <Text style={styles.modalLabel}>NOTIZ</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="z.B. Schulterbreiter Griff, Ellbogen 45°..."
              placeholderTextColor={COLORS.textFaint}
              multiline
              value={note}
              onChangeText={setNote}
              editable={!busy}
            />

            {error ? <Text style={styles.modalError}>{error}</Text> : null}

            <Pressable
              style={[styles.modalSaveBtn, !name.trim() && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!name.trim() || busy}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.black} />
              ) : (
                <Text style={styles.modalSaveBtnText}>Speichern</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.modalDeleteBtn}
              onPress={handleDelete}
              disabled={busy}
            >
              {deleting ? (
                <ActivityIndicator color={COLORS.error} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={s(16)} color={COLORS.error} />
                  <Text style={styles.modalDeleteBtnText}>Übung löschen</Text>
                </>
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
