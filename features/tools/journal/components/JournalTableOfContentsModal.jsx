import { View, Text, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';
import { JOURNAL_STARTER_PAGES } from '../utils/journalUtils';
import { styles } from '../styles/journalStyles';

export default function JournalTableOfContentsModal({
  visible,
  onClose,
  starterEntriesByKey,
  openPage,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.tocModal}>
          <View style={styles.tocHeaderRow}>
            <View>
              <Text style={styles.tocTitle}>Inhaltsverzeichnis</Text>
              <Text style={styles.tocSubtitle}>Springe direkt zu einer Journal-Frage.</Text>
            </View>
            <PressableScale onPress={onClose} hitSlop={s(8)} activeScale={0.94}>
              <Ionicons name="close" size={s(24)} color={COLORS.textDim} />
            </PressableScale>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tocContent}>
            <Text style={styles.tocSectionLabel}>JOURNAL-FRAGEN</Text>
            {JOURNAL_STARTER_PAGES.map((page, index) => {
              const hasAnswer = Boolean(starterEntriesByKey[page.key]?.answer);
              const showFutureDivider = index === 5;

              return (
                <View key={page.key}>
                  {showFutureDivider ? (
                    <View style={styles.tocSectionBreak}>
                      <Text style={styles.tocSectionLabel}>ZUKUNFTS-FRAGEN</Text>
                      <Text style={styles.tocSectionIntro}>
                        Halte fest, wo du dich kurz-, mittel- und langfristig siehst.
                      </Text>
                    </View>
                  ) : null}

                  <PressableScale
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
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
