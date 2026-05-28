import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// constants
import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';

// feature intern
import { useGoals } from '../hooks/useGoals';
import { GoalItem } from '../components/GoalItem';
import { AddGoalModal } from '../components/AddGoalModal';
import { styles } from '../styles/goalsStyles';
import PressableScale from '../../../../components/ui/PressableScale';
import ToolStateCard from '../../../../components/ui/ToolStateCard';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';
import { GOAL_CATEGORIES } from '../utils/goalUtils';

export default function GoalsScreen() {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const {
    goals,
    loading,
    loadError,
    actionError,
    setActionError,
    completedCount,
    total,
    progress,
    loadGoals,
    toggle,
    remove,
    add,
    update,
  } = useGoals(selectedCategory);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const [inputName, setInputName] = useState('');
  const [inputDeadline, setInputDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  const showLoading = useDelayedLoading(loading);

  const openAddModal = useCallback(() => {
    setEditingGoal(null);
    setInputName('');
    setInputDeadline('');
    setAddError(null);
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((goal) => {
    setEditingGoal(goal);
    setInputName(goal.name || '');
    setInputDeadline(goal.deadline || '');
    setAddError(null);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingGoal(null);
    setInputName('');
    setInputDeadline('');
    setAddError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!inputName.trim()) return;

    setAddError(null);
    setSaving(true);

    try {
      if (editingGoal) {
        await update(editingGoal.id, inputName.trim(), inputDeadline.trim());
      } else {
        await add(inputName.trim(), selectedCategory, inputDeadline.trim());
      }

      closeModal();
    } catch (e) {
      setAddError(
        editingGoal
          ? 'Ziel konnte nicht aktualisiert werden. Bitte versuche es erneut.'
          : 'Ziel konnte nicht gespeichert werden. Bitte versuche es erneut.'
      );
    } finally {
      setSaving(false);
    }
  }, [inputName, inputDeadline, selectedCategory, add, update, editingGoal, closeModal]);

  const canAdd = inputName.trim().length > 0;

  return (
    <View style={styles.screen}>

      <View style={styles.topBar}>
        <PressableScale onPress={() => router.back()} style={styles.backButton} activeScale={0.97} activeOpacity={0.82}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="trophy" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>Goals</Text>
          <Text style={styles.subtitle}>Set clear goals. Chase your dreams.</Text>
        </View>

        {/* Ladefehler */}
        {loadError && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={s(20)} color={styles.errorIcon.color} />
            <Text style={styles.errorText}>{loadError}</Text>
            <PressableScale onPress={loadGoals} style={styles.retryBtn} activeScale={0.97} activeOpacity={0.86}>
              <Text style={styles.retryText}>Erneut versuchen</Text>
            </PressableScale>
          </View>
        )}

        {/* Aktionsfehler */}
        {actionError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={s(16)} color={styles.errorIcon.color} />
            <Text style={styles.errorBannerText}>{actionError}</Text>
            <PressableScale onPress={() => setActionError(null)} hitSlop={s(8)} activeScale={0.9} activeOpacity={0.75}>
              <Ionicons name="close" size={s(16)} color={COLORS.textDim} />
            </PressableScale>
          </View>
        )}

        {/* Kategorie-Tabs */}
        <View style={styles.categoryRow}>
          {GOAL_CATEGORIES.map((cat, index) => (
            <Pressable
              key={cat}
              style={[styles.catBtn, selectedCategory === index && styles.catBtnActive]}
              onPress={() => setSelectedCategory(index)}
            >
              <Text style={[styles.catBtnText, selectedCategory === index && styles.catBtnTextActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Fortschritt */}
        <View style={styles.progressRow}>
          <Text style={styles.sectionTitle}>{GOAL_CATEGORIES[selectedCategory].toUpperCase()}</Text>
          <Text style={styles.counter}>{completedCount}/{total} erreicht</Text>
        </View>
        <View style={styles.progressCard}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Liste */}
        {showLoading ? (
          <ToolStateCard loading title="Ziele werden geladen" subtitle="Dein Fortschritt wird vorbereitet." />
        ) : !loading && total === 0 ? (
          <ToolStateCard
            icon="trophy-outline"
            title="Noch keine Ziele."
            subtitle="Füge dein erstes Ziel hinzu und mach es messbar."
          />
        ) : !loading ? (
          <View style={styles.list}>
            {goals.map(goal => (
              <GoalItem
                key={goal.id}
                goal={goal}
                onToggle={toggle}
                onDelete={remove}
                onEdit={openEditModal}
              />
            ))}
          </View>
        ) : null}

        {/* Hinzufügen */}
        <PressableScale style={styles.addButton} onPress={openAddModal} activeScale={0.975} activeOpacity={0.88}>
          <Ionicons name="add-circle-outline" size={s(22)} color={COLORS.gold} />
          <Text style={styles.addText}>Ziel hinzufügen</Text>
        </PressableScale>

      </ScrollView>

      <AddGoalModal
        visible={modalVisible}
        onClose={closeModal}
        inputName={inputName}
        setInputName={setInputName}
        inputDeadline={inputDeadline}
        setInputDeadline={setInputDeadline}
        addError={addError}
        canAdd={canAdd}
        adding={saving}
        onAdd={handleSave}
        isEditing={!!editingGoal}
      />
    </View>
  );
}