import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { groupTrainingV2Plans } from '../models/trainingV2ViewModel';
import { useTrainingV2ArchiveVisibility } from '../hooks/useTrainingV2ArchiveVisibility';
import { styles } from '../styles/trainingV2Styles';
import { TrainingV2PlanCard } from './TrainingV2PlanCard';

const sections = [
  ['active', 'Active'],
  ['scheduled', 'Scheduled'],
  ['draft', 'Drafts'],
];

export function TrainingV2PlanSections({ plans, onPlanPress }) {
  const groups = useMemo(() => groupTrainingV2Plans(plans), [plans]);
  const { archivesExpanded, toggleArchives } = useTrainingV2ArchiveVisibility();

  if (plans.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Noch keine Trainingspläne</Text>
        <Text style={styles.emptyText}>Sobald ein Plan vorhanden ist, erscheint er hier.</Text>
      </View>
    );
  }

  return (
    <>
      {sections.map(([status, label]) => groups[status].length > 0 && (
        <View key={status} style={styles.section}>
          <Text style={styles.sectionTitle}>{label}</Text>
          {groups[status].map((plan) => (
            <TrainingV2PlanCard key={plan.id} plan={plan} onPress={onPlanPress} />
          ))}
        </View>
      ))}
      {groups.archived.length > 0 ? (
        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            onPress={toggleArchives}
            style={styles.archiveToggle}
          >
            <Text style={styles.archiveToggleText}>Archiv ({groups.archived.length})</Text>
            <Text style={styles.archiveToggleText}>{archivesExpanded ? '−' : '+'}</Text>
          </Pressable>
          {archivesExpanded ? groups.archived.map((plan) => (
            <TrainingV2PlanCard key={plan.id} plan={plan} onPress={onPlanPress} />
          )) : null}
        </View>
      ) : null}
    </>
  );
}
