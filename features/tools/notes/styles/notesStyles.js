import { StyleSheet } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf, SCREEN } from '../../../../constants/layout';

const veryCompact = SCREEN.height < 760;
const compact = SCREEN.height < 900;

const BG = COLORS.toolsBg ?? '#050403';
const CARD = 'rgba(10, 9, 17, 0.82)';
const CARD_2 = 'rgba(14, 13, 22, 0.86)';
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

  background: {
    flex: 1,
  },

  backgroundImage: {
    opacity: 1,
  },

  backgroundOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 4, 10, 0.56)',
  },

  topBar: {
    paddingTop: veryCompact ? sv(48) : compact ? sv(54) : sv(62),
    paddingHorizontal: s(18),
    paddingBottom: sv(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    zIndex: 40,
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

  listContent: {
    paddingHorizontal: s(18),
    paddingBottom: sv(38),
    backgroundColor: 'transparent',
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

  searchBox: {
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

  searchInput: {
    flex: 1,
    minHeight: sv(38),
    color: TEXT,
    fontSize: sf(13),
    marginLeft: s(8),
    paddingVertical: 0,
  },

  searchClearButton: {
    width: s(26),
    height: s(26),
    borderRadius: s(13),
    alignItems: 'center',
    justifyContent: 'center',
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

  loadingBox: {
    flex: 1,
    minHeight: sv(160),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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

  editorScroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  editorContent: {
    flexGrow: 1,
    paddingHorizontal: s(20),
    paddingBottom: sv(180),
    backgroundColor: 'transparent',
  },

  editorDate: {
    color: TEXT_DIM,
    fontSize: sf(12),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: sv(14),
  },

  editorMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 30,
    elevation: 30,
  },

  editorMenu: {
    position: 'absolute',
    top: veryCompact ? sv(84) : compact ? sv(92) : sv(100),
    right: s(18),
    zIndex: 50,
    elevation: 50,
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
  },

  menuItem: {
    minHeight: sv(38),
    paddingHorizontal: s(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(9),
  },

  menuDangerText: {
    color: ERROR,
    fontSize: sf(13),
    fontWeight: '800',
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
    backgroundColor: 'transparent',
    letterSpacing: -0.3,
  },

  noteBodyInput: {
    minHeight: SCREEN.height * 0.72,
    color: TEXT,
    fontSize: sf(18),
    lineHeight: sf(27),
    fontWeight: '500',
    textAlignVertical: 'top',
    paddingTop: sv(10),
    paddingBottom: sv(80),
    backgroundColor: 'transparent',
  },

  noteTitleDisplayWrap: {
    minHeight: sv(48),
    justifyContent: 'center',
    paddingTop: sv(8),
    paddingBottom: sv(16),
  },

  noteTitleDisplay: {
    color: TEXT,
    fontSize: sf(27),
    lineHeight: sf(34),
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  noteBodyDisplayWrap: {
    minHeight: SCREEN.height * 0.58,
    paddingTop: sv(10),
    paddingBottom: sv(40),
  },

  noteBodyDisplay: {
    color: TEXT,
    fontSize: sf(18),
    lineHeight: sf(27),
    fontWeight: '500',
  },

  notePlaceholderText: {
    color: 'rgba(255,241,210,0.28)',
  },
});