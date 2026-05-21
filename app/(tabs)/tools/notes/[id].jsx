import { useLocalSearchParams } from 'expo-router';

import NoteEditorScreen from '../../../../features/tools/notes/screens/NoteEditorScreen';

export default function ExistingNoteRoute() {
  const { id } = useLocalSearchParams();

  return <NoteEditorScreen noteId={id} />;
}