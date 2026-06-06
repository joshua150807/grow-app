import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { AFFIRMATIONS_PAGE_BG } from '../../../../constants/toolAssets';
import { s } from '../../../../constants/layout';

import { useAffirmations } from '../hooks/useAffirmations';
import {
  AFFIRMATION_CATEGORIES,
  AFFIRMATION_SUGGESTIONS,
  getTodayIsoDate,
  normalizeAffirmationText,
} from '../utils/affirmationUtils';
import { styles } from '../styles/affirmationsStyles';
import PressableScale from '../../../../components/ui/PressableScale';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';

const emptyForm = {
  text: '',
  category: 'Disziplin',
};

export default function AffirmationsScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [repeatModeVisible, setRepeatModeVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [repeatIndex, setRepeatIndex] = useState(0);
  const [editingAffirmation, setEditingAffirmation] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const {
    affirmations,
    loading,
    loadError,
    actionError,
    setActionError,
    loadAffirmations,
    addAffirmation,
    editAffirmation,
    toggleRepeatedToday,
    removeAffirmation,
  } = useAffirmations();

  const today = getTodayIsoDate();

  const repeatedTodayCount = useMemo(
    () => affirmations.filter((item) => item.last_repeated_date === today).length,
    [affirmations, today]
  );

  const totalRepetitions = useMemo(
    () => affirmations.reduce((sum, item) => sum + Number(item.total_repetitions || 0), 0),
    [affirmations]
  );

  const progressPercent = affirmations.length === 0
    ? 0
    : Math.round((repeatedTodayCount / affirmations.length) * 100);

  const currentRepeatItem = affirmations[repeatIndex];
  const showLoading = useDelayedLoading(loading);

  const openCreateModal = useCallback(() => {
    setEditingAffirmation(null);
    setForm(emptyForm);
    setModalVisible(true);
  }, []);

  const applySuggestion = useCallback((suggestion) => {
    setForm({
      text: suggestion.text,
      category: suggestion.category,
    });
  }, []);

  const openEditModal = useCallback((affirmation) => {
    setEditingAffirmation(affirmation);
    setForm({
      text: affirmation.text ?? '',
      category: affirmation.category ?? 'Disziplin',
    });
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    if (saving) return;
    setModalVisible(false);
    setEditingAffirmation(null);
    setForm(emptyForm);
  }, [saving]);

  const handleSave = useCallback(async () => {
    const cleanText = normalizeAffirmationText(form.text);

    if (!cleanText) return;

    setSaving(true);

    try {
      if (editingAffirmation) {
        await editAffirmation(editingAffirmation.id, {
          text: cleanText,
          category: form.category,
        });
      } else {
        await addAffirmation({
          text: cleanText,
          category: form.category,
        });
      }

      closeModal();
    } catch (error) {
      // Fehlertext wird im Hook gesetzt.
    } finally {
      setSaving(false);
    }
  }, [form, editingAffirmation, addAffirmation, editAffirmation, closeModal]);

  const confirmDelete = useCallback((affirmation) => {
    Alert.alert(
      'Affirmation löschen?',
      'Dieser Glaubenssatz wird dauerhaft gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => removeAffirmation(affirmation.id),
        },
      ]
    );
  }, [removeAffirmation]);

  const startRepeatMode = useCallback(() => {
    if (affirmations.length === 0) return;
    setRepeatIndex(0);
    setRepeatModeVisible(true);
  }, [affirmations.length]);

  const completeCurrentRepeat = useCallback(async () => {
    if (!currentRepeatItem) return;

    if (currentRepeatItem.last_repeated_date !== today) {
      await toggleRepeatedToday(currentRepeatItem);
    }

    if (repeatIndex >= affirmations.length - 1) {
      setRepeatModeVisible(false);
      setRepeatIndex(0);
      return;
    }

    setRepeatIndex((current) => current + 1);
  }, [affirmations.length, currentRepeatItem, repeatIndex, today, toggleRepeatedToday]);

  const canSave = normalizeAffirmationText(form.text).length > 0 && !saving;

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={AFFIRMATIONS_PAGE_BG}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.backgroundOverlay}>
      <View style={styles.topBar}>
        <PressableScale onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </PressableScale>

        <View style={styles.topActions}>
          <PressableScale onPress={openCreateModal} style={styles.iconButton} hitSlop={8} activeScale={0.94}>
            <Ionicons name="add" size={s(23)} color={COLORS.softGold} />
          </PressableScale>

          <PressableScale
            onPress={() => setHelpModalVisible(true)}
            style={styles.helpButton}
            hitSlop={8}
            activeScale={0.94}
          >
            <Ionicons name="help" size={s(18)} color={COLORS.softGold} />
          </PressableScale>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>MENTALES TRAINING</Text>
          <Text style={styles.title}>Affirmationen</Text>
          <Text style={styles.subtitle}>
            Wiederhole nicht, was du fühlst. Wiederhole, wer du wirst.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />

          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroLabel}>Heute wiederholt</Text>
              <Text style={styles.heroValue}>{repeatedTodayCount}/{affirmations.length}</Text>
              <Text style={styles.totalLabel}>{totalRepetitions} Wiederholungen gesamt</Text>
            </View>

            <View style={styles.miniBadge}>
              <Ionicons name="sparkles" size={s(15)} color={COLORS.toolsGold ?? COLORS.gold} />
              <Text style={styles.miniBadgeText}>Identität</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>

          <PressableScale onPress={startRepeatMode} style={styles.primaryButton} disabled={affirmations.length === 0}>
            <Ionicons name="play" size={s(17)} color={COLORS.black} />
            <Text style={styles.primaryButtonText}>Fokus-Wiederholung starten</Text>
          </PressableScale>
        </View>

        {loadError ? (
          <Pressable onPress={() => loadAffirmations()} style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={s(18)} color={COLORS.errorLight} />
            <Text style={styles.errorText}>
              {loadError} Tippe hier, um es erneut zu versuchen.
            </Text>
          </Pressable>
        ) : null}

        {actionError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={s(18)} color={COLORS.errorLight} />
            <Text style={styles.errorText}>{actionError}</Text>
            <PressableScale onPress={() => setActionError(null)} hitSlop={8} activeScale={0.94}>
              <Ionicons name="close" size={s(16)} color="rgba(255,241,210,0.45)" />
            </PressableScale>
          </View>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Meine Überzeugungen</Text>
        </View>

        {showLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.toolsGold ?? COLORS.gold} />
          </View>
        ) : !loading && affirmations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="sparkles-outline"
              size={s(42)}
              color="rgba(255,241,210,0.38)"
            />
            <Text style={styles.emptyTitle}>Noch keine Affirmationen</Text>
            <Text style={styles.emptyText}>
              Starte mit einem Satz, der dich an deinen Standard erinnert.
            </Text>
          </View>
        ) : !loading ? (
          affirmations.map((item) => {
            const repeatedToday = item.last_repeated_date === today;

            return (
              <View key={item.id} style={styles.affirmationCard}>
                <Pressable
                  style={styles.affirmationMain}
                  onPress={() => toggleRepeatedToday(item)}
                  onLongPress={() => openEditModal(item)}
                  delayLongPress={300}
                >
                  <View style={[styles.checkCircle, repeatedToday && styles.checkCircleActive]}>
                    {repeatedToday ? (
                      <Ionicons name="checkmark" size={s(16)} color={COLORS.black} />
                    ) : null}
                  </View>

                  <View style={styles.affirmationTextWrap}>
                    <Text style={styles.affirmationText}>{item.text}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.categoryText}>{item.category || 'Disziplin'}</Text>
                      <Text style={styles.dot}>•</Text>
                      <Text style={[styles.statusText, repeatedToday && styles.statusTextDone]}>
                        {repeatedToday ? 'Heute erledigt' : 'Noch offen'}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <PressableScale style={styles.cardActionButton} onPress={() => openEditModal(item)} hitSlop={8} activeScale={0.94}>
                  <Ionicons name="create-outline" size={s(18)} color="rgba(255,241,210,0.45)" />
                </PressableScale>

                <PressableScale style={styles.cardActionButton} onPress={() => confirmDelete(item)} hitSlop={8} activeScale={0.94}>
                  <Ionicons name="trash-outline" size={s(18)} color="rgba(255,241,210,0.38)" />
                </PressableScale>
              </View>
            );
          })
        ) : null}
      </ScrollView>

      <Pressable style={styles.floatingButton} onPress={openCreateModal}>
        <Ionicons name="add" size={s(21)} color={COLORS.black} />
        <Text style={styles.floatingButtonText}>Neue Affirmation</Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {editingAffirmation ? 'Affirmation bearbeiten' : 'Neue Affirmation'}
              </Text>

              <Pressable onPress={closeModal} hitSlop={8}>
                <Ionicons name="close" size={s(24)} color={COLORS.toolsText ?? COLORS.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Dein Glaubenssatz</Text>
            <TextInput
              value={form.text}
              onChangeText={(text) => setForm((current) => ({ ...current, text }))}
              placeholder="z. B. Ich handle auch ohne Motivation."
              placeholderTextColor={COLORS.toolsTextDim ?? COLORS.textFaint}
              style={styles.input}
              multiline
              maxLength={160}
            />

            {!editingAffirmation ? (
              <>
                <Text style={styles.inputLabel}>Vorschläge</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {AFFIRMATION_SUGGESTIONS.map((suggestion) => (
                    <Pressable
                      key={suggestion.text}
                      onPress={() => applySuggestion(suggestion)}
                      style={styles.suggestionChip}
                    >
                      <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
                      <Text style={styles.suggestionText}>{suggestion.text}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.inputLabel}>Kategorie</Text>
            <View style={styles.categoryWrap}>
              {AFFIRMATION_CATEGORIES.map((category) => {
                const active = form.category === category;

                return (
                  <Pressable
                    key={category}
                    onPress={() => setForm((current) => ({ ...current, category }))}
                    style={[styles.categoryPill, active && styles.categoryPillActive]}
                  >
                    <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <PressableScale
              onPress={handleSave}
              disabled={!canSave}
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            >
              <Text style={styles.saveButtonText}>{saving ? 'Speichert ...' : 'Speichern'}</Text>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      <Modal
        visible={helpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={styles.helpBackdrop}>
          <View style={styles.helpCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Was sind Affirmationen?</Text>

              <Pressable onPress={() => setHelpModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={s(24)} color={COLORS.toolsText ?? COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.helpContent}>
              <View style={styles.helpIntroBox}>
                <Ionicons name="sparkles" size={s(22)} color={COLORS.toolsGold ?? COLORS.gold} />
                <Text style={styles.helpIntroText}>
                  Affirmationen sind kurze Sätze, mit denen du deine gewünschte Identität bewusst wiederholst.
                </Text>
              </View>

              <View style={styles.helpStep}>
                <Text style={styles.helpStepNumber}>1</Text>
                <View style={styles.helpStepTextWrap}>
                  <Text style={styles.helpStepTitle}>Formuliere sie aktiv</Text>
                  <Text style={styles.helpStepText}>
                    Schreibe nicht „Ich will disziplinierter sein“, sondern „Ich halte Versprechen an mich selbst.“
                  </Text>
                </View>
              </View>

              <View style={styles.helpStep}>
                <Text style={styles.helpStepNumber}>2</Text>
                <View style={styles.helpStepTextWrap}>
                  <Text style={styles.helpStepTitle}>Wiederhole sie bewusst</Text>
                  <Text style={styles.helpStepText}>
                    Lies den Satz langsam. Es geht nicht um Magie, sondern darum, deinen Fokus täglich neu auszurichten.
                  </Text>
                </View>
              </View>

              <View style={styles.helpStep}>
                <Text style={styles.helpStepNumber}>3</Text>
                <View style={styles.helpStepTextWrap}>
                  <Text style={styles.helpStepTitle}>Beweise sie mit Handlung</Text>
                  <Text style={styles.helpStepText}>
                    Eine Affirmation wirkt erst richtig, wenn du danach eine kleine Entscheidung triffst, die zu diesem Satz passt.
                  </Text>
                </View>
              </View>

              <Text style={styles.helpExampleTitle}>Beispiel</Text>
              <Text style={styles.helpExampleText}>
                „Ich bin jemand, der auch dann handelt, wenn es unbequem wird.“
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={repeatModeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRepeatModeVisible(false)}
      >
        <View style={styles.repeatBackdrop}>
          <View style={styles.repeatModalCard}>
            <Pressable style={styles.repeatClose} onPress={() => setRepeatModeVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={s(24)} color={COLORS.toolsText ?? COLORS.textPrimary} />
            </Pressable>

            <Text style={styles.repeatKicker}>FOKUS-WIEDERHOLUNG</Text>
            <Text style={styles.repeatCounter}>
              {affirmations.length === 0 ? 0 : repeatIndex + 1} / {affirmations.length}
            </Text>

            <View style={styles.repeatQuoteCard}>
              <Text style={styles.repeatQuoteText}>{currentRepeatItem?.text}</Text>
            </View>

            <Text style={styles.repeatHint}>
              Lies den Satz bewusst. Dann bestätige ihn.
            </Text>

            <PressableScale onPress={completeCurrentRepeat} style={styles.primaryButton}>
              <Ionicons name="checkmark" size={s(20)} color={COLORS.black} />
              <Text style={styles.primaryButtonText}>Bewusst wiederholt</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
        </View>
      </ImageBackground>
    </View>
  );
}
