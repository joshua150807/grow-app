import { StyleSheet } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf, SCREEN } from '../../../../constants/layout';

const veryCompact = SCREEN.height < 760;
const compact = SCREEN.height < 900;

const BG = COLORS.toolsBg ?? '#050403';
const CARD = COLORS.toolsCard ?? '#08060B';
const CARD_2 = COLORS.darkCard2 ?? '#0E0B10';
const TEXT = COLORS.toolsText ?? '#FFF1D2';
const TEXT_MUTED = COLORS.textMuted ?? 'rgba(255,241,210,0.55)';
const TEXT_DIM = COLORS.textDim ?? 'rgba(255,241,210,0.38)';
const GOLD = COLORS.toolsGold ?? COLORS.gold ?? '#D4AF37';
const SOFT_GOLD = COLORS.softGold ?? '#E7C98A';
const BORDER = COLORS.toolsCardBorder ?? 'rgba(255,255,255,0.10)';
const ERROR = COLORS.errorLight ?? COLORS.error ?? '#D46A6A';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },

  topBar: {
    paddingTop: veryCompact ? sv(48) : compact ? sv(54) : sv(62),
    paddingHorizontal: s(18),
    paddingBottom: sv(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BG,
  },

  backButton: {
    minHeight: sv(34),
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: s(10),
  },

  backText: {
    color: SOFT_GOLD,
    fontSize: sf(14),
    fontWeight: '700',
    marginLeft: s(2),
  },

  iconButton: {
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,201,138,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.22)',
  },

  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },

  listContent: {
    paddingHorizontal: s(18),
    paddingBottom: sv(38),
    backgroundColor: BG,
  },

  listHeader: {
    marginTop: sv(8),
    marginBottom: sv(20),
  },

  listTitle: {
    color: TEXT,
    fontSize: veryCompact ? sf(31) : compact ? sf(34) : sf(37),
    fontWeight: '900',
    letterSpacing: -0.6,
  },

  listSubtitle: {
    color: TEXT_MUTED,
    fontSize: sf(12),
    marginTop: sv(4),
  },

  searchFake: {
    minHeight: sv(38),
    borderRadius: s(12),
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(12),
    marginBottom: sv(14),
  },

  searchFakeText: {
    color: TEXT_DIM,
    fontSize: sf(13),
    marginLeft: s(8),
  },

  errorBanner: {
    borderRadius: s(14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212,106,106,0.35)',
    backgroundColor: 'rgba(212,106,106,0.08)',
    padding: s(12),
    marginBottom: sv(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },

  errorText: {
    flex: 1,
    color: ERROR,
    fontSize: sf(12),
    lineHeight: sf(16),
  },

  emptyState: {
    minHeight: sv(240),
    borderRadius: s(24),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    padding: s(24),
  },

  emptyTitle: {
    color: TEXT,
    fontSize: sf(17),
    fontWeight: '900',
    marginTop: sv(12),
  },

  emptyText: {
    color: TEXT_MUTED,
    fontSize: sf(12),
    textAlign: 'center',
    marginTop: sv(6),
    lineHeight: sf(17),
  },

  notesList: {
    borderRadius: s(18),
    overflow: 'hidden',
    backgroundColor: CARD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },

  noteRow: {
    minHeight: sv(82),
    paddingHorizontal: s(14),
    paddingVertical: sv(11),
    backgroundColor: CARD,
  },

  noteRowPressed: {
    opacity: 0.82,
  },

  noteRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sv(4),
  },

  noteTitle: {
    flex: 1,
    color: TEXT,
    fontSize: sf(15),
    fontWeight: '900',
    marginRight: s(10),
  },

  noteDate: {
    color: TEXT_DIM,
    fontSize: sf(11),
    fontWeight: '700',
  },

  notePreview: {
    color: TEXT_MUTED,
    fontSize: sf(12),
    lineHeight: sf(17),
  },

  noteDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.075)',
    marginLeft: s(14),
  },

  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginTop: sv(6),
  },

  pinnedText: {
    color: GOLD,
    fontSize: sf(10.5),
    fontWeight: '800',
  },

  loadingBox: {
    flex: 1,
    minHeight: sv(160),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },

  editorScroll: {
    flex: 1,
    backgroundColor: BG,
  },

  editorContent: {
    flexGrow: 1,
    paddingHorizontal: s(20),
    paddingBottom: sv(36),
    backgroundColor: BG,
  },

  editorDate: {
    color: TEXT_DIM,
    fontSize: sf(12),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: sv(14),
  },

  editorInput: {
    flex: 1,
    minHeight: SCREEN.height * 0.68,
    color: TEXT,
    fontSize: sf(19),
    lineHeight: sf(28),
    fontWeight: '500',
    textAlignVertical: 'top',
    paddingTop: sv(8),
  },

  savingText: {
    color: TEXT_DIM,
    fontSize: sf(11),
    fontWeight: '700',
  },

  doneText: {
    color: SOFT_GOLD,
    fontSize: sf(14),
    fontWeight: '800',
  },

  editorMenu: {
    position: 'absolute',
    top: veryCompact ? sv(84) : compact ? sv(92) : sv(100),
    right: s(18),
    zIndex: 20,
    width: s(180),
    borderRadius: s(14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: CARD_2,
    paddingVertical: sv(8),
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  menuItem: {
    minHeight: sv(38),
    paddingHorizontal: s(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(9),
  },

  menuText: {
    color: TEXT,
    fontSize: sf(13),
    fontWeight: '700',
  },

  menuDangerText: {
    color: ERROR,
    fontSize: sf(13),
    fontWeight: '800',
  },

  richEditorWrap: {
    flex: 1,
    minHeight: SCREEN.height * 0.68,
    backgroundColor: BG,
    overflow: 'hidden',
  },

  richEditorWebViewContainer: {
    flex: 1,
    minHeight: SCREEN.height * 0.68,
    backgroundColor: BG,
  },

  richEditorWebView: {
    flex: 1,
    minHeight: SCREEN.height * 0.68,
    backgroundColor: BG,
  },

  formatToolbarWrap: {
    minHeight: sv(54),
    marginHorizontal: s(12),
    marginBottom: sv(8),
    borderRadius: s(18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(22,22,22,0.96)',
    overflow: 'hidden',
    justifyContent: 'center',
  },

  formatToolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    gap: s(7),
  },

  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },

  formatDivider: {
    width: StyleSheet.hairlineWidth,
    height: sv(30),
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginHorizontal: s(2),
  },

  formatTextButton: {
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    alignItems: 'center',
    justifyContent: 'center',
  },

  formatLargeA: {
    color: 'rgba(255,241,210,0.88)',
    fontSize: sf(20),
    fontWeight: '900',
  },

  formatSmallA: {
    color: 'rgba(255,241,210,0.78)',
    fontSize: sf(14),
    fontWeight: '800',
  },

  toolbarBold: {
    color: 'rgba(255,241,210,0.88)',
    fontSize: sf(16),
    fontWeight: '900',
  },

  toolbarItalic: {
    color: 'rgba(255,241,210,0.88)',
    fontSize: sf(16),
    fontWeight: '800',
    fontStyle: 'italic',
  },

  toolbarUnderline: {
    color: 'rgba(255,241,210,0.88)',
    fontSize: sf(16),
    fontWeight: '800',
    textDecorationLine: 'underline',
  },

  toolbarStrike: {
    color: 'rgba(255,241,210,0.88)',
    fontSize: sf(16),
    fontWeight: '800',
    textDecorationLine: 'line-through',
  },

  colorDot: {
    width: s(24),
    height: s(24),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  formatIconButton: {
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatToolbarOuter: {
    position: 'relative',
    backgroundColor: 'transparent',
  },

  formatToolbarWrap: {
    minHeight: sv(54),
    marginHorizontal: s(12),
    marginBottom: sv(8),
    borderRadius: s(18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(22,22,22,0.96)',
    overflow: 'hidden',
    justifyContent: 'center',
  },

  formatToolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    gap: s(7),
  },

  formatButtonActive: {
    backgroundColor: 'rgba(231,201,138,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.32)',
  },

  formatDivider: {
    width: StyleSheet.hairlineWidth,
    height: sv(30),
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginHorizontal: s(2),
  },

  formatTextButton: {
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    alignItems: 'center',
    justifyContent: 'center',
  },

  formatLargeA: {
    color: 'rgba(255,241,210,0.88)',
    fontSize: sf(20),
    fontWeight: '900',
  },

  formatSmallA: {
    color: 'rgba(255,241,210,0.78)',
    fontSize: sf(14),
    fontWeight: '800',
  },

  toolbarBold: {
    color: 'rgba(255,241,210,0.88)',
    fontSize: sf(16),
    fontWeight: '900',
  },

  toolbarItalic: {
    color: 'rgba(255,241,210,0.88)',
    fontSize: sf(16),
    fontWeight: '800',
    fontStyle: 'italic',
  },

  toolbarUnderline: {
    color: 'rgba(255,241,210,0.88)',
    fontSize: sf(16),
    fontWeight: '800',
    textDecorationLine: 'underline',
  },

  toolbarStrike: {
    color: 'rgba(255,241,210,0.88)',
    fontSize: sf(16),
    fontWeight: '800',
    textDecorationLine: 'line-through',
  },

  formatIconButton: {
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    alignItems: 'center',
    justifyContent: 'center',
  },

  formatColorButton: {
    width: s(38),
    height: s(34),
    borderRadius: s(17),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  selectedColorDot: {
    position: 'absolute',
    right: s(5),
    bottom: sv(5),
    width: s(9),
    height: s(9),
    borderRadius: s(4.5),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.55)',
  },

  colorPopup: {
    position: 'absolute',
    left: s(12),
    right: s(12),
    bottom: sv(68),
    zIndex: 50,
    borderRadius: s(18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(18,18,18,0.98)',
    paddingHorizontal: s(12),
    paddingTop: sv(10),
    paddingBottom: sv(12),
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -5 },
    elevation: 12,
  },

  colorPopupTitle: {
    color: 'rgba(255,241,210,0.72)',
    fontSize: sf(11),
    fontWeight: '800',
    marginBottom: sv(9),
    letterSpacing: 0.4,
  },

  colorPopupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
  },

  colorPopupOption: {
    minHeight: sv(34),
    borderRadius: s(999),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: s(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
  },

  colorPopupOptionActive: {
    borderColor: 'rgba(231,201,138,0.42)',
    backgroundColor: 'rgba(231,201,138,0.12)',
  },

  colorPopupDot: {
    width: s(16),
    height: s(16),
    borderRadius: s(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  colorPopupLabel: {
    color: 'rgba(255,241,210,0.82)',
    fontSize: sf(11),
    fontWeight: '700',
  },
  nativeEditorInput: {
    minHeight: SCREEN.height * 0.68,
    color: TEXT,
    fontSize: sf(19),
    lineHeight: sf(28),
    fontWeight: '500',
    textAlignVertical: 'top',
    paddingTop: sv(8),
    paddingBottom: sv(40),
    backgroundColor: BG,
  },
  noteTitleInput: {
    minHeight: sv(48),
    color: TEXT,
    fontSize: sf(27),
    lineHeight: sf(34),
    fontWeight: '900',
    textAlignVertical: 'top',
    paddingTop: sv(8),
    paddingBottom: sv(16),
    backgroundColor: BG,
    letterSpacing: -0.3,
  },

  noteBodyInput: {
    minHeight: SCREEN.height * 0.58,
    color: TEXT,
    fontSize: sf(18),
    lineHeight: sf(27),
    fontWeight: '500',
    textAlignVertical: 'top',
    paddingTop: sv(10),
    paddingBottom: sv(40),
    backgroundColor: BG,
  },
});