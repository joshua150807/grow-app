import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ImageBackground,
  KeyboardAvoidingView,
  Alert,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { JOURNAL_PAGE_BG } from '../../../../constants/toolAssets';
import { s } from '../../../../constants/layout';

import { useJournalEntries } from '../hooks/useJournalEntries';
import {
  addDaysToIsoDate,
  isFutureJournalDate,
  isJournalEntryValid,
  parseLocalDate,
  toLocalDateString,
} from '../utils/journalUtils';
import { styles } from '../styles/journalStyles';
import PressableScale from '../../../../components/ui/PressableScale';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';
import JournalCalendarModal from '../components/JournalCalendarModal';
import JournalDayPage from '../components/JournalDayPage';
import JournalPageNavigation from '../components/JournalPageNavigation';

const SWIPE_BACK_EDGE_WIDTH = s(30);
const SWIPE_TRIGGER_DISTANCE = s(96);
const SWIPE_TRIGGER_VELOCITY = 0.85;
const SWIPE_ACTIVE_DISTANCE = s(42);
const SWIPE_DIRECTION_LOCK_RATIO = 2.25;
const SWIPE_MAX_VERTICAL_DRIFT = s(52);

const emptyForm = {
  gratitude: '',
  didWell: '',
  improveTomorrow: '',
  habitsCompleted: true,
  missedHabits: '',
};

function getInitialPage() {
  return { type: 'day', date: toLocalDateString() };
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
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const pageTurn = useRef(new Animated.Value(0)).current;
  const isTurningRef = useRef(false);
  const gestureStartXRef = useRef(0);
  const swipeActiveRef = useRef(false);
  const inputTouchRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    fromProtectedEdge: false,
  });

  const selectedDate = selectedPage.date;
  const isFutureDay = isFutureJournalDate(selectedDate);

  const {
    visibleEntries,
    loading,
    loadError,
    actionError,
    setActionError,
    loadEntries,
    add,
    update,
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

  const updateSwipePreview = useCallback((translationX) => {
    const dragDistance = s(180);
    const progress = Math.max(-0.72, Math.min(0.72, translationX / dragDistance));
    pageTurn.setValue(progress);
  }, [pageTurn]);

  useEffect(() => {
    setForm(formFromEntry(currentDayEntry));
    setFormError(null);
  }, [currentDayEntry, selectedDate]);

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
    openPage({ type: 'day', date: addDaysToIsoDate(selectedPage.date, -1) }, 'prev');
  }, [openPage, selectedPage.date]);

  const handleNextPage = useCallback(() => {
    openPage({ type: 'day', date: addDaysToIsoDate(selectedPage.date, 1) }, 'next');
  }, [openPage, selectedPage.date]);

  const handleTextInputTouchStart = useCallback((event) => {
    const nativeEvent = event?.nativeEvent ?? {};
    const pageX = nativeEvent.pageX ?? nativeEvent.locationX ?? 0;
    const pageY = nativeEvent.pageY ?? nativeEvent.locationY ?? 0;

    inputTouchRef.current = {
      active: true,
      moved: false,
      startX: pageX,
      startY: pageY,
      fromProtectedEdge: pageX <= SWIPE_BACK_EDGE_WIDTH,
    };
  }, []);

  const handleTextInputTouchMove = useCallback((event) => {
    const touchState = inputTouchRef.current;
    if (!touchState.active || touchState.fromProtectedEdge || isTurningRef.current) return;

    const nativeEvent = event?.nativeEvent ?? {};
    const pageX = nativeEvent.pageX ?? nativeEvent.locationX ?? touchState.startX;
    const pageY = nativeEvent.pageY ?? nativeEvent.locationY ?? touchState.startY;
    const dx = pageX - touchState.startX;
    const dy = pageY - touchState.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > SWIPE_ACTIVE_DISTANCE && absDx > absDy * SWIPE_DIRECTION_LOCK_RATIO && absDy < SWIPE_MAX_VERTICAL_DRIFT) {
      touchState.moved = true;
      setScrollEnabled(false);
      updateSwipePreview(dx);
    }
  }, [updateSwipePreview]);

  const handleTextInputTouchEnd = useCallback((event, showAlertOnTap = false) => {
    const touchState = inputTouchRef.current;
    const nativeEvent = event?.nativeEvent ?? {};
    const pageX = nativeEvent.pageX ?? nativeEvent.locationX ?? touchState.startX;
    const pageY = nativeEvent.pageY ?? nativeEvent.locationY ?? touchState.startY;
    const dx = pageX - touchState.startX;
    const dy = pageY - touchState.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    setScrollEnabled(true);
    inputTouchRef.current = {
      active: false,
      moved: false,
      startX: 0,
      startY: 0,
      fromProtectedEdge: false,
    };

    if (touchState.active && !touchState.fromProtectedEdge && !isTurningRef.current) {
      if (absDx > SWIPE_TRIGGER_DISTANCE && absDx > absDy * SWIPE_DIRECTION_LOCK_RATIO && absDy < SWIPE_MAX_VERTICAL_DRIFT) {
        if (dx < 0) {
          handleNextPage();
        } else {
          handlePreviousPage();
        }
        return;
      }

      if (touchState.moved) {
        snapPageBack();
        return;
      }
    }

    if (showAlertOnTap && !touchState.moved) {
      showFutureAlert();
    }
  }, [handleNextPage, handlePreviousPage, showFutureAlert, snapPageBack]);

  const inputGestureProps = useMemo(() => ({
    onTouchStart: handleTextInputTouchStart,
    onTouchMove: handleTextInputTouchMove,
  }), [handleTextInputTouchMove, handleTextInputTouchStart]);

  const journalSwipeGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .runOnJS(true)
      .minDistance(s(24))
      .activeOffsetX([-SWIPE_ACTIVE_DISTANCE, SWIPE_ACTIVE_DISTANCE])
      .failOffsetY([-s(28), s(28)])
      .hitSlop({ left: -SWIPE_BACK_EDGE_WIDTH })
      .onBegin((event) => {
        gestureStartXRef.current = event.absoluteX ?? event.x ?? 0;
      })
      .onStart(() => {
        swipeActiveRef.current = false;
      })
      .onUpdate((event) => {
        if (isTurningRef.current) return;
        if (gestureStartXRef.current <= SWIPE_BACK_EDGE_WIDTH) return;

        const absDx = Math.abs(event.translationX);
        const absDy = Math.abs(event.translationY);

        if (absDx < SWIPE_ACTIVE_DISTANCE || absDx <= absDy * SWIPE_DIRECTION_LOCK_RATIO || absDy > SWIPE_MAX_VERTICAL_DRIFT) return;

        if (!swipeActiveRef.current) {
          swipeActiveRef.current = true;
          setScrollEnabled(false);
        }

        updateSwipePreview(event.translationX);
      })
      .onEnd((event) => {
        setScrollEnabled(true);
        swipeActiveRef.current = false;

        if (isTurningRef.current) return;
        if (gestureStartXRef.current <= SWIPE_BACK_EDGE_WIDTH) return;

        const absDx = Math.abs(event.translationX);
        const absDy = Math.abs(event.translationY);
        const isClearHorizontalSwipe = absDx > absDy * SWIPE_DIRECTION_LOCK_RATIO && absDy < SWIPE_MAX_VERTICAL_DRIFT;
        const hasEnoughDistance = absDx >= SWIPE_TRIGGER_DISTANCE;
        const hasEnoughVelocity = Math.abs(event.velocityX) >= SWIPE_TRIGGER_VELOCITY && absDx >= s(70);

        if (!isClearHorizontalSwipe || (!hasEnoughDistance && !hasEnoughVelocity)) {
          snapPageBack();
          return;
        }

        if (event.translationX < 0) {
          handleNextPage();
          return;
        }

        if (event.translationX > 0) {
          handlePreviousPage();
        }
      })
      .onFinalize(() => {
        setScrollEnabled(true);
        swipeActiveRef.current = false;
      });

    return Gesture.Simultaneous(panGesture, Gesture.Native());
  }, [handleNextPage, handlePreviousPage, snapPageBack, updateSwipePreview]);

  const handleOpenCalendar = useCallback(() => {
    setCalendarVisible(true);
  }, []);

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

  const handleToggleHabits = useCallback(() => {
    if (isFutureDay) {
      showFutureAlert();
      return;
    }
    updateForm('habitsCompleted', !form.habitsCompleted);
  }, [form.habitsCompleted, isFutureDay, showFutureAlert, updateForm]);

  const canSave = !saving && (isFutureDay || isJournalEntryValid(form));

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

            <PressableScale onPress={() => router.push('/tools/leitfragen')} style={styles.leitfragenTopButton}>
              <Ionicons name="help-circle-outline" size={s(16)} color={COLORS.softGold} />
              <Text style={styles.leitfragenTopButtonText}>Leitfragen</Text>
            </PressableScale>
          </View>

          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <GestureDetector gesture={journalSwipeGesture}>
              <View style={styles.gestureArea}>
                <ScrollView
                  contentContainerStyle={[styles.content, styles.questionDetailContent]}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={scrollEnabled}
                  directionalLockEnabled
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                >
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

                  <JournalPageNavigation
                    isStarterPage={false}
                    selectedDate={selectedDate}
                    onPreviousPage={handlePreviousPage}
                    onNextPage={handleNextPage}
                    onOpenCalendar={handleOpenCalendar}
                  />

                  <Animated.View style={[styles.pageTurnWrap, pageAnimatedStyle]}>
                    <Animated.View pointerEvents="none" style={[styles.pageTurnShadow, pageShadowStyle]} />
                    <Animated.View pointerEvents="none" style={[styles.pageTurnFold, pageFoldStyle]} />
                    <JournalDayPage
                      selectedDate={selectedDate}
                      isFutureDay={isFutureDay}
                      currentDayEntry={currentDayEntry}
                      showLoading={showLoading}
                      form={form}
                      onUpdateForm={updateForm}
                      onToggleHabits={handleToggleHabits}
                      inputGestureProps={inputGestureProps}
                      onTextInputTouchEnd={handleTextInputTouchEnd}
                      formError={formError}
                      canSave={canSave}
                      saving={saving}
                      onSave={handleSave}
                    />
                  </Animated.View>
                </ScrollView>
              </View>
            </GestureDetector>
          </KeyboardAvoidingView>
        </View>
      </ImageBackground>

      <JournalCalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        selectedDateObject={selectedDateObject}
        onCalendarChange={handleCalendarChange}
      />
    </View>
  );
}
