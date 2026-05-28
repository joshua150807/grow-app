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
  Keyboard,
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
import PressableScale from '../../../../components/ui/PressableScale';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';

const TITLE_PASTE_LIMIT = 70;

function createTitleFromLongText(text) {
  const cleanText = String(text ?? '').replace(/\s+/g, ' ').trim();

  if (cleanText.length <= TITLE_PASTE_LIMIT) {
    return cleanText;
  }

  return `${cleanText.slice(0, TITLE_PASTE_LIMIT).trim()}...`;
}

function splitNoteText(value) {
  const plain = getPlainNoteBody(value || '').replace(/\r\n/g, '\n');

  if (!plain.trim()) {
    return {
      title: '',
      body: '',
    };
  }

  const lines = plain.split('\n');

  // Normaler sauber gespeicherter Fall:
  // erste Zeile = Titel, Rest = Inhalt
  if (lines.length > 1) {
    const title = lines[0] ?? '';

    const body = lines
      .slice(1)
      .join('\n')
      .replace(/^\n+/, '');

    return {
      title,
      body,
    };
  }

  // Beta-Fix:
  // Falls eine alte/kaputte Notiz als eine riesige einzelne Zeile gespeichert wurde,
  // darf sie beim erneuten Öffnen nicht komplett im Titel landen.
  if (plain.length > TITLE_PASTE_LIMIT) {
    return {
      title: createTitleFromLongText(plain),
      body: plain,
    };
  }

  return {
    title: plain,
    body: '',
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

function splitPastedTextForEmptyNote(text) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n');

  if (!normalized.trim()) {
    return {
      title: '',
      body: '',
      shouldMoveToBody: false,
    };
  }

  const hasLineBreak = normalized.includes('\n');

  if (hasLineBreak) {
    const lines = normalized.split('\n');
    const firstNonEmptyLineIndex = lines.findIndex((line) => line.trim().length > 0);

    if (firstNonEmptyLineIndex === -1) {
      return {
        title: '',
        body: '',
        shouldMoveToBody: false,
      };
    }

    const title = lines[firstNonEmptyLineIndex].trim();
    const body = lines
      .slice(firstNonEmptyLineIndex + 1)
      .join('\n')
      .replace(/^\n+/, '');

    return {
      title,
      body,
      shouldMoveToBody: body.trim().length > 0,
    };
  }

  if (normalized.length > TITLE_PASTE_LIMIT) {
    return {
      title: createTitleFromLongText(normalized),
      body: normalized,
      shouldMoveToBody: true,
    };
  }

  return {
    title: normalized,
    body: '',
    shouldMoveToBody: false,
  };
}

export default function NoteEditorScreen({ noteId }) {
  const titleInputRef = useRef(null);
  const bodyInputRef = useRef(null);
  const previousBodyRef = useRef('');

  const [menuOpen, setMenuOpen] = useState(false);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const isNewNote = !noteId || noteId === 'new';

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

  const showLoading = useDelayedLoading(loading);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setActiveField(null);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (loading || hydrated) return;

    const parsed = splitNoteText(body);

    setEditorTitle(parsed.title);
    setEditorBody(parsed.body);
    previousBodyRef.current = parsed.body;
    setHydrated(true);
  }, [body, loading, hydrated]);

  const syncNote = useCallback(
    (nextTitle, nextBody) => {
      updateBody(combineNoteText(nextTitle, nextBody));
    },
    [updateBody]
  );

  const activateField = useCallback((field) => {
    setMenuOpen(false);
    setActiveField(field);

    requestAnimationFrame(() => {
      const inputRef = field === 'title' ? titleInputRef : bodyInputRef;

      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
    });
  }, []);

  useEffect(() => {
    if (!isNewNote || loading || !hydrated) return;

    const timer = setTimeout(() => {
      activateField('title');
    }, 300);

    return () => clearTimeout(timer);
  }, [isNewNote, loading, hydrated, activateField]);

  const focusTitleAtEnd = useCallback(() => {
    setActiveField('title');

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
      const isEmptyEditor =
        !editorTitle.trim() &&
        !editorBody.trim();

      const looksLikePaste =
        text.includes('\n') ||
        text.length > TITLE_PASTE_LIMIT;

      if (isEmptyEditor && looksLikePaste) {
        const parsedPaste = splitPastedTextForEmptyNote(text);

        setEditorTitle(parsedPaste.title);
        setEditorBody(parsedPaste.body);
        previousBodyRef.current = parsedPaste.body;
        syncNote(parsedPaste.title, parsedPaste.body);

        if (parsedPaste.shouldMoveToBody) {
          setActiveField('body');

          requestAnimationFrame(() => {
            setTimeout(() => {
              bodyInputRef.current?.focus();
            }, 0);
          });
        }

        return;
      }

      if (text.includes('\n')) {
        const normalized = text.replace(/\r\n/g, '\n');
        const lines = normalized.split('\n');

        const cleanTitle = lines[0].trim();
        const pastedBody = lines.slice(1).join('\n').replace(/^\n+/, '');

        const nextBody = editorBody.trim()
          ? `${pastedBody}\n\n${editorBody}`.trim()
          : pastedBody;

        setEditorTitle(cleanTitle);
        setEditorBody(nextBody);
        previousBodyRef.current = nextBody;
        syncNote(cleanTitle, nextBody);

        if (pastedBody.trim()) {
          setActiveField('body');

          requestAnimationFrame(() => {
            setTimeout(() => {
              bodyInputRef.current?.focus();
            }, 0);
          });
        }

        return;
      }

      const cleanTitle = text.replace(/\n/g, '');

      setEditorTitle(cleanTitle);
      syncNote(cleanTitle, editorBody);
    },
    [editorTitle, editorBody, syncNote]
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
    setMenuOpen(false);

    try {
      await flushSave();
    } catch (saveError) {}

    router.back();
  }, [flushSave]);

  const handleDone = useCallback(async () => {
    setMenuOpen(false);

    if (keyboardVisible || activeField) {
      Keyboard.dismiss();
      setActiveField(null);
      return;
    }

    try {
      await flushSave();
    } catch (saveError) {}

    router.back();
  }, [keyboardVisible, activeField, flushSave]);

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

  const renderTitleField = () => {
    return (
      <TextInput
        ref={titleInputRef}
        value={editorTitle}
        onChangeText={handleTitleChange}
        onFocus={() => {
          setMenuOpen(false);
          setActiveField('title');
        }}
        onBlur={() => {
          setActiveField((current) => (current === 'title' ? null : current));
        }}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => activateField('body')}
        placeholder="Titel"
        placeholderTextColor="rgba(255,241,210,0.28)"
        style={styles.noteTitleInput}
        autoFocus={isNewNote && activeField === 'title'}
      />
    );
  };

  const renderBodyField = () => {
    return (
      <TextInput
        ref={bodyInputRef}
        value={editorBody}
        onChangeText={handleBodyChange}
        onFocus={() => {
          setMenuOpen(false);
          setActiveField('body');
        }}
        onBlur={() => {
          setActiveField((current) => (current === 'body' ? null : current));
        }}
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === 'Backspace' && editorBody.length === 0) {
            focusTitleAtEnd();
          }
        }}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
        placeholder="Notiz"
        placeholderTextColor="rgba(255,241,210,0.28)"
        style={styles.noteBodyInput}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.topBar}>
        <PressableScale onPress={handleBack} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Notizen</Text>
        </PressableScale>

        <View style={styles.topActions}>
          {saving ? <Text style={styles.savingText}>Speichert...</Text> : null}

          <PressableScale
            onPress={() => {
              Keyboard.dismiss();
              setActiveField(null);
              setMenuOpen((previous) => !previous);
            }}
            style={styles.iconButton}
            hitSlop={8}
            activeScale={0.94}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={s(20)}
              color={COLORS.softGold}
            />
          </PressableScale>

          <PressableScale onPress={handleDone} hitSlop={8} activeScale={0.96}>
            <Text style={styles.doneText}>Fertig</Text>
          </PressableScale>
        </View>
      </View>

      {menuOpen ? (
        <>
          <Pressable
            style={styles.editorMenuBackdrop}
            onPress={() => setMenuOpen(false)}
          />

          <View style={styles.editorMenu}>
            <PressableScale
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
            </PressableScale>
          </View>
        </>
      ) : null}

      {showLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.toolsGold ?? COLORS.gold} />
        </View>
      ) : !loading ? (
        <ScrollView
          style={styles.editorScroll}
          contentContainerStyle={styles.editorContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
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

          {renderTitleField()}
          {renderBodyField()}
        </ScrollView>
      ) : null}
    </KeyboardAvoidingView>
  );
}