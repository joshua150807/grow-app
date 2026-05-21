import { s, sv } from '../../../../constants/layout';

export function getToolsOverviewLayout({ width, height }) {
  const isNarrow = width < 370;
  const isVerySmall = width < 330 || height < 700;

  const horizontalPadding = isNarrow ? s(12) : s(14);
  const contentWidth = width - horizontalPadding * 2;

  // Feste, proportionale Abstände
  const contentPaddingTop = sv(60);
  const contentPaddingBottom = sv(10);
  const headerMarginBottom = sv(6);
  const toolsHeaderMarginBottom = sv(10);
  const gridMarginBottom = sv(12);
  const mentorMarginTop = sv(7);
  const mentorMarginBottom = sv(9);
  const trackerMarginTop = sv(9);

  // Grid Gaps
  const compactGridGap = isNarrow ? s(6) : s(7);
  const compactGridRowGap = isNarrow ? sv(6) : sv(7);

  const expandedGridGap = isNarrow ? s(5) : s(6);
  const expandedGridRowGap = isNarrow ? sv(5) : sv(6);

  // Card Größen
  const compactCardSize = Math.floor(
    (contentWidth - compactGridGap * 2) / 3
  );
  const compactGridHeight = compactCardSize * 2 + compactGridRowGap;

  const moreToolsButtonHeight = sv(38);

  const expandedCardSize = Math.floor(
    (contentWidth - expandedGridGap * 3) / 4
  );
  const expandedGridHeight = expandedCardSize * 4 + expandedGridRowGap * 3;

  // Mentor und Tracker Höhen
  const mentorCardHeight = sv(100);
  const trackerRowHeight = sv(74);

  // Scroll nur bei wirklich kleinen Geräten
  const needsScroll = isVerySmall;

  return {
    width,
    height,
    isNarrow,
    isVerySmall,

    horizontalPadding,
    contentWidth,

    contentPaddingTop,
    contentPaddingBottom,
    headerMarginBottom,
    toolsHeaderMarginBottom,
    gridMarginBottom,
    mentorMarginTop,
    mentorMarginBottom,
    trackerMarginTop,

    compactGridGap,
    compactGridRowGap,
    expandedGridGap,
    expandedGridRowGap,

    compactCardSize,
    expandedCardSize,
    compactGridHeight,
    expandedGridHeight,
    moreToolsButtonHeight,

    mentorCardHeight,
    trackerRowHeight,

    trackerGap: isNarrow ? s(6) : s(8),
    needsScroll,
  };
}