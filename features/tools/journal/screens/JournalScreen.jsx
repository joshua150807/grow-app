import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  ImageBackground,
  Modal,
  Alert,
  Animated,
  Easing,
  PanResponder,
  Platform,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { JOURNAL_PAGE_BG } from '../../../../constants/toolAssets';
import { s } from '../../../../constants/layout';

import { useJournalEntries } from '../hooks/useJournalEntries';
import {
  JOURNAL_QUESTIONS,
  JOURNAL_STARTER_PAGES,
  addDaysToIsoDate,
  formatJournalDate,
  formatShortJournalDate,
  getRelativeDayLabel,
  isFutureJournalDate,
  isJournalEntryValid,
  parseLocalDate,
  toLocalDateString,
} from '../utils/journalUtils';
import { styles } from '../styles/journalStyles';
import PressableScale from '../../../../components/ui/PressableScale';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_BACK_EDGE_WIDTH = s(30);
const SWIPE_TRIGGER_DISTANCE = s(62);
const SWIPE_TRIGGER_VELOCITY = 0.35;

const emptyForm = {
  gratitude: '',
  didWell: '',
  improveTomorrow: '',
  habitsCompleted: true,
  missedHabits: '',
};

const getInitialPage = () => ({ type: 'day', date: toLocalDateString() });

function getStarterPageIndex(page) {
  if (page.type !== 'starter') return -1;
  return JOURNAL_STARTER_PAGES.findIndex(item => item.key === page.key);
}

function formFromEntry(entry) {
  if (!entry) return emptyForm;

  return {
    gratitude: entry.gratitude || '',
    didWell: entry.did_well || '',
    improveTomorrow: entry.improve_tomorrow || '',
    habitsCompleted: entry.habits_completed !== false,
    missedHabits: entry.missed_habits || '',
  };
}

export default function JournalScreen() {
  const [selectedPage, setSelectedPage] = useState(getInitialPage);
  const [tocVisible, setTocVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [starterAnswer, setStarterAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [starterSaving, setStarterSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const pageTurn = useRef(new Animated.Value(0)).current;
  const isTurningRef = useRef(false);

  const selectedDate = selectedPage.type === 'day' ? selectedPage.date : toLocalDateString();
  const isStarterPage = selectedPage.type === 'starter';
  const starterPage = isStarterPage
    ? JOURNAL_STARTER_PAGES.find(item => item.key === selectedPage.key)
    : null;
  const isFutureDay = selectedPage.type === 'day' && isFutureJournalDate(selectedPage.date);

  const {
    visibleEntries,
    starterEntriesByKey,
    loading,
    loadError,
    actionError,
    setActionError,
    loadEntries,
    add,
    update,
    saveStarterPage,
  } = useJournalEntries(selectedDate);

  const showLoading = useDelayedLoading(loading);
  const currentDayEntry = useMemo(() => visibleEntries[0] ?? null, [visibleEntries]);
  const selectedDateObject = useMemo(() => parseLocalDate(selectedDate), [selectedDate]);

  const pageAnimatedStyle = {
    opacity: pageTurn.interpolate({
      inputRange: [-1, -0.18, 0, 0.18, 1],
      outputRange: [0.28, 0.86, 1, 0.86, 0.28],
      extrapolate: 'clamp',
    }),
    transform: [
      { perspective: s(900) },
      {
        translateX: pageTurn.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-s(88), 0, s(88)],
          extrapolate: 'clamp',
        }),
      },
      {
        rotateY: pageTurn.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: ['-58deg', '0deg', '58deg'],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: pageTurn.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [0.95, 1, 0.95],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  const pageShadowStyle = {
    opacity: pageTurn.interpolate({
      inputRange: [-1, -0.2, 0, 0.2, 1],
      outputRange: [0.42, 0.18, 0, 0.18, 0.42],
      extrapolate: 'clamp',
    }),
  };

  const pageFoldStyle = {
    opacity: pageTurn.interpolate({
      inputRange: [-1, -0.25, 0, 0.25, 1],
      outputRange: [0.55, 0.22, 0, 0.22, 0.55],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: pageTurn.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [s(128), 0, -s(128)],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  useEffect(() => {
    if (!starterPage) return;
    setStarterAnswer(starterEntriesByKey[starterPage.key]?.answer || '');
  }, [starterPage, starterEntriesByKey]);

  useEffect(() => {
    if (isStarterPage) return;
    setForm(formFromEntry(currentDayEntry));
    setFormError(null);
  }, [currentDayEntry, isStarterPage, selectedDate]);

  const showFutureAlert = useCallback(() => {
    Alert.alert('Der Tag liegt in der Zukunft');
  }, []);

  const updateForm = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetPageState = useCallback(() => {
    setFormError(null);
  }, []);

  const openPage = useCallback((page, direction = 'next') => {
    if (isTurningRef.current) return;

    const outValue = direction === 'next' ? -1 : 1;
    const inValue = direction === 'next' ? 1 : -1;

    isTurningRef.current = true;
    setTocVisible(false);
    setCalendarVisible(false);
    resetPageState();
    pageTurn.stopAnimation();

    Animated.timing(pageTurn, {
      toValue: outValue,
      duration: 230,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        isTurningRef.current = false;
        return;
      }

      setSelectedPage(page);
      pageTurn.setValue(inValue);

      Animated.spring(pageTurn, {
        toValue: 0,
        friction: 8,
        tension: 72,
        useNativeDriver: true,
      }).start(() => {
        isTurningRef.current = false;
      });
    });
  }, [pageTurn, resetPageState]);

  const snapPageBack = useCallback(() => {
    Animated.spring(pageTurn, {
      toValue: 0,
      friction: 7,
      tension: 85,
      useNativeDriver: true,
    }).start();
  }, [pageTurn]);

  const handlePreviousPage = useCallback(() => {
    if (selectedPage.type === 'starter') {
      const currentIndex = getStarterPageIndex(selectedPage);
      if (currentIndex <= 0) {
        snapPageBack();
        return;
      }
      openPage({ type: 'starter', key: JOURNAL_STARTER_PAGES[currentIndex - 1].key }, 'prev');
      return;
    }

    openPage({ type: 'day', date: addDaysToIsoDate(selectedPage.date, -1) }, 'prev');
  }, [openPage, selectedPage, snapPageBack]);

  const handleNextPage = useCallback(() => {
    if (selectedPage.type === 'starter') {
      const currentIndex = getStarterPageIndex(selectedPage);
      if (currentIndex < JOURNAL_STARTER_PAGES.length - 1) {
        openPage({ type: 'starter', key: JOURNAL_STARTER_PAGES[currentIndex + 1].key }, 'next');
        return;
      }
      openPage({ type: 'day', date: toLocalDateString() }, 'next');
      return;
    }

    openPage({ type: 'day', date: addDaysToIsoDate(selectedPage.date, 1) }, 'next');
  }, [openPage, selectedPage]);

  const pagePanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      if (isTurningRef.current) return false;
      if (gestureState.x0 <= SWIPE_BACK_EDGE_WIDTH) return false;

      const absDx = Math.abs(gestureState.dx);
      const absDy = Math.abs(gestureState.dy);
      return absDx > s(10) && absDx > absDy * 1.35;
    },
    onPanResponderGrant: () => {
      pageTurn.stopAnimation();
    },
    onPanResponderMove: (_, gestureState) => {
      if (isTurningRef.current) return;

      const rawProgress = gestureState.dx / (SCREEN_WIDTH * 0.66);
      const clampedProgress = Math.max(-1, Math.min(1, rawProgress));
      pageTurn.setValue(clampedProgress);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (isTurningRef.current) return;

      const shouldGoNext = gestureState.dx < -SWIPE_TRIGGER_DISTANCE || gestureState.vx < -SWIPE_TRIGGER_VELOCITY;
      const shouldGoPrevious = gestureState.dx > SWIPE_TRIGGER_DISTANCE || gestureState.vx > SWIPE_TRIGGER_VELOCITY;

      if (shouldGoNext) {
        handleNextPage();
        return;
      }

      if (shouldGoPrevious) {
        handlePreviousPage();
        return;
      }

      snapPageBack();
    },
    onPanResponderTerminate: snapPageBack,
  }), [handleNextPage, handlePreviousPage, pageTurn, snapPageBack]);

  const handleOpenCalendar = useCallback(() => {
    if (isStarterPage) return;
    setCalendarVisible(true);
  }, [isStarterPage]);

  const handleCalendarChange = useCallback((event, date) => {
    if (Platform.OS === 'android' && event?.type === 'dismissed') {
      setCalendarVisible(false);
      return;
    }

    if (!date) return;

    const nextDate = toLocalDateString(date);
    openPage({ type: 'day', date: nextDate }, nextDate > selectedDate ? 'next' : 'prev');
  }, [openPage, selectedDate]);

  const handleSave = useCallback(async () => {
    if (isFutureDay) {
      showFutureAlert();
      return;
    }

    const payload = {
      entryDate: selectedDate,
      gratitude: form.gratitude.trim(),
      didWell: form.didWell.trim(),
      improveTomorrow: form.improveTomorrow.trim(),
      habitsCompleted: form.habitsCompleted,
      missedHabits: form.missedHabits.trim(),
    };

    if (!isJournalEntryValid(payload)) {
      setFormError('Fülle mindestens ein Feld aus.');
      return;
    }

    if (!payload.habitsCompleted && !payload.missedHabits) {
      setFormError('Gib kurz an, welche Gewohnheiten heute nicht geklappt haben.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (currentDayEntry) {
        await update(currentDayEntry.id, payload);
      } else {
        await add(payload);
      }
      setForm(prev => ({
        ...prev,
        gratitude: payload.gratitude,
        didWell: payload.didWell,
        improveTomorrow: payload.improveTomorrow,
        missedHabits: payload.habitsCompleted ? '' : payload.missedHabits,
      }));
    } catch (e) {
      setFormError('Eintrag konnte nicht gespeichert werden. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  }, [isFutureDay, selectedDate, form, currentDayEntry, add, update, showFutureAlert]);

  const handleSaveStarterPage = useCallback(async () => {
    if (!starterPage) return;

    const answer = starterAnswer.trim();
    if (!answer) {
      setFormError('Fülle die Startseite aus, bevor du speicherst.');
      return;
    }

    setStarterSaving(true);
    setFormError(null);

    try {
      await saveStarterPage({ pageKey: starterPage.key, answer });
    } catch (e) {
      setFormError('Startseite konnte nicht gespeichert werden. Bitte versuche es erneut.');
    } finally {
      setStarterSaving(false);
    }
  }, [saveStarterPage, starterAnswer, starterPage]);

  const handleToggleHabits = useCallback(() => {
    if (isFutureDay) {
      showFutureAlert();
      return;
    }
    updateForm('habitsCompleted', !form.habitsCompleted);
  }, [form.habitsCompleted, isFutureDay, showFutureAlert, updateForm]);

  const canSave = !saving && (isFutureDay || isJournalEntryValid(form));
  const canSaveStarter = !starterSaving && starterAnswer.trim().length > 0;

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={JOURNAL_PAGE_BG}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.backgroundOverlay}>
          <View style={styles.topBar}>
            <PressableScale onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
              <Text style={styles.backText}>Tools</Text>
            </PressableScale>

            <PressableScale onPress={() => setTocVisible(true)} style={styles.tocTopButton}>
              <Ionicons name="list-outline" size={s(20)} color={COLORS.softGold} />
              <Text style={styles.tocTopText}>Fragen</Text>
            </PressableScale>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.title}>JOURNAL</Text>
              <Text style={styles.subtitle}>Dein persönliches Buch. Jeden Tag eine Seite.</Text>
            </View>

            {loadError && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{loadError}</Text>
                <PressableScale onPress={loadEntries} style={styles.retryBtn}>
                  <Text style={styles.retryText}>Erneut versuchen</Text>
                </PressableScale>
              </View>
            )}

            {actionError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={s(16)} color={COLORS.errorLight} />
                <Text style={styles.errorText}>{actionError}</Text>
                <PressableScale onPress={() => setActionError(null)} hitSlop={s(8)} activeScale={0.94}>
                  <Ionicons name="close" size={s(16)} color={COLORS.textDim} />
                </PressableScale>
              </View>
            )}

            <View style={styles.pageNavCard}>
              <PressableScale onPress={handlePreviousPage} style={styles.pageArrowButton} activeScale={0.94}>
                <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
              </PressableScale>

              <PressableScale
                onPress={handleOpenCalendar}
                style={styles.pageNavCenter}
                activeScale={isStarterPage ? 1 : 0.96}
                disabled={isStarterPage}
              >
                <Text style={styles.pageNavKicker}>{isStarterPage ? starterPage?.eyebrow : getRelativeDayLabel(selectedDate)}</Text>
                <View style={styles.pageNavTitleRow}>
                  <Text style={styles.pageNavTitle} numberOfLines={1}>
                    {isStarterPage ? starterPage?.title : formatShortJournalDate(selectedDate)}
                  </Text>
                  {!isStarterPage && (
                    <Ionicons name="calendar-outline" size={s(15)} color={COLORS.textDim} />
                  )}
                </View>
              </PressableScale>

              <PressableScale onPress={handleNextPage} style={styles.pageArrowButton} activeScale={0.94}>
                <Ionicons name="chevron-forward" size={s(24)} color={COLORS.softGold} />
              </PressableScale>
            </View>

            <Animated.View
              style={[styles.pageTurnWrap, pageAnimatedStyle]}
              {...pagePanResponder.panHandlers}
            >
              <Animated.View pointerEvents="none" style={[styles.pageTurnShadow, pageShadowStyle]} />
              <Animated.View pointerEvents="none" style={[styles.pageTurnFold, pageFoldStyle]} />
              {isStarterPage ? (
                <View style={styles.bookPageCard}>
                  <View style={styles.pageHeaderRow}>
                    <View style={styles.pageBadge}>
                      <Ionicons name="sparkles-outline" size={s(16)} color={COLORS.gold} />
                      <Text style={styles.pageBadgeText}>{starterPage?.eyebrow}</Text>
                    </View>
                  </View>

                  <Text style={styles.bookPageTitle}>{starterPage?.title}</Text>
                  <Text style={styles.bookPageDescription}>{starterPage?.description}</Text>

                  <TextInput
                    value={starterAnswer}
                    onChangeText={setStarterAnswer}
                    placeholder={starterPage?.placeholder}
                    placeholderTextColor={COLORS.textFaint}
                    multiline
                    style={[styles.input, styles.starterInput]}
                  />

                  {formError && <Text style={styles.errorText}>{formError}</Text>}

                  <PressableScale
                    style={[styles.saveButton, !canSaveStarter && styles.saveButtonDisabled]}
                    onPress={handleSaveStarterPage}
                    disabled={!canSaveStarter}
                  >
                    {starterSaving ? (
                      <ActivityIndicator color={COLORS.gold} />
                    ) : (
                      <Text style={styles.saveText}>Startseite speichern</Text>
                    )}
                  </PressableScale>
                </View>
              ) : (
                <View style={styles.bookPageCard}>
                  <View style={styles.pageHeaderRow}>
                    <View style={styles.pageBadge}>
                      <Ionicons name="calendar-outline" size={s(16)} color={COLORS.gold} />
                      <Text style={styles.pageBadgeText}>{getRelativeDayLabel(selectedDate)}</Text>
                    </View>
                    {showLoading ? (
                      <ActivityIndicator color={COLORS.gold} size="small" />
                    ) : currentDayEntry ? (
                      <Text style={styles.pageEntryCount}>gespeichert</Text>
                    ) : null}
                  </View>

                  <Text style={styles.bookPageTitle}>{formatJournalDate(selectedDate)}</Text>
                  <Text style={styles.bookPageDescription}>
                    {isFutureDay
                      ? 'Diese Seite liegt in der Zukunft. Du kannst sie ansehen, aber noch nicht beschreiben.'
                      : 'Reflektiere diesen Tag ehrlich. Genau hier entsteht dein Verlauf.'}
                  </Text>

                  <View style={styles.questionBlock}>
                    <Text style={styles.questionText}>{JOURNAL_QUESTIONS.gratitude}</Text>
                    <TextInput
                      value={form.gratitude}
                      onChangeText={(text) => updateForm('gratitude', text)}
                      onPressIn={isFutureDay ? showFutureAlert : undefined}
                      onTouchStart={isFutureDay ? showFutureAlert : undefined}
                      editable={!isFutureDay}
                      placeholder="z. B. Gesundheit, Training, Familie, Fortschritt ..."
                      placeholderTextColor={COLORS.textFaint}
                      multiline
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.questionBlock}>
                    <Text style={styles.questionText}>{JOURNAL_QUESTIONS.didWell}</Text>
                    <TextInput
                      value={form.didWell}
                      onChangeText={(text) => updateForm('didWell', text)}
                      onPressIn={isFutureDay ? showFutureAlert : undefined}
                      onTouchStart={isFutureDay ? showFutureAlert : undefined}
                      editable={!isFutureDay}
                      placeholder="z. B. konzentriert gearbeitet, Sport gemacht ..."
                      placeholderTextColor={COLORS.textFaint}
                      multiline
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.questionBlock}>
                    <Text style={styles.questionText}>{JOURNAL_QUESTIONS.improveTomorrow}</Text>
                    <TextInput
                      value={form.improveTomorrow}
                      onChangeText={(text) => updateForm('improveTomorrow', text)}
                      onPressIn={isFutureDay ? showFutureAlert : undefined}
                      onTouchStart={isFutureDay ? showFutureAlert : undefined}
                      editable={!isFutureDay}
                      placeholder="z. B. früher starten, weniger Handy, härter fokussieren ..."
                      placeholderTextColor={COLORS.textFaint}
                      multiline
                      style={styles.input}
                    />
                  </View>

                  <Pressable style={styles.checkboxRow} onPress={handleToggleHabits}>
                    <View style={[styles.checkbox, form.habitsCompleted && styles.checkboxActive]}>
                      {form.habitsCompleted && (
                        <Ionicons name="checkmark" size={s(17)} color={COLORS.gold} />
                      )}
                    </View>
                    <Text style={styles.checkboxText}>Ich habe heute alle Gewohnheiten erfüllt</Text>
                  </Pressable>

                  {!form.habitsCompleted && (
                    <View style={styles.questionBlock}>
                      <Text style={styles.questionText}>Welche Gewohnheiten haben nicht geklappt?</Text>
                      <TextInput
                        value={form.missedHabits}
                        onChangeText={(text) => updateForm('missedHabits', text)}
                        onPressIn={isFutureDay ? showFutureAlert : undefined}
                        onTouchStart={isFutureDay ? showFutureAlert : undefined}
                        editable={!isFutureDay}
                        placeholder="z. B. Lesen, Dehnen, frühes Schlafen ..."
                        placeholderTextColor={COLORS.textFaint}
                        multiline
                        style={styles.input}
                      />
                    </View>
                  )}

                  {formError && <Text style={styles.errorText}>{formError}</Text>}

                  <PressableScale
                    style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={!canSave}
                  >
                    {saving ? (
                      <ActivityIndicator color={COLORS.gold} />
                    ) : (
                      <Text style={styles.saveText}>{currentDayEntry ? 'Änderungen speichern' : 'Journal speichern'}</Text>
                    )}
                  </PressableScale>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </View>
      </ImageBackground>

      <Modal visible={tocVisible} transparent animationType="fade" onRequestClose={() => setTocVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.tocModal}>
            <View style={styles.tocHeaderRow}>
              <View>
                <Text style={styles.tocTitle}>Inhaltsverzeichnis</Text>
                <Text style={styles.tocSubtitle}>Springe direkt zu einer Startfrage.</Text>
              </View>
              <PressableScale onPress={() => setTocVisible(false)} hitSlop={s(8)} activeScale={0.94}>
                <Ionicons name="close" size={s(24)} color={COLORS.textDim} />
              </PressableScale>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tocContent}>
              <Text style={styles.tocSectionLabel}>STARTFRAGEN</Text>
              {JOURNAL_STARTER_PAGES.map((page, index) => {
                const hasAnswer = Boolean(starterEntriesByKey[page.key]?.answer);
                return (
                  <PressableScale
                    key={page.key}
                    style={styles.tocItem}
                    onPress={() => openPage({ type: 'starter', key: page.key }, index === 0 ? 'prev' : 'next')}
                    activeScale={0.98}
                  >
                    <View style={styles.tocItemIcon}>
                      <Text style={styles.tocItemNumber}>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
                    <View style={styles.tocItemTextWrap}>
                      <Text style={styles.tocItemTitle}>{page.title}</Text>
                      <Text style={styles.tocItemSubtitle}>{hasAnswer ? 'ausgefüllt' : 'noch leer'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={s(18)} color={COLORS.textDim} />
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.tocHeaderRow}>
              <View>
                <Text style={styles.tocTitle}>Kalender</Text>
                <Text style={styles.tocSubtitle}>Wähle einen Tag aus.</Text>
              </View>
              <PressableScale onPress={() => setCalendarVisible(false)} hitSlop={s(8)} activeScale={0.94}>
                <Ionicons name="close" size={s(24)} color={COLORS.textDim} />
              </PressableScale>
            </View>

            <DateTimePicker
              value={selectedDateObject}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              onChange={handleCalendarChange}
              themeVariant="dark"
              accentColor={COLORS.gold}
              textColor={COLORS.softGold}
              positiveButton={{ label: 'Auswählen', textColor: COLORS.gold }}
              negativeButton={{ label: 'Abbrechen', textColor: COLORS.softGold }}
              style={styles.datePicker}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
