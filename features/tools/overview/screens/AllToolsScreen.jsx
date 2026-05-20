import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { tools } from '../../../../data/tools';
import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';

import ToolCard from '../components/ToolCard';
import { styles } from '../styles/toolsOverviewStyles';

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

export default function AllToolsScreen() {
  const activeTools = useMemo(() => getActiveTools(), []);

  const defaultOverviewToolIds = useMemo(
    () => activeTools.slice(0, 6).map((tool) => tool.id),
    [activeTools]
  );

  const [editing, setEditing] = useState(false);
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

  const handleSelectToolForReplacement = async (tool) => {
    if (!tool || tool.disabled || !tool.route) return;

    if (!editing) {
      router.push(tool.route);
      return;
    }

    const alreadyOnOverview = selectedIds.includes(tool.id);

    if (alreadyOnOverview) {
      Alert.alert(
        'Schon auf der Startseite',
        'Dieses Tool ist bereits auf deiner normalen Tools-Seite. Wähle ein anderes Tool aus, um es dort einzusetzen.'
      );
      return;
    }

    await setPendingReplacementToolId(tool.id);

    router.back();
  };

  const handleToolPress = (tool) => {
    handleSelectToolForReplacement(tool);
  };

  const handleLongPressTool = (tool) => {
    if (!tool || tool.disabled || !tool.route) return;
    setEditing(true);
  };

  const handleDone = () => {
    setEditing(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.allToolsTopBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
            <Text style={styles.backText}>Tools</Text>
          </Pressable>

          <Pressable
            onPress={editing ? handleDone : () => setEditing(true)}
            style={styles.allToolsEditButton}
            hitSlop={8}
          >
            <Feather
              name={editing ? 'check' : 'edit-2'}
              size={s(15)}
              color={COLORS.toolsGold}
            />
            <Text style={styles.allToolsEditText}>
              {editing ? 'Fertig' : 'Bearbeiten'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.allToolsContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.allToolsHeader}>
            <Text style={styles.title}>ALLE TOOLS</Text>

            <Text style={styles.sectionSubtitle}>
              {editing
                ? 'Wähle ein Tool aus, das du auf deiner Startseite einsetzen möchtest.'
                : 'Öffne ein Tool oder halte es gedrückt, um deine Startseite zu bearbeiten.'}
            </Text>
          </View>

          {editing && (
            <View style={styles.editPanel}>
              <Text style={styles.editPanelTitle}>Startseite bearbeiten</Text>

              <Text style={styles.editPanelText}>
                Tippe ein Tool an, das noch nicht auf deiner Startseite ist.
                Danach wählst du auf der Tools-Seite den Slot aus, der ersetzt werden soll.
              </Text>
            </View>
          )}

          <View style={styles.grid}>
            {tools.map((tool) => {
              const selected = selectedIds.includes(tool.id);

              return (
                <ToolCard
                  key={tool.id}
                  icon={tool.image ? undefined : renderToolIcon(tool)}
                  image={tool.image}
                  title={tool.title}
                  description={tool.description}
                  disabled={tool.disabled}
                  selected={selected}
                  editing={editing && !tool.disabled}
                  onPress={() => handleToolPress(tool)}
                  onLongPress={() => handleLongPressTool(tool)}
                />
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}