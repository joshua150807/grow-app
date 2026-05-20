import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';

import { s, sv } from '../../../../constants/layout';
import ToolCard from './ToolCard';

const LONG_PRESS_MS = 280;
const MOVE_CANCEL_DISTANCE = 18;

function getDropIndex(x, y, positions, cardSize) {
  return positions.findIndex((position) => {
    const insideX = x >= position.x && x <= position.x + cardSize;
    const insideY = y >= position.y && y <= position.y + cardSize;

    return insideX && insideY;
  });
}

function swapItems(list, fromIndex, toIndex) {
  if (fromIndex === toIndex) return list;

  const next = [...list];
  const temp = next[fromIndex];

  next[fromIndex] = next[toIndex];
  next[toIndex] = temp;

  return next;
}

function DraggableTile({
  item,
  index,
  position,
  cardSize,
  isHidden,
  renderToolIcon,
  onPressTool,
  onStartDrag,
  onMoveDrag,
  onEndDrag,
  onCancelDrag,
}) {
  const longPressTimerRef = useRef(null);
  const dragActiveRef = useRef(false);
  const touchStartedRef = useRef(false);

  const itemRef = useRef(item);
  const indexRef = useRef(index);
  const startTouchRef = useRef({ x: cardSize / 2, y: cardSize / 2 });

  itemRef.current = item;
  indexRef.current = index;

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (event) => {
        touchStartedRef.current = true;
        dragActiveRef.current = false;

        startTouchRef.current = {
          x: event.nativeEvent.locationX,
          y: event.nativeEvent.locationY,
        };

        clearLongPressTimer();

        longPressTimerRef.current = setTimeout(() => {
          if (!touchStartedRef.current) return;

          dragActiveRef.current = true;

          onStartDrag(
            indexRef.current,
            itemRef.current,
            startTouchRef.current
          );
        }, LONG_PRESS_MS);
      },

      onPanResponderMove: (_, gestureState) => {
        const movedTooEarly =
          Math.abs(gestureState.dx) > MOVE_CANCEL_DISTANCE ||
          Math.abs(gestureState.dy) > MOVE_CANCEL_DISTANCE;

        if (!dragActiveRef.current && movedTooEarly) {
          clearLongPressTimer();
          return;
        }

        if (dragActiveRef.current) {
          onMoveDrag(
            itemRef.current.id,
            gestureState.dx,
            gestureState.dy
          );
        }
      },

      onPanResponderRelease: (_, gestureState) => {
        touchStartedRef.current = false;
        clearLongPressTimer();

        if (dragActiveRef.current) {
          dragActiveRef.current = false;

          onEndDrag(
            itemRef.current.id,
            gestureState.dx,
            gestureState.dy
          );

          return;
        }

        const wasTap =
          Math.abs(gestureState.dx) <= MOVE_CANCEL_DISTANCE &&
          Math.abs(gestureState.dy) <= MOVE_CANCEL_DISTANCE;

        if (wasTap) {
          onPressTool(itemRef.current);
        }
      },

      onPanResponderTerminate: () => {
        touchStartedRef.current = false;
        clearLongPressTimer();

        if (dragActiveRef.current) {
          dragActiveRef.current = false;
          onCancelDrag();
        }
      },
    })
  ).current;

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.slot,
        {
          width: cardSize,
          height: cardSize,
          left: position.x,
          top: position.y,
          opacity: isHidden ? 0.12 : 1,
        },
      ]}
    >
      <ToolCard
        icon={item.image ? undefined : renderToolIcon(item)}
        image={item.image}
        title={item.title}
        description={item.description}
        disabled={item.disabled}
        selected={false}
        editing={false}
        onPress={() => {}}
        onLongPress={() => {}}
        cardStyle={styles.card}
      />
    </View>
  );
}

export default function DraggableSixToolGrid({
  tools,
  renderToolIcon,
  onPressTool,
  onReorder,
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [displayTools, setDisplayTools] = useState(tools);
  const [dragState, setDragState] = useState(null);

  const displayToolsRef = useRef(tools);
  const dragStateRef = useRef(null);
  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const gap = s(8);
  const rowGap = sv(8);

  useEffect(() => {
    if (!dragStateRef.current) {
      setDisplayTools(tools);
      displayToolsRef.current = tools;
    }
  }, [tools]);

  const cardSize = useMemo(() => {
    if (!containerWidth) return 0;
    return (containerWidth - gap * 2) / 3;
  }, [containerWidth, gap]);

  const positions = useMemo(() => {
    if (!cardSize) return [];

    return displayTools.map((_, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);

      const x = col * (cardSize + gap);
      const y = row * (cardSize + rowGap);

      return {
        x,
        y,
        centerX: x + cardSize / 2,
        centerY: y + cardSize / 2,
      };
    });
  }, [displayTools, cardSize, gap, rowGap]);

  const gridHeight = cardSize > 0
    ? cardSize * 2 + rowGap
    : 0;

  const updateDisplayTools = (nextTools) => {
    displayToolsRef.current = nextTools;
    setDisplayTools(nextTools);
  };

  const updateDragState = (nextState) => {
    dragStateRef.current = nextState;
    setDragState(nextState);
  };

  const handleStartDrag = (index, item, touchOffset) => {
    const position = positions[index];
    if (!position) return;

    const nextState = {
      draggedId: item.id,
      item,
      startX: position.x,
      startY: position.y,
      touchOffset: touchOffset || { x: cardSize / 2, y: cardSize / 2 },
    };

    dragPosition.setValue({
      x: position.x,
      y: position.y,
    });

    updateDragState(nextState);
  };

  const handleMoveDrag = (draggedId, dx, dy) => {
    const currentDrag = dragStateRef.current;
    if (!currentDrag || currentDrag.draggedId !== draggedId) return;

    const nextX = currentDrag.startX + dx;
    const nextY = currentDrag.startY + dy;

    dragPosition.setValue({
      x: nextX,
      y: nextY,
    });

    const fingerX = nextX + currentDrag.touchOffset.x;
    const fingerY = nextY + currentDrag.touchOffset.y;

    const targetIndex = getDropIndex(fingerX, fingerY, positions, cardSize);
    if (targetIndex === -1) return;

    const currentTools = displayToolsRef.current;
    const currentIndex = currentTools.findIndex((tool) => tool.id === draggedId);

    if (
      currentIndex === -1 ||
      targetIndex === currentIndex ||
      targetIndex >= currentTools.length
    ) {
      return;
    }

    const nextTools = swapItems(currentTools, currentIndex, targetIndex);
    updateDisplayTools(nextTools);
  };

  const handleEndDrag = async (draggedId) => {
    const currentDrag = dragStateRef.current;

    if (!currentDrag || currentDrag.draggedId !== draggedId) {
      updateDragState(null);
      return;
    }

    const finalTools = displayToolsRef.current;

    onReorder(finalTools);
    updateDragState(null);
  };

  const handleCancelDrag = () => {
    updateDisplayTools(tools);
    updateDragState(null);
  };

  const draggedId = dragState?.draggedId;

  return (
    <View
      style={[styles.container, { height: gridHeight || undefined }]}
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      {cardSize > 0 && positions.length > 0
        ? displayTools.map((item, index) => (
            <DraggableTile
              key={item.id}
              item={item}
              index={index}
              position={positions[index]}
              cardSize={cardSize}
              isHidden={draggedId === item.id}
              renderToolIcon={renderToolIcon}
              onPressTool={onPressTool}
              onStartDrag={handleStartDrag}
              onMoveDrag={handleMoveDrag}
              onEndDrag={handleEndDrag}
              onCancelDrag={handleCancelDrag}
            />
          ))
        : null}

      {dragState ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dragOverlay,
            {
              width: cardSize,
              height: cardSize,
              transform: dragPosition.getTranslateTransform(),
            },
          ]}
        >
          <ToolCard
            icon={dragState.item.image ? undefined : renderToolIcon(dragState.item)}
            image={dragState.item.image}
            title={dragState.item.title}
            description={dragState.item.description}
            disabled={dragState.item.disabled}
            selected={false}
            editing={false}
            onPress={() => {}}
            onLongPress={() => {}}
            cardStyle={styles.card}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },

  slot: {
    position: 'absolute',
  },

  card: {
    width: '100%',
    marginBottom: 0,
  },

  dragOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 999,
    elevation: 20,
    opacity: 0.98,
  },
});