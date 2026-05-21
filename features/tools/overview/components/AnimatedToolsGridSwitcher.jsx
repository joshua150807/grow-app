import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';

import ToolCard from './ToolCard';
import DraggableSixToolGrid from './DraggableSixToolGrid';

function ReplacementWiggleWrapper({
  active,
  cardSize,
  marginBottom,
  children,
}) {
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      wiggleAnim.stopAnimation();
      wiggleAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: -1,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
      wiggleAnim.setValue(0);
    };
  }, [active, wiggleAnim]);

  const rotate = wiggleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-1.1deg', '0deg', '1.1deg'],
  });

  return (
    <Animated.View
      style={[
        {
          width: cardSize,
          height: cardSize,
          marginBottom,
        },
        active && {
          transform: [{ rotate }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default function AnimatedToolsGridSwitcher({
  mode,
  overviewTools,
  visibleToolSlots,
  replacementToolId,
  reorderMode,
  overviewToolIds,
  overviewStyles,
  overviewLayout,
  renderToolIcon,
  onToolPress,
  onReorder,
  onReorderModeChange,
  onExitReorderMode,
  onModeChange,
  onOpenAllTools,
}) {
  const [containerWidth, setContainerWidth] = useState(0);

  const pinchScale = useRef(new Animated.Value(1)).current;
  const isPinchingRef = useRef(false);

  const isExpanded = mode === 'expanded';

  const layout = overviewLayout;

  const compactGap = layout?.compactGridGap ?? 8;
  const compactRowGap = layout?.compactGridRowGap ?? 8;
  const expandedGap = layout?.expandedGridGap ?? 7;
  const expandedRowGap = layout?.expandedGridRowGap ?? 6;
  const moreToolsButtonHeight = layout?.moreToolsButtonHeight ?? 42;

  const compactCardSize = useMemo(() => {
    if (!containerWidth) return layout?.compactCardSize ?? 0;
    return Math.floor((containerWidth - compactGap * 2) / 3);
  }, [containerWidth, compactGap, layout?.compactCardSize]);

  const expandedCardSize = useMemo(() => {
    if (!containerWidth) return layout?.expandedCardSize ?? 0;
    return Math.floor((containerWidth - expandedGap * 3) / 4);
  }, [containerWidth, expandedGap, layout?.expandedCardSize]);

  const compactGridHeight = useMemo(() => {
    if (!compactCardSize) return 1;
    return compactCardSize * 2 + compactRowGap;
  }, [compactCardSize, compactRowGap]);

  const moreToolsButtonMargin = 12;
  const compactTotalHeight = compactGridHeight + moreToolsButtonMargin + moreToolsButtonHeight;

  const expandedGridHeight = useMemo(() => {
    if (!expandedCardSize) return compactTotalHeight;
    return expandedCardSize * 4 + expandedRowGap * 3;
  }, [expandedCardSize, expandedRowGap, compactTotalHeight]);

  useEffect(() => {
    pinchScale.setValue(1);
    isPinchingRef.current = false;
  }, [mode, pinchScale]);

  const transitionProgress = useMemo(() => {
    if (isExpanded) {
      return pinchScale.interpolate({
        inputRange: [0.78, 1],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      });
    }

    return pinchScale.interpolate({
      inputRange: [1, 1.22],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
  }, [isExpanded, pinchScale]);

  const containerHeight = transitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: isExpanded
      ? [expandedGridHeight, compactTotalHeight]
      : [compactTotalHeight, expandedGridHeight],
    extrapolate: 'clamp',
  });

  const compactOpacity = isExpanded
    ? transitionProgress
    : transitionProgress.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [1, 0.32, 0],
        extrapolate: 'clamp',
      });

  const expandedOpacity = isExpanded
    ? transitionProgress.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [1, 0.32, 0],
        extrapolate: 'clamp',
      })
    : transitionProgress.interpolate({
        inputRange: [0, 0.25, 1],
        outputRange: [0, 0.35, 1],
        extrapolate: 'clamp',
      });

  const compactTranslateY = isExpanded
    ? transitionProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [52, 0],
        extrapolate: 'clamp',
      })
    : transitionProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 54],
        extrapolate: 'clamp',
      });

  const compactScale = isExpanded
    ? transitionProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.88, 1],
        extrapolate: 'clamp',
      })
    : transitionProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.88],
        extrapolate: 'clamp',
      });

  const expandedTranslateY = isExpanded
    ? transitionProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -34],
        extrapolate: 'clamp',
      })
    : transitionProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [-34, 0],
        extrapolate: 'clamp',
      });

  const expandedScale = isExpanded
    ? transitionProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.08],
        extrapolate: 'clamp',
      })
    : transitionProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1.08, 1],
        extrapolate: 'clamp',
      });

  const finishModeChange = (nextMode, finalScale) => {
    Animated.timing(pinchScale, {
      toValue: finalScale,
      duration: 115,
      useNativeDriver: false,
    }).start(async () => {
      await onModeChange(nextMode);
      pinchScale.setValue(1);
      isPinchingRef.current = false;
    });
  };

  const resetPinch = () => {
    Animated.spring(pinchScale, {
      toValue: 1,
      useNativeDriver: false,
      speed: 18,
      bounciness: 5,
    }).start(() => {
      isPinchingRef.current = false;
    });
  };

  const handlePinchGesture = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    {
      useNativeDriver: false,
      listener: () => {
        if (!isPinchingRef.current) {
          isPinchingRef.current = true;
        }
      },
    }
  );

  const handlePinchStateChange = (event) => {
    if (reorderMode || replacementToolId) return;

    const { state, scale } = event.nativeEvent;

    if (
      state !== State.END &&
      state !== State.CANCELLED &&
      state !== State.FAILED
    ) {
      return;
    }

    if (!isExpanded && scale > 1.14) {
      finishModeChange('expanded', 1.22);
      return;
    }

    if (isExpanded && scale < 0.86) {
      finishModeChange('compact', 0.78);
      return;
    }

    resetPinch();
  };

  const renderMoreToolsButton = () => {
    if (reorderMode) return null;

    return (
      <Pressable
        onPress={(event) => {
          event.stopPropagation?.();
          onOpenAllTools?.();
        }}
        style={[
          overviewStyles.moreToolsButton,
          {
            height: moreToolsButtonHeight,
          },
        ]}
      >
        <Text style={overviewStyles.moreToolsText}>Weitere Tools</Text>
      </Pressable>
    );
  };

  const renderReplacementGrid = () => {
    return (
      <View
        style={[
          overviewStyles.grid,
          {
            columnGap: compactGap,
            rowGap: compactRowGap,
          },
        ]}
      >
        {overviewTools.map((tool, index) => {
          const selected = overviewToolIds.includes(tool.id);
          const isSecondRow = index >= 3;

          return (
            <ReplacementWiggleWrapper
              key={tool.id}
              active={!tool.placeholder && !tool.disabled}
              cardSize={compactCardSize}
              marginBottom={isSecondRow ? 0 : compactRowGap}
            >
              <ToolCard
                icon={tool.image ? undefined : renderToolIcon(tool)}
                image={tool.image}
                onPress={() => onToolPress(tool)}
                onLongPress={undefined}
                title={tool.title}
                description={tool.description}
                disabled={tool.disabled}
                placeholder={tool.placeholder}
                selected={selected}
                editing={false}
                size="normal"
                cardStyle={{
                  width: '100%',
                  height: '100%',
                  marginBottom: 0,
                }}
              />
            </ReplacementWiggleWrapper>
          );
        })}
      </View>
    );
  };

  const renderCompactGrid = () => {
    if (replacementToolId) {
      return renderReplacementGrid();
    }

    return (
      <View>
        <DraggableSixToolGrid
          tools={overviewTools}
          renderToolIcon={renderToolIcon}
          onPressTool={onToolPress}
          onReorder={onReorder}
          reorderMode={reorderMode}
          overviewLayout={layout}
          onReorderModeChange={onReorderModeChange}
          onExitReorderMode={onExitReorderMode}
        />

        {renderMoreToolsButton()}
      </View>
    );
  };

  const renderExpandedGrid = () => (
    <View
      style={[
        overviewStyles.grid,
        overviewStyles.gridExpanded,
        {
          columnGap: expandedGap,
          rowGap: expandedRowGap,
        },
      ]}
    >
      {visibleToolSlots.map((tool) => {
        const selected = overviewToolIds.includes(tool.id);

        return (
          <ToolCard
            key={tool.id}
            icon={tool.image ? undefined : renderToolIcon(tool)}
            image={tool.image}
            onPress={() => onToolPress(tool)}
            onLongPress={undefined}
            title={tool.title}
            description={tool.description}
            disabled={tool.disabled}
            placeholder={tool.placeholder}
            selected={selected}
            editing={false}
            size="small"
            cardStyle={{
              width: expandedCardSize,
              height: expandedCardSize,
              marginBottom: 0,
            }}
          />
        );
      })}
    </View>
  );

  if (replacementToolId) {
    return (
      <View
        style={{ width: '100%' }}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0 && Math.abs(nextWidth - containerWidth) > 1) {
            setContainerWidth(nextWidth);
          }
        }}
      >
        {renderCompactGrid()}
      </View>
    );
  }

  return (
    <View
      style={{ width: '100%' }}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && Math.abs(nextWidth - containerWidth) > 1) {
          setContainerWidth(nextWidth);
        }
      }}
    >
      <PinchGestureHandler
        enabled={!reorderMode && !replacementToolId}
        minPointers={2}
        maxPointers={2}
        shouldCancelWhenOutside={false}
        onGestureEvent={handlePinchGesture}
        onHandlerStateChange={handlePinchStateChange}
      >
        <Animated.View
          style={{
            position: 'relative',
            height: containerHeight,
            overflow: 'hidden',
          }}
        >
          {/* Compact 2x3 + Weitere Tools */}
          <Animated.View
            pointerEvents={isExpanded ? 'none' : 'auto'}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              opacity: compactOpacity,
              transform: [
                { translateY: compactTranslateY },
                { scale: compactScale },
              ],
            }}
          >
            {renderCompactGrid()}
          </Animated.View>

          {/* Expanded 4x4 */}
          <Animated.View
            pointerEvents={isExpanded ? 'auto' : 'none'}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              opacity: expandedOpacity,
              transform: [
                { translateY: expandedTranslateY },
                { scale: expandedScale },
              ],
            }}
          >
            {renderExpandedGrid()}
          </Animated.View>
        </Animated.View>
      </PinchGestureHandler>
    </View>
  );
}