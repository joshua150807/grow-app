import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';

import { useNoteEditor } from '../hooks/useNoteEditor';
import {
  formatEditorDate,
  getPlainNoteBody,
  isEmptyNote,
} from '../utils/noteTextUtils';
import { styles } from '../styles/notesStyles';

function splitNoteText(value) {
  const plain = getPlainNoteBody(value || '').replace(/\r\n/g, '\n');

  if (!plain) {
    return {
      title: '',
      body: '',
    };
  }

  const lines = plain.split('\n');
  const title = lines[0] ?? '';

  const body = lines
    .slice(1)
    .join('\n')
    .replace(/^\n/, '');

  return {
    title,
    body,
  };
}

function combineNoteText(title, body) {
  const cleanTitle = title ?? '';
  const cleanBody = body ?? '';

  if (!cleanTitle.trim() && !cleanBody.trim()) {
    return '';
  }

  if (!cleanBody) {
    return cleanTitle;
  }

  if (!cleanTitle) {
    return cleanBody;
  }

  return `${cleanTitle}\n\n${cleanBody}`;
}

export default function NoteEditorScreen({ noteId }) {
  const titleInputRef = useRef(null);
  const bodyInputRef = useRef(null);
  const previousBodyRef = useRef('');

  const [menuOpen, setMenuOpen] = useState(false);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const {
    noteId: localNoteId,
    body,
    noteMeta,
    loading,
    saving,
    error,
    updateBody,
    flushSave,
    removeCurrentNote,
  } = useNoteEditor(noteId);

  useEffect(() => {
    if (loading || hydrated) return;

    const parsed = splitNoteText(body);

    setEditorTitle(parsed.title);
    setEditorBody(parsed.body);
    previousBodyRef.current = parsed.body;
    setHydrated(true);
  }, [body, loading, hydrated]);

  useEffect(() => {
    if (noteId || loading || !hydrated) return;

    const timer = setTimeout(() => {
      titleInputRef.current?.focus();
    }, 250);

    return () => clearTimeout(timer);
  }, [noteId, loading, hydrated]);

  const syncNote = useCallback(
    (nextTitle, nextBody) => {
      updateBody(combineNoteText(nextTitle, nextBody));
    },
    [updateBody]
  );

  const focusTitleAtEnd = useCallback(() => {
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();

      setTimeout(() => {
        titleInputRef.current?.setNativeProps?.({
          selection: {
            start: editorTitle.length,
            end: editorTitle.length,
          },
        });
      }, 0);
    });
  }, [editorTitle.length]);

  const handleTitleChange = useCallback(
    (text) => {
      const cleanTitle = text.replace(/\n/g, '');

      setEditorTitle(cleanTitle);
      syncNote(cleanTitle, editorBody);
    },
    [editorBody, syncNote]
  );

  const handleBodyChange = useCallback(
    (text) => {
      const previousBody = previousBodyRef.current;
      const bodyWasDeletedToEmpty = previousBody.length > 0 && text.length === 0;

      previousBodyRef.current = text;

      setEditorBody(text);
      syncNote(editorTitle, text);

      if (bodyWasDeletedToEmpty) {
        focusTitleAtEnd();
      }
    },
    [editorTitle, syncNote, focusTitleAtEnd]
  );

  const handleBack = useCallback(async () => {
    try {
      await flushSave();
    } catch (saveError) {}

    router.back();
  }, [flushSave]);

  const handleDone = useCallback(async () => {
    try {
      await flushSave();
    } catch (saveError) {}

    router.back();
  }, [flushSave]);

  const handleDelete = useCallback(() => {
    const combined = combineNoteText(editorTitle, editorBody);

    if (!localNoteId && isEmptyNote(combined)) {
      router.back();
      return;
    }

    Alert.alert(
      'Notiz löschen?',
      'Diese Notiz wird dauerhaft gelöscht.',
      [
        {
          text: 'Abbrechen',
          style: 'cancel',
        },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCurrentNote();
              router.back();
            } catch (deleteError) {
              Alert.alert('Fehler', 'Notiz konnte nicht gelöscht werden.');
            }
          },
        },
      ]
    );
  }, [editorTitle, editorBody, localNoteId, removeCurrentNote]);

  const editorDate = formatEditorDate(noteMeta?.updated_at || noteMeta?.created_at);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Notizen</Text>
        </Pressable>

        <View style={styles.topActions}>
          {saving ? <Text style={styles.savingText}>Speichert...</Text> : null}

          <Pressable
            onPress={() => setMenuOpen((previous) => !previous)}
            style={styles.iconButton}
            hitSlop={8}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={s(20)}
              color={COLORS.softGold}
            />
          </Pressable>

          <Pressable onPress={handleDone} hitSlop={8}>
            <Text style={styles.doneText}>Fertig</Text>
          </Pressable>
        </View>
      </View>

      {menuOpen ? (
        <View style={styles.editorMenu}>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              handleDelete();
            }}
          >
            <Ionicons
              name="trash-outline"
              size={s(18)}
              color={COLORS.errorLight}
            />
            <Text style={styles.menuDangerText}>Notiz löschen</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.toolsGold ?? COLORS.gold} />
        </View>
      ) : (
        <ScrollView
          style={styles.editorScroll}
          contentContainerStyle={styles.editorContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {editorDate ? (
            <Text style={styles.editorDate}>{editorDate}</Text>
          ) : (
            <Text style={styles.editorDate}>Neue Notiz</Text>
          )}

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={s(18)}
                color={COLORS.errorLight}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            ref={titleInputRef}
            value={editorTitle}
            onChangeText={handleTitleChange}
            autoFocus={!noteId}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              bodyInputRef.current?.focus();
            }}
            style={styles.noteTitleInput}
          />

          <TextInput
            ref={bodyInputRef}
            value={editorBody}
            onChangeText={handleBodyChange}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && editorBody.length === 0) {
                focusTitleAtEnd();
              }
            }}
            multiline
            textAlignVertical="top"
            style={styles.noteBodyInput}
          />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}