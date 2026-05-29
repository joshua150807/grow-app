import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { tools } from '../../../../data/tools';
import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';

import ToolCard from '../components/ToolCard';
import PressableScale from '../../../../components/ui/PressableScale';
import { allToolsStyles as styles } from '../styles/allToolsStyles';
import { useOnboarding } from '../../../onboarding/context/OnboardingContext';
import TourTarget from '../../../onboarding/components/TourTarget';

import {
  getSelectedOverviewToolIds,
  setPendingReplacementToolId,
} from '../services/toolPreferences';

function renderToolIcon(tool) {
  const iconColor = tool.disabled ? COLORS.toolsTextDim : COLORS.toolsGold;

  if (tool.type === 'Ionicons') {
    return <Ionicons name={tool.name} size={s(20)} color={iconColor} />;
  }

  if (tool.type === 'MaterialCommunityIcons') {
    return <MaterialCommunityIcons name={tool.name} size={s(20)} color={iconColor} />;
  }

  if (tool.type === 'Feather') {
    return <Feather name={tool.name} size={s(20)} color={iconColor} />;
  }

  return null;
}

function getActiveTools() {
  return tools.filter((tool) => !tool.disabled && tool.route);
}

function getAllToolsLayout(width) {
  const horizontalPadding = s(14);
  const gap = width < 370 ? s(7) : s(8);

  const contentWidth = width - horizontalPadding * 2;
  const cardSize = Math.floor((contentWidth - gap * 2) / 3);

  return {
    gap,
    cardSize,
  };
}

export default function AllToolsScreen() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
  const { currentStep, isTourActive } = useOnboarding();
  const layout = useMemo(() => getAllToolsLayout(width), [width]);

  const activeTools = useMemo(() => getActiveTools(), []);

  const defaultOverviewToolIds = useMemo(
    () => activeTools.slice(0, 6).map((tool) => tool.id),
    [activeTools]
  );

  const [selectedIds, setSelectedIds] = useState(defaultOverviewToolIds);

  useEffect(() => {
    let mounted = true;

    async function loadSelectedTools() {
      const savedIds = await getSelectedOverviewToolIds(defaultOverviewToolIds);

      const validIds = savedIds.filter((id) =>
        activeTools.some((tool) => tool.id === id)
      );

      if (mounted) {
        setSelectedIds(
          validIds.length > 0
            ? validIds.slice(0, 6)
            : defaultOverviewToolIds
        );
      }
    }

    loadSelectedTools();

    return () => {
      mounted = false;
    };
  }, [activeTools, defaultOverviewToolIds]);


  useEffect(() => {
    if (!isTourActive || !currentStep?.targetId?.startsWith('tool-')) return;

    const targetToolId = currentStep.targetId.replace('tool-', '');
    const targetIndex = tools.findIndex((tool) => tool.id === targetToolId);

    if (targetIndex < 0) return;

    const rowIndex = Math.floor(targetIndex / 3);
    const estimatedHeaderOffset = 120;
    const targetOffset = Math.max(
      0,
      estimatedHeaderOffset + rowIndex * (layout.cardSize + layout.gap) - 24
    );

    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: targetOffset, animated: true });
    }, 120);

    return () => clearTimeout(timer);
  }, [currentStep?.targetId, isTourActive, layout.cardSize, layout.gap]);

  const handleToolPress = (tool) => {
    if (!tool || tool.disabled || !tool.route) return;
    router.push(tool.route);
  };

  const handleLongPressTool = async (tool) => {
    if (!tool || tool.disabled || !tool.route) return;

    const alreadyOnOverview = selectedIds.includes(tool.id);

    if (alreadyOnOverview) {
      Alert.alert(
        'Schon auf der Startseite',
        'Dieses Tool ist bereits auf deiner 2x3-Tools-Seite. Halte ein anderes Tool gedrückt, um es dort einzusetzen.'
      );
      return;
    }

    await setPendingReplacementToolId(tool.id);
    router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.allToolsTopBar}>
          <PressableScale
            onPress={() => router.back()}
            style={styles.backButton}
            activeScale={0.96}
            activeOpacity={0.78}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
            <Text style={styles.backText}>Tools</Text>
          </PressableScale>

          <View style={styles.allToolsEditButton} pointerEvents="none">
            <Feather name="move" size={s(15)} color={COLORS.toolsGold} />
            <Text style={styles.allToolsEditText}>Halten</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.allToolsContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.allToolsHeader}>
            <Text style={styles.title}>ALLE TOOLS</Text>

            <Text style={styles.sectionSubtitle}>
              Tippe ein Tool an, um es zu öffnen. Halte ein Tool gedrückt, um es auf deiner 2x3-Tools-Seite per Drag-and-Drop zu ersetzen.
            </Text>
          </View>

          <View
            style={[
              styles.grid,
              {
                columnGap: layout.gap,
                rowGap: layout.gap,
              },
            ]}
          >
            {tools.map((tool) => {
              const selected = selectedIds.includes(tool.id);

              return (
                <TourTarget
                  key={tool.id}
                  id={`tool-${tool.id}`}
                  style={[
                    styles.cardSlot,
                    {
                      width: layout.cardSize,
                      height: layout.cardSize,
                    },
                  ]}
                >
                  <ToolCard
                    icon={tool.image ? undefined : renderToolIcon(tool)}
                    image={tool.image}
                    title={tool.title}
                    description={tool.description}
                    disabled={tool.disabled}
                    selected={selected}
                    editing={false}
                    onPress={() => handleToolPress(tool)}
                    onLongPress={() => handleLongPressTool(tool)}
                    cardStyle={{
                      width: '100%',
                      height: '100%',
                    }}
                  />
                </TourTarget>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}