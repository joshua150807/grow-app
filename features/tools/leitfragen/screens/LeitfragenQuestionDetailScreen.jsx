import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ImageBackground,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { LEITFRAGEN_PAGE_BG } from '../../../../constants/toolAssets';
import { s } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';
import { useLeitfragenAnswers } from '../hooks/useLeitfragenAnswers';
import { styles } from '../styles/leitfragenStyles';
import LeitfragenPageNavigation from '../components/LeitfragenPageNavigation';
import LeitfragenQuestionPage from '../components/LeitfragenQuestionPage';
import { LEITFRAGEN_PAGES, getLeitfragenPageIndex } from '../utils/leitfragenUtils';

const SWIPE_BACK_EDGE_WIDTH = s(30);
const SWIPE_TRIGGER_DISTANCE = s(96);
const SWIPE_TRIGGER_VELOCITY = 0.85;
const SWIPE_ACTIVE_DISTANCE = s(42);
const SWIPE_DIRECTION_LOCK_RATIO = 2.25;
const SWIPE_MAX_VERTICAL_DRIFT = s(52);

function getInitialPage(initialQuestionKey) {
  if (!initialQuestionKey) return { key: LEITFRAGEN_PAGES[0]?.key };

  const page = LEITFRAGEN_PAGES.find(item => item.key === initialQuestionKey);

  return page ? { key: page.key } : { key: LEITFRAGEN_PAGES[0]?.key };
}

export default function LeitfragenQuestionDetailScreen({ initialQuestionKey = null } = {}) {
  const [selectedPage, setSelectedPage] = useState(() => getInitialPage(initialQuestionKey));
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scrollRef = useRef(null);
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

  const questionPage = selectedPage
    ? LEITFRAGEN_PAGES.find(item => item.key === selectedPage.key)
    : LEITFRAGEN_PAGES[0];

  const {
    answersByKey,
    loadError,
    actionError,
    setActionError,
    loadAnswers,
    saveAnswer,
  } = useLeitfragenAnswers();

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

  const scrollQuestionToTop = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated });
    });
  }, []);

  const handleBackToOverview = useCallback(() => {
    if (isTurningRef.current) return;

    pageTurn.stopAnimation();
    pageTurn.setValue(0);
    setFormError(null);
    setScrollEnabled(true);
    router.back();
  }, [pageTurn]);

  useEffect(() => {
    setSelectedPage(getInitialPage(initialQuestionKey));
    setFormError(null);
    pageTurn.stopAnimation();
    pageTurn.setValue(0);
    scrollQuestionToTop(false);
  }, [initialQuestionKey, pageTurn, scrollQuestionToTop]);

  useEffect(() => {
    if (!questionPage) {
      setAnswer('');
      setFormError(null);
      return;
    }

    setAnswer(answersByKey[questionPage.key]?.answer || '');
    setFormError(null);
    scrollQuestionToTop(false);
  }, [questionPage, scrollQuestionToTop, answersByKey]);

  const resetPageState = useCallback(() => {
    setFormError(null);
  }, []);

  const openQuestionPage = useCallback((page, direction = 'next') => {
    if (isTurningRef.current || !page) return;

    const outValue = direction === 'next' ? -1 : 1;
    const inValue = direction === 'next' ? 1 : -1;

    isTurningRef.current = true;
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

      setSelectedPage({ key: page.key });
      scrollQuestionToTop(false);
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
  }, [pageTurn, resetPageState, scrollQuestionToTop]);

  const snapPageBack = useCallback(() => {
    Animated.spring(pageTurn, {
      toValue: 0,
      friction: 7,
      tension: 85,
      useNativeDriver: true,
    }).start();
  }, [pageTurn]);

  const handlePreviousPage = useCallback(() => {
    if (!questionPage) return;

    const currentIndex = getLeitfragenPageIndex(questionPage);
    if (currentIndex <= 0) {
      snapPageBack();
      return;
    }

    openQuestionPage(LEITFRAGEN_PAGES[currentIndex - 1], 'prev');
  }, [openQuestionPage, questionPage, snapPageBack]);

  const handleNextPage = useCallback(() => {
    if (!questionPage) return;

    const currentIndex = getLeitfragenPageIndex(questionPage);
    if (currentIndex < LEITFRAGEN_PAGES.length - 1) {
      openQuestionPage(LEITFRAGEN_PAGES[currentIndex + 1], 'next');
      return;
    }

    snapPageBack();
  }, [openQuestionPage, questionPage, snapPageBack]);

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

  const handleTextInputTouchEnd = useCallback((event) => {
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
      }
    }
  }, [handleNextPage, handlePreviousPage, snapPageBack]);

  const inputGestureProps = useMemo(() => ({
    onTouchStart: handleTextInputTouchStart,
    onTouchMove: handleTextInputTouchMove,
  }), [handleTextInputTouchMove, handleTextInputTouchStart]);

  const leitfragenSwipeGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .runOnJS(true)
      .minDistance(s(24))
      .activeOffsetX([-SWIPE_ACTIVE_DISTANCE, SWIPE_ACTIVE_DISTANCE])
      .failOffsetY([-s(28), s(28)])
      .onBegin((event) => {
        gestureStartXRef.current = event.absoluteX ?? event.x ?? 0;
      })
      .onStart(() => {
        swipeActiveRef.current = false;
      })
      .onUpdate((event) => {
        if (!questionPage || isTurningRef.current) return;

        const absDx = Math.abs(event.translationX);
        const absDy = Math.abs(event.translationY);
        const isEdgeBackSwipe = gestureStartXRef.current <= SWIPE_BACK_EDGE_WIDTH && event.translationX > 0;

        if (isEdgeBackSwipe) return;

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

        if (!questionPage || isTurningRef.current) return;

        const absDx = Math.abs(event.translationX);
        const absDy = Math.abs(event.translationY);
        const isClearHorizontalSwipe = absDx > absDy * SWIPE_DIRECTION_LOCK_RATIO && absDy < SWIPE_MAX_VERTICAL_DRIFT;
        const hasEnoughDistance = absDx >= SWIPE_TRIGGER_DISTANCE;
        const hasEnoughVelocity = Math.abs(event.velocityX) >= SWIPE_TRIGGER_VELOCITY && absDx >= s(70);

        if (gestureStartXRef.current <= SWIPE_BACK_EDGE_WIDTH && event.translationX > 0) {
          snapPageBack();
          return;
        }

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
  }, [handleNextPage, handlePreviousPage, questionPage, snapPageBack, updateSwipePreview]);

  const handleSave = useCallback(async () => {
    if (!questionPage) return;

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setFormError('Fülle die Leitfrage aus, bevor du speicherst.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      await saveAnswer({ questionKey: questionPage.key, answer: trimmedAnswer });
    } catch (e) {
      setFormError('Leitfrage konnte nicht gespeichert werden. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  }, [answer, questionPage, saveAnswer]);

  const canSave = !saving && answer.trim().length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: false,
        }}
      />
      <View style={styles.screen}>
        <ImageBackground
          source={LEITFRAGEN_PAGE_BG}
          style={styles.background}
          imageStyle={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.backgroundOverlay}>
            <View style={styles.topBar}>
              <PressableScale
                onPress={handleBackToOverview}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
                <Text style={styles.backText}>Übersicht</Text>
              </PressableScale>
            </View>

            <KeyboardAvoidingView
              style={styles.keyboardAvoidingView}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <GestureDetector gesture={leitfragenSwipeGesture}>
                <View style={styles.gestureArea}>
                  <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={[styles.content, styles.questionDetailContent]}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={scrollEnabled}
                    directionalLockEnabled
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  >
                  <View style={styles.header}>
                    <Text style={styles.title}>LEITFRAGEN</Text>
                    <Text style={styles.subtitle}>
                      Große Fragen für Klarheit, Richtung und dein zukünftiges Ich.
                    </Text>
                  </View>

                  {loadError && (
                    <View style={styles.errorCard}>
                      <Text style={styles.errorText}>{loadError}</Text>
                      <PressableScale onPress={loadAnswers} style={styles.retryBtn}>
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

                  <LeitfragenPageNavigation
                    questionPage={questionPage}
                    onPreviousPage={handlePreviousPage}
                    onNextPage={handleNextPage}
                  />

                  <Animated.View style={[styles.pageTurnWrap, pageAnimatedStyle]}>
                    <Animated.View pointerEvents="none" style={[styles.pageTurnShadow, pageShadowStyle]} />
                    <Animated.View pointerEvents="none" style={[styles.pageTurnFold, pageFoldStyle]} />
                    <LeitfragenQuestionPage
                      questionPage={questionPage}
                      answer={answer}
                      onChangeAnswer={setAnswer}
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
      </View>
    </>
  );
}
