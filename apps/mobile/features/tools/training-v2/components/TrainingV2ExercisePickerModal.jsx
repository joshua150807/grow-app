import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { useTrainingV2ExercisePicker } from '../hooks/useTrainingV2ExercisePicker';
import { styles } from '../styles/trainingV2Styles';
import { TrainingV2StateView } from './TrainingV2StateView';

const CATEGORY_OPTIONS = [
  { value: undefined, label: 'Alle' },
  { value: 'strength', label: 'Kraft' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'stretching', label: 'Dehnen' },
];

export function TrainingV2ExercisePickerModal({ visible, onClose, onSelect }) {
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState(undefined);
  const {
    results, loading, error, search, reset,
  } = useTrainingV2ExercisePicker();

  useEffect(() => {
    if (!visible) {
      reset();
      setSearchText('');
      setCategory(undefined);
      return;
    }
    void search({ search: searchText || undefined, category });
    // Runs again whenever the modal opens or the category filter changes; free-text
    // search is looked up on submit instead of on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, category]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.modalSheet}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>Schließen</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Übung auswählen</Text>
          <TextInput
            onChangeText={setSearchText}
            onSubmitEditing={() => search({ search: searchText || undefined, category })}
            placeholder="Übung suchen …"
            placeholderTextColor="#6F6A77"
            returnKeyType="search"
            style={styles.modalSearchInput}
            value={searchText}
          />
          <View style={styles.chipRow}>
            {CATEGORY_OPTIONS.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                onPress={() => setCategory(option.value)}
                style={[styles.chip, category === option.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, category === option.value && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {loading || error ? (
            <TrainingV2StateView
              error={error}
              loading={loading}
              onRetry={() => search({ search: searchText || undefined, category })}
            />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.modalEmpty}>Keine Übungen gefunden.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onSelect(item.id, item.name)}
                  style={styles.modalResultRow}
                >
                  <Text style={styles.modalResultName}>{item.name}</Text>
                  <Text style={styles.modalResultMeta}>
                    {item.category}
                    {item.equipment.length > 0 ? ` · ${item.equipment.join(', ')}` : ''}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
