import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../../../components/ui/AppButton';
import ScreenContainer from '../../../components/ui/ScreenContainer';
import { COLORS } from '../../../constants/colors';
import { s } from '../../../constants/layout';
import logger from '../../../lib/logger';
import MentorComposer from '../components/MentorComposer';
import MentorHeader from '../components/MentorHeader';
import MentorMessageBubble from '../components/MentorMessageBubble';
import {
  isMentorApiEnabled,
  listMentorMessages,
  MentorApiError,
  sendMentorMessage,
} from '../services/mentorApi';
import { mentorStyles as styles } from '../styles/mentorStyles';

const STARTER_PROMPTS = [
  'Hilf mir, eine Gewohnheit aufzubauen, die ich wirklich durchziehe.',
  'Ich will im Training stärker werden. Wo fange ich an?',
  'Ich habe eine Business-Idee und brauche ehrliches Feedback.',
  'Welche Bücher bringen mich bei Disziplin und Fokus weiter?',
];

function userMessageFor(error) {
  return error instanceof MentorApiError
    ? error.userMessage
    : 'Etwas ist schiefgelaufen. Versuch es bitte noch einmal.';
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return visible;
}

export default function MentorChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialConversationId = typeof params.conversationId === 'string' ? params.conversationId : null;

  const [conversationId, setConversationId] = useState(initialConversationId);
  const [title, setTitle] = useState(initialConversationId ? '' : 'Neuer Chat');
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialConversationId));
  const [loadError, setLoadError] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState(null); // { text, action? }
  const [blocked, setBlocked] = useState(false);
  const [usage, setUsage] = useState(null);
  const mountedRef = useRef(true);
  const keyboardVisible = useKeyboardVisible();

  useEffect(() => () => { mountedRef.current = false; }, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
    router.replace('/tools/mentor');
  }, [router]);

  useEffect(() => {
    if (!isMentorApiEnabled()) router.replace('/tools/mentor');
  }, [router]);

  const loadInitial = useCallback(async () => {
    if (!initialConversationId) return;
    setLoading(true);
    setLoadError('');
    try {
      const page = await listMentorMessages(initialConversationId);
      if (!mountedRef.current) return;
      setMessages(page.messages);
      setHasMore(page.hasMore);
      setTitle(page.conversation?.title ?? '');
    } catch (error) {
      if (!mountedRef.current) return;
      logger.warn('[Mentor] Failed to load messages', error?.code);
      setLoadError(userMessageFor(error));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [initialConversationId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !hasMore || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const page = await listMentorMessages(conversationId, { before: messages[0].id });
      if (!mountedRef.current) return;
      setMessages((current) => [...page.messages, ...current]);
      setHasMore(page.hasMore);
    } catch (error) {
      logger.warn('[Mentor] Failed to load older messages', error?.code);
    } finally {
      if (mountedRef.current) setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder, messages]);

  const send = useCallback(async (text) => {
    const content = text.trim();
    if (!content || sending || blocked) return;

    const localId = `local-${Date.now()}`;
    setBanner(null);
    setDraft('');
    setSending(true);
    setMessages((current) => [...current, { id: localId, role: 'user', content }]);

    try {
      const result = await sendMentorMessage({ conversationId, content });
      if (!mountedRef.current) return;
      setMessages((current) => [
        ...current.filter((message) => message.id !== localId),
        result.userMessage,
        result.assistantMessage,
      ]);
      setConversationId(result.conversation.id);
      setTitle(result.conversation.title);
      setUsage(result.usage);
    } catch (error) {
      if (!mountedRef.current) return;
      setMessages((current) => current.filter((message) => message.id !== localId));
      setDraft((current) => current || content);

      const code = error instanceof MentorApiError ? error.code : null;
      if (code === 'MENTOR_CONSENT_REQUIRED') {
        router.replace('/tools/mentor');
        return;
      }
      if (code === 'MENTOR_CONVERSATION_NOT_FOUND') {
        setBlocked(true);
        setBanner({ text: userMessageFor(error), action: { label: 'Zurück', onPress: handleBack } });
        return;
      }
      if (code === 'MENTOR_DAILY_LIMIT_REACHED') {
        setBanner({ text: userMessageFor(error) });
        return;
      }
      setBanner({ text: userMessageFor(error), action: { label: 'Nochmal', onPress: () => send(content) } });
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [blocked, conversationId, handleBack, router, sending]);

  // Inverted list: newest message first.
  const listData = useMemo(() => [...messages].reverse(), [messages]);
  const showStarters = !initialConversationId && messages.length === 0 && !sending;

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.softGold} />
        </View>
      );
    }

    if (loadError) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{loadError}</Text>
          <AppButton title="Erneut versuchen" onPress={loadInitial} />
        </View>
      );
    }

    if (showStarters) {
      return (
        <View style={[styles.chatFlex, styles.starterWrap]}>
          <Text style={styles.starterTitle}>Woran arbeitest du gerade?</Text>
          <Text style={styles.starterSubtitle}>
            Erzähl deinem Mentor von deinen Zielen. Oder starte mit einer dieser Fragen:
          </Text>
          {STARTER_PROMPTS.map((prompt) => (
            <Pressable key={prompt} style={styles.starterChip} onPress={() => send(prompt)}>
              <Text style={styles.starterChipText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>
      );
    }

    return (
      <FlatList
        style={styles.chatFlex}
        data={listData}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MentorMessageBubble message={item} />}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={sending ? (
          <View style={styles.thinkingRow}>
            <ActivityIndicator size="small" color={COLORS.softGold} />
            <Text style={styles.thinkingText}>Dein Mentor denkt nach…</Text>
          </View>
        ) : null}
        ListFooterComponent={loadingOlder ? <ActivityIndicator color={COLORS.softGold} /> : null}
      />
    );
  };

  return (
    <ScreenContainer style={styles.screen}>
      <MentorHeader backLabel="Mentor" onBack={handleBack} title={title} />
      <KeyboardAvoidingView
        style={styles.chatFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {renderContent()}

        <View style={keyboardVisible ? styles.composerAreaKeyboard : styles.composerArea}>
          {banner ? (
            <View style={styles.banner}>
              <Ionicons name="alert-circle-outline" size={s(16)} color={COLORS.errorLight} />
              <Text style={styles.bannerText}>{banner.text}</Text>
              {banner.action ? (
                <Text style={styles.bannerAction} onPress={banner.action.onPress}>{banner.action.label}</Text>
              ) : null}
            </View>
          ) : null}
          {usage && usage.remaining <= 5 ? (
            <Text style={styles.usageText}>Heute noch {usage.remaining} Nachrichten</Text>
          ) : null}
          <MentorComposer
            value={draft}
            onChangeText={setDraft}
            onSend={() => send(draft)}
            sending={sending}
            disabled={blocked || loading || Boolean(loadError)}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
