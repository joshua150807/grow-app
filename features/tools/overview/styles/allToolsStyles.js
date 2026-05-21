import { StyleSheet } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf, SCREEN } from '../../../../constants/layout';

const veryCompact = SCREEN.height < 760;
const compact = SCREEN.height < 900;

export const allToolsStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.toolsBg ?? '#050403',
  },

  content: {
    flex: 1,
    paddingTop: veryCompact ? sv(44) : compact ? sv(50) : sv(62),
    paddingHorizontal: s(14),
  },

  allToolsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: veryCompact ? sv(12) : compact ? sv(14) : sv(18),
  },

  backButton: {
    minHeight: sv(34),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: s(10),
  },

  backText: {
    color: COLORS.softGold,
    fontSize: sf(14),
    fontWeight: '700',
    marginLeft: s(2),
  },

  allToolsEditButton: {
    minHeight: sv(32),
    borderRadius: s(999),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.32)',
    backgroundColor: 'rgba(231,201,138,0.055)',
    paddingHorizontal: s(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(7),
  },

  allToolsEditText: {
    color: COLORS.toolsGold,
    fontSize: sf(11),
    fontWeight: '800',
  },

  allToolsContent: {
    paddingBottom: veryCompact ? sv(28) : compact ? sv(34) : sv(42),
  },

  allToolsHeader: {
    alignItems: 'center',
    marginBottom: veryCompact ? sv(12) : compact ? sv(14) : sv(18),
    paddingHorizontal: s(8),
  },

  title: {
    color: COLORS.toolsText,
    fontSize: veryCompact ? sf(19) : compact ? sf(20.5) : sf(22),
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: sv(7),
  },

  sectionSubtitle: {
    color: 'rgba(255,241,210,0.50)',
    fontSize: compact ? sf(11) : sf(12),
    fontWeight: '400',
    lineHeight: compact ? sf(15) : sf(17),
    textAlign: 'center',
  },

  editPanel: {
    marginTop: sv(2),
    marginBottom: sv(14),
    borderRadius: s(12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.24)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: s(12),
    paddingVertical: sv(10),
  },

  editPanelTitle: {
    color: COLORS.toolsText,
    fontSize: sf(12.5),
    fontWeight: '800',
    marginBottom: sv(3),
  },

  editPanelText: {
    color: 'rgba(255,241,210,0.55)',
    fontSize: sf(10.2),
    lineHeight: sf(14),
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },

  cardSlot: {
    overflow: 'visible',
  },
});