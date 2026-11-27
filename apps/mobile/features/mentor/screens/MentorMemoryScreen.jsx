import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../../../components/ui/AppButton';
import ScreenContainer from '../../../components/ui/ScreenContainer';
import { COLORS } from '../../../constants/colors';
import { s } from '../../../constants/layout';
import logger from '../../../lib/logger';
import MentorHeader from '../components/MentorHeader';
import MentorRenameModal from '../components/MentorRenameModal';
import {
  deleteAllMentorMemories,
  deleteMentorMemory,
  getMentorSettings,
  isMentorApiEnabled,
  listMentorMemories,
  MentorApiError,
  updateMentorMemory,
  updateMentorSettings,
} from '../services/mentorApi';
import { groupMentorMemories } from '../services/mentorNormalizers';
import { mentorStyles as styles } from '../styles/mentorStyles';

const MEMORY_MAX_LENGTH = 300;

function userMessageFor(error) {
  return error instanceof MentorApiError
    ? error.userMessage
    : 'Etwas ist schiefgelaufen. Versuch es bitte noch einmal.';
}

export default function MentorMemoryScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [errorText, setErrorText] = useState('');
  const [memories, setMemories] = useState([]);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [togglePending, setTogglePending] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
    router.replace('/tools/mentor');
  }, [router]);

  const load = useCallback(async () => {
    if (!isMentorApiEnabled()) {
      router.replace('/tools/mentor');
      return;
    }
    setStatus('loading');
    try {
      const [settings, list] = await Promise.all([getMentorSettings(), listMentorMemories()]);
      if (!mountedRef.current) return;
      setMemoryEnabled(settings.memoryEnabled);
      setMemories(list);
      setStatus('ready');
    } catch (error) {
      if (!mountedRef.current) return;
      logger.warn('[Mentor] Failed to load memories', error?.code);
      setErrorText(userMessageFor(error));
      setStatus('error');
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => groupMentorMemories(memories), [memories]);

  const replaceMemory = (updated) => {
    if (!updated) return;
    setMemories((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleToggle = async (value) => {
    setTogglePending(true);
    setMemoryEnabled(value);
    try {
      const settings = await updateMentorSettings({ memoryEnabled: value });
      if (mountedRef.current) setMemoryEnabled(settings.memoryEnabled);
    } catch (error) {
      if (mountedRef.current) setMemoryEnabled(!value);
      Alert.alert('Einstellung nicht gespeichert', userMessageFor(error));
    } finally {
      if (mountedRef.current) setTogglePending(false);
    }
  };

  const setMemoryStatus = async (memory, nextStatus) => {
    try {
      replaceMemory(await updateMentorMemory(memory.id, { status: nextStatus }));
    } catch (error) {
      Alert.alert('Änderung fehlgeschlagen', userMessageFor(error));
    }
  };

  const confirmDelete = (memory) => {
    Alert.alert('Eintrag löschen?', memory.content, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMentorMemory(memory.id);
            setMemories((current) => current.filter((item) => item.id !== memory.id));
          } catch (error) {
            Alert.alert('Löschen fehlgeschlagen', userMessageFor(error));
          }
        },
      },
    ]);
  };

  const openOptions = (memory) => {
    Alert.alert('Eintrag', memory.content, [
      { text: 'Bearbeiten', onPress: () => setEditTarget(memory) },
      memory.status === 'active'
        ? { text: 'Als vergangen markieren', onPress: () => setMemoryStatus(memory, 'resolved') }
        : { text: 'Wieder als aktuell markieren', onPress: () => setMemoryStatus(memory, 'active') },
      { text: 'Löschen', style: 'destructive', onPress: () => confirmDelete(memory) },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  };

  const handleEditSave = async (content) => {
    if (!editTarget || !content) return;
    setEditSaving(true);
    try {
      replaceMemory(await updateMentorMemory(editTarget.id, { content }));
      setEditTarget(null);
    } catch (error) {
      Alert.alert('Speichern fehlgeschlagen', userMessageFor(error));
    } finally {
      if (mountedRef.current) setEditSaving(false);
    }
  };

  const confirmDeleteAll = () => {
    Alert.alert(
      'Alles vergessen?',
      'Der Mentor vergisst alle Einträge. Deine Chats bleiben erhalten.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Alles löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllMentorMemories();
              setMemories([]);
            } catch (error) {
              Alert.alert('Löschen fehlgeschlagen', userMessageFor(error));
            }
          },
        },
      ],
    );
  };

  const renderBody = () => {
    if (status === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.softGold} />
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

    return (
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={(
          <View>
            <Text style={styles.memoryIntro}>
              Damit dein Mentor dich wirklich kennt, merkt er sich wichtige Dinge aus euren Chats,
              zum Beispiel Ziele oder Verletzungen. Du kannst alles bearbeiten oder löschen.
            </Text>
            <View style={styles.memoryToggleRow}>
              <View style={styles.memoryToggleTextWrap}>
                <Text style={styles.memoryToggleTitle}>Gedächtnis</Text>
                <Text style={styles.memoryToggleHint}>
                  {memoryEnabled ? 'Der Mentor merkt sich Neues und nutzt diese Einträge.' : 'Aus: nichts Neues wird gemerkt oder genutzt.'}
                </Text>
              </View>
              <Switch
                value={memoryEnabled}
                onValueChange={handleToggle}
                disabled={togglePending}
                trackColor={{ true: COLORS.mutedGold, false: COLORS.borderMid }}
                thumbColor={memoryEnabled ? COLORS.gold : COLORS.textDim}
                accessibilityLabel="Gedächtnis des Mentors"
              />
            </View>
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles.memorySectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openOptions(item)}
            style={[styles.memoryRow, item.status === 'resolved' && styles.memoryRowResolved]}
            accessibilityRole="button"
            accessibilityHint="Bearbeiten, als vergangen markieren oder löschen"
          >
            <View style={styles.memoryTextWrap}>
              <Text style={styles.memoryText}>{item.content}</Text>
              {item.status === 'resolved' ? <Text style={styles.memoryBadge}>Vergangen</Text> : null}
            </View>
            <Ionicons name="ellipsis-horizontal" size={s(18)} color={COLORS.toolsTextDim} />
          </Pressable>
        )}
        ListEmptyComponent={(
          <Text style={styles.emptyText}>
            Noch keine Einträge. Erzähl deinem Mentor von deinen Zielen, deinem Training oder deinem Business.
          </Text>
        )}
        ListFooterComponent={memories.length > 0 ? (
          <Pressable onPress={confirmDeleteAll} style={styles.deleteAllButton} accessibilityRole="button">
            <Text style={styles.deleteAllText}>Alles vergessen</Text>
          </Pressable>
        ) : null}
      />
    );
  };

  return (
    <ScreenContainer style={styles.screen}>
      <MentorHeader backLabel="Mentor" onBack={handleBack} title="Was der Mentor weiß" />
      {renderBody()}
      <MentorRenameModal
        visible={Boolean(editTarget)}
        initialTitle={editTarget?.content}
        saving={editSaving}
        onCancel={() => setEditTarget(null)}
        onSave={handleEditSave}
        heading="Eintrag bearbeiten"
        placeholder="Was soll sich der Mentor merken?"
        maxLength={MEMORY_MAX_LENGTH}
        multiline
      />
    </ScreenContainer>
  );
}
