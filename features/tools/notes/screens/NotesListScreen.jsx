import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';

import { useNotes } from '../hooks/useNotes';
import {
  formatNoteListDate,
  getNotePreview,
  getNoteTitle,
} from '../utils/noteTextUtils';
import { styles } from '../styles/notesStyles';

export default function NotesListScreen() {
  const {
    notes,
    loading,
    loadError,
    actionError,
    setActionError,
    loadNotes,
    removeNote,
    togglePinned,
  } = useNotes();

  const handleOpenNote = (note) => {
    router.push(`/tools/notes/${note.id}`);
  };

  const handleCreateNote = () => {
    router.push('/tools/notes/new');
  };

  const confirmDelete = (note) => {
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
          onPress: () => removeNote(note.id),
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </Pressable>

        <Pressable onPress={handleCreateNote} style={styles.iconButton} hitSlop={8}>
          <Ionicons name="add" size={s(23)} color={COLORS.softGold} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Notizen</Text>
          <Text style={styles.listSubtitle}>
            {notes.length} {notes.length === 1 ? 'Notiz' : 'Notizen'}
          </Text>
        </View>

        <View style={styles.searchFake}>
          <Ionicons name="search" size={s(15)} color="rgba(255,241,210,0.38)" />
          <Text style={styles.searchFakeText}>Suchen</Text>
        </View>

        {loadError ? (
          <Pressable onPress={loadNotes} style={styles.errorBanner}>
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

            <Pressable onPress={() => setActionError(null)} hitSlop={8}>
              <Ionicons name="close" size={s(16)} color="rgba(255,241,210,0.45)" />
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.toolsGold ?? COLORS.gold} />
          </View>
        ) : notes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="document-text-outline"
              size={s(44)}
              color="rgba(255,241,210,0.38)"
            />

            <Text style={styles.emptyTitle}>Keine Notizen</Text>

            <Text style={styles.emptyText}>
              Tippe oben rechts auf Plus, um deine erste Notiz zu erstellen.
            </Text>
          </View>
        ) : (
          <View style={styles.notesList}>
            {notes.map((note, index) => {
              const isLast = index === notes.length - 1;

              return (
                <View key={note.id}>
                  <Pressable
                    onPress={() => handleOpenNote(note)}
                    onLongPress={() => {
                      Alert.alert(
                        getNoteTitle(note.body),
                        'Was möchtest du tun?',
                        [
                          {
                            text: note.pinned ? 'Nicht mehr anpinnen' : 'Anpinnen',
                            onPress: () => togglePinned(note),
                          },
                          {
                            text: 'Löschen',
                            style: 'destructive',
                            onPress: () => confirmDelete(note),
                          },
                          {
                            text: 'Abbrechen',
                            style: 'cancel',
                          },
                        ]
                      );
                    }}
                    style={({ pressed }) => [
                      styles.noteRow,
                      pressed && styles.noteRowPressed,
                    ]}
                  >
                    <View style={styles.noteRowTop}>
                      <Text style={styles.noteTitle} numberOfLines={1}>
                        {getNoteTitle(note.body)}
                      </Text>

                      <Text style={styles.noteDate}>
                        {formatNoteListDate(note.updated_at)}
                      </Text>
                    </View>

                    <Text style={styles.notePreview} numberOfLines={2}>
                      {getNotePreview(note.body) || 'Keine weiteren Inhalte'}
                    </Text>

                    {note.pinned ? (
                      <View style={styles.pinnedBadge}>
                        <Ionicons
                          name="pin"
                          size={s(11)}
                          color={COLORS.toolsGold ?? COLORS.gold}
                        />
                        <Text style={styles.pinnedText}>Angepinnt</Text>
                      </View>
                    ) : null}
                  </Pressable>

                  {!isLast ? <View style={styles.noteDivider} /> : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}