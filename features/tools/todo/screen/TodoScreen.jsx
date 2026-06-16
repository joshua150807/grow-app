import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import PressableScale from '../../../../components/ui/PressableScale';
import ToolStateCard from '../../../../components/ui/ToolStateCard';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';
import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { useTodos } from '../hooks/useTodos';
import { TodoItem } from '../components/TodoItem';
import { AddTodoModal } from '../components/AddTodoModal';
import { TODO_PAGE_BG } from '../../../../constants/toolAssets';
import { styles } from '../styles/todoStyles';

export default function TodoScreen() {
  const {
    todos,
    loading,
    error,
    completedCount,
    totalCount,
    progress,
    loadTodos,
    toggle,
    remove,
    add,
    update,
  } = useTodos();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);

  const [inputTitle, setInputTitle] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [androidStep, setAndroidStep] = useState('date');
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);
  const showLoading = useDelayedLoading(loading);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resetModalState = () => {
    setInputTitle('');
    setSelectedDate(null);
    setShowDatePicker(false);
    setAndroidStep('date');
    setEditingTodo(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetModalState();
  };

  const openAddModal = () => {
    resetModalState();
    setModalVisible(true);
  };

  const openEditModal = (todo) => {
    setEditingTodo(todo);
    setInputTitle(todo.title ?? '');

    if (todo.due_at) {
      setSelectedDate(new Date(todo.due_at));
      setShowDatePicker(true);
    } else {
      setSelectedDate(null);
      setShowDatePicker(false);
    }

    setAndroidStep('date');
    setModalVisible(true);
  };

  const datePickerLabel = showDatePicker && selectedDate
    ? `${selectedDate.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })} um ${selectedDate.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Fälligkeitsdatum setzen';

  const handleSubmit = async () => {
    if (!inputTitle.trim() || saving) return;

    try {
      setSaving(true);

      if (editingTodo) {
        await update(editingTodo.id, inputTitle.trim(), selectedDate);
      } else {
        await add(inputTitle.trim(), selectedDate);
      }

      if (mountedRef.current) {
        closeModal();
      }
    } catch (e) {
      console.log('Fehler beim Speichern der Todo:', e);
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  };

  if (error) {
    return (
      <ImageBackground
        source={TODO_PAGE_BG}
        style={styles.screen}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.pageOverlay} pointerEvents="none" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>

          <PressableScale
            onPress={loadTodos}
            style={styles.retryButton}
            activeScale={0.975}
            activeOpacity={0.88}
          >
            <Text style={styles.retryText}>Erneut versuchen</Text>
          </PressableScale>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={TODO_PAGE_BG}
      style={styles.screen}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.pageOverlay} pointerEvents="none" />
      <View style={styles.topBar}>
        <PressableScale
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={s(10)}
          activeScale={0.975}
          activeOpacity={0.82}
        >
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>TO-DO</Text>
          <Text style={styles.subtitle}>Erledige deine Aufgaben. Gewinne deinen Tag.</Text>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.sectionTitle}>AUFGABEN</Text>
          <Text style={styles.counter}>{completedCount}/{totalCount} erledigt</Text>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {showLoading ? (
          <ToolStateCard loading title="Aufgaben werden geladen" subtitle="Einen Moment, deine Liste wird vorbereitet." />
        ) : !loading && todos.length === 0 ? (
          <ToolStateCard
            icon="checkmark-circle-outline"
            title="Noch keine Aufgaben."
            subtitle="Füge deine erste Aufgabe hinzu und starte sauber in den Tag."
          />
        ) : !loading ? (
          <View style={styles.list}>
            {todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={toggle}
                onDelete={remove}
                onEdit={openEditModal}
              />
            ))}
          </View>
        ) : null}

        <PressableScale
          style={styles.addButton}
          onPress={openAddModal}
          activeScale={0.975}
          activeOpacity={0.88}
        >
          <Ionicons name="add-circle-outline" size={s(22)} color={COLORS.gold} />
          <Text style={styles.addText}>Neue Aufgabe hinzufügen</Text>
        </PressableScale>
      </ScrollView>

      <AddTodoModal
        visible={modalVisible}
        onClose={closeModal}
        inputTitle={inputTitle}
        setInputTitle={setInputTitle}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        showDatePicker={showDatePicker}
        setShowDatePicker={setShowDatePicker}
        androidStep={androidStep}
        setAndroidStep={setAndroidStep}
        datePickerLabel={datePickerLabel}
        adding={saving}
        onAdd={handleSubmit}
        isEditing={!!editingTodo}
      />
    </ImageBackground>
  );
}