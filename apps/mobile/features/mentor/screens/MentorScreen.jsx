import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../../../components/ui/AppButton';
import PressableScale from '../../../components/ui/PressableScale';
import ScreenContainer from '../../../components/ui/ScreenContainer';
import { COLORS } from '../../../constants/colors';
import { s } from '../../../constants/layout';
import logger from '../../../lib/logger';
import MentorConsentView from '../components/MentorConsentView';
import MentorHeader from '../components/MentorHeader';
import MentorPlaceholder from '../components/MentorPlaceholder';
import MentorRenameModal from '../components/MentorRenameModal';
import {
  deleteMentorConversation,
  getMentorSettings,
  getMentorUsage,
  grantMentorConsent,
  isMentorApiEnabled,
  listMentorConversations,
  MentorApiError,
  renameMentorConversation,
} from '../services/mentorApi';
import { mentorStyles as styles } from '../styles/mentorStyles';

function userMessageFor(error) {
  return error instanceof MentorApiError
    ? error.userMessage
    : 'Etwas ist schiefgelaufen. Versuch es bitte noch einmal.';
}

function formatConversationDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (date.toDateString() === now.toDateString()) return `Heute, ${time}`;
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

function MentorHome() {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // loading | unavailable | error | consent | ready
  const [errorText, setErrorText] = useState('');
  const [conversations, setConversations] = useState([]);
  const [usage, setUsage] = useState(null);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameSaving, setRenameSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
    router.replace('/tools');
  };

  const loadConversations = useCallback(async () => {
    const [list, usageResult] = await Promise.all([
      listMentorConversations(),
      getMentorUsage().catch(() => null),
    ]);
    if (!mountedRef.current) return;
    setConversations(list.conversations);
    setUsage(usageResult);
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const settings = await getMentorSettings();
      if (!settings.hasConsent) {
        if (mountedRef.current) setStatus('consent');
        return;
      }
      await loadConversations();
      if (mountedRef.current) setStatus('ready');
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof MentorApiError && error.isUnavailable) {
        setStatus('unavailable');
        return;
      }
      logger.warn('[Mentor] Failed to load mentor home', error?.code);
      setErrorText(userMessageFor(error));
      setStatus('error');
    }
  }, [loadConversations]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh the list when returning from a chat.
  const statusRef = useRef(status);
  statusRef.current = status;
  useFocusEffect(
    useCallback(() => {
      if (statusRef.current === 'ready') {
        loadConversations().catch((error) => logger.warn('[Mentor] Refresh failed', error?.code));
      }
    }, [loadConversations]),
  );

  const handleAcceptConsent = async () => {
    setConsentSubmitting(true);
    setConsentError('');
    try {
      await grantMentorConsent();
      await loadConversations();
      if (mountedRef.current) setStatus('ready');
    } catch (error) {
      if (mountedRef.current) setConsentError(userMessageFor(error));
    } finally {
      if (mountedRef.current) setConsentSubmitting(false);
    }
  };

  const openChat = (conversationId) => {
    router.push(
      conversationId
        ? { pathname: '/tools/mentor-chat', params: { conversationId } }
        : '/tools/mentor-chat',
    );
  };

  const confirmDelete = (conversation) => {
    Alert.alert(
      'Chat löschen?',
      `„${conversation.title}“ und alle Nachrichten darin werden endgültig gelöscht.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMentorConversation(conversation.id);
              setConversations((current) => current.filter((item) => item.id !== conversation.id));
            } catch (error) {
              Alert.alert('Löschen fehlgeschlagen', userMessageFor(error));
            }
          },
        },
      ],
    );
  };

  const openOptions = (conversation) => {
    Alert.alert(conversation.title, undefined, [
      { text: 'Umbenennen', onPress: () => setRenameTarget(conversation) },
      { text: 'Löschen', style: 'destructive', onPress: () => confirmDelete(conversation) },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  };

  const handleRename = async (title) => {
    if (!renameTarget || !title) return;
    setRenameSaving(true);
    try {
      const updated = await renameMentorConversation(renameTarget.id, title);
      setConversations((current) => current.map((item) => (
        item.id === renameTarget.id ? { ...item, title: updated?.title ?? title } : item
      )));
      setRenameTarget(null);
    } catch (error) {
      Alert.alert('Umbenennen fehlgeschlagen', userMessageFor(error));
    } finally {
      setRenameSaving(false);
    }
  };

  if (status === 'unavailable') {
    return <MentorPlaceholder />;
  }

  const renderBody = () => {
    if (status === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.softGold} />
          <Text style={styles.loadingText}>KI Mentor wird geladen...</Text>
        </View>
      );
    }

    if (status === 'error') {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorText}</Text>
          <AppButton title="Erneut versuchen" onPress={load} />
        </View>
      );
    }

    if (status === 'consent') {
      return (
        <MentorConsentView
          onAccept={handleAcceptConsent}
          onOpenPrivacy={() => router.push('/tools/privacy')}
          submitting={consentSubmitting}
          error={consentError}
        />
      );
    }

    return (
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>KI MENTOR</Text>
              <Text style={styles.heroSubtitle}>
                Dein persönlicher Coach für Training, Gewohnheiten, Ziele und Business.
              </Text>
            </View>
            <PressableScale onPress={() => openChat(null)} style={styles.newChatButton} haptic="light">
              <Ionicons name="add" size={s(20)} color={COLORS.lightGold} />
              <Text style={styles.newChatText}>Neuer Chat</Text>
            </PressableScale>
            {conversations.length > 0 ? <Text style={styles.sectionLabel}>Deine Chats</Text> : null}
          </View>
        )}
        ListEmptyComponent={(
          <Text style={styles.emptyText}>
            Noch keine Chats. Starte deinen ersten Chat und erzähl deinem Mentor, woran du gerade arbeitest.
          </Text>
        )}
        ListFooterComponent={usage ? (
          <Text style={styles.usageText}>
            Heute noch {usage.remaining} von {usage.limit} Nachrichten
          </Text>
        ) : null}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openChat(item.id)}
            onLongPress={() => openOptions(item)}
            style={styles.conversationRow}
            accessibilityRole="button"
            accessibilityHint="Lange drücken zum Umbenennen oder Löschen"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={s(18)} color={COLORS.toolsGold} />
            <View style={styles.conversationTextWrap}>
              <Text style={styles.conversationTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.conversationMeta}>{formatConversationDate(item.lastMessageAt ?? item.createdAt)}</Text>
            </View>
            <Pressable onPress={() => openOptions(item)} hitSlop={10} style={styles.iconButton}>
              <Ionicons name="ellipsis-horizontal" size={s(18)} color={COLORS.toolsTextDim} />
            </Pressable>
          </Pressable>
        )}
      />
    );
  };

  return (
    <ScreenContainer style={styles.screen}>
      <MentorHeader
        backLabel="Tools"
        onBack={handleBack}
        right={status === 'ready' ? (
          <Pressable
            onPress={() => router.push('/tools/mentor-memory')}
            hitSlop={10}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Was der Mentor über mich weiß"
          >
            <Ionicons name="bulb-outline" size={s(22)} color={COLORS.softGold} />
          </Pressable>
        ) : null}
      />
      {renderBody()}
      <MentorRenameModal
        visible={Boolean(renameTarget)}
        initialTitle={renameTarget?.title}
        saving={renameSaving}
        onCancel={() => setRenameTarget(null)}
        onSave={handleRename}
      />
    </ScreenContainer>
  );
}

export default function MentorScreen() {
  // Feature flag off: keep the original placeholder untouched.
  if (!isMentorApiEnabled()) {
    return <MentorPlaceholder />;
  }
  return <MentorHome />;
}
