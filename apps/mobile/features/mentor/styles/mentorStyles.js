import { StyleSheet } from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

// Space reserved for the floating tab bar (see app/(tabs)/_layout.jsx).
export const TAB_BAR_SPACE = sv(68) + sv(18);

export const mentorStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: sv(6),
    paddingBottom: sv(10),
  },
  headerSide: {
    minWidth: s(72),
  },
  headerSideRight: {
    minWidth: s(72),
    alignItems: 'flex-end',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sv(6),
    paddingRight: s(12),
  },
  backText: {
    color: COLORS.softGold,
    fontSize: sf(15),
    fontWeight: '500',
    marginLeft: s(2),
  },
  headerTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: sf(15),
    fontWeight: '700',
    textAlign: 'center',
  },
  iconButton: {
    padding: s(6),
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(24),
    paddingBottom: TAB_BAR_SPACE,
  },
  loadingText: {
    color: COLORS.textDim,
    fontSize: sf(13),
    fontWeight: '600',
    marginTop: sv(10),
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.errorLight,
    fontSize: sf(14),
    textAlign: 'center',
    marginBottom: sv(14),
    lineHeight: sf(20),
  },

  // Home / conversation list
  hero: {
    paddingTop: sv(4),
    paddingBottom: sv(16),
  },
  heroTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(26),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    color: COLORS.textMuted,
    fontSize: sf(14),
    marginTop: sv(6),
    lineHeight: sf(20),
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sv(48),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.goldBorderLight,
    backgroundColor: COLORS.darkCard3,
    marginBottom: sv(18),
  },
  newChatText: {
    color: COLORS.lightGold,
    fontSize: sf(15),
    fontWeight: '700',
    marginLeft: s(8),
  },
  sectionLabel: {
    color: COLORS.textDim,
    fontSize: sf(12),
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: sv(8),
  },
  listContent: {
    paddingBottom: TAB_BAR_SPACE + sv(12),
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sv(14),
    paddingHorizontal: s(14),
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: COLORS.toolsCardBorder,
    backgroundColor: COLORS.toolsCard,
    marginBottom: sv(8),
  },
  conversationTextWrap: {
    flex: 1,
    marginLeft: s(10),
  },
  conversationTitle: {
    color: COLORS.toolsText,
    fontSize: sf(15),
    fontWeight: '600',
  },
  conversationMeta: {
    color: COLORS.toolsTextDim,
    fontSize: sf(12),
    marginTop: sv(3),
  },
  emptyText: {
    color: COLORS.textDim,
    fontSize: sf(14),
    textAlign: 'center',
    marginTop: sv(24),
    lineHeight: sf(20),
  },
  usageText: {
    color: COLORS.textFaint,
    fontSize: sf(12),
    textAlign: 'center',
    marginTop: sv(6),
  },

  // Consent
  consentScroll: {
    paddingBottom: TAB_BAR_SPACE + sv(20),
  },
  consentCard: {
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard,
    padding: s(18),
    marginBottom: sv(18),
  },
  consentPoint: {
    flexDirection: 'row',
    marginBottom: sv(12),
  },
  consentPointText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: sf(14),
    lineHeight: sf(20),
    marginLeft: s(10),
  },
  consentLink: {
    color: COLORS.gold,
    fontSize: sf(14),
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginBottom: sv(18),
  },
  primaryButton: {
    minHeight: sv(48),
  },

  // Chat
  chatFlex: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: sv(12),
  },
  bubbleRow: {
    flexDirection: 'row',
    marginVertical: sv(4),
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: s(18),
    paddingHorizontal: s(14),
    paddingVertical: sv(10),
  },
  bubbleUser: {
    backgroundColor: COLORS.darkCard3,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderBottomRightRadius: s(6),
  },
  bubbleAssistant: {
    backgroundColor: COLORS.toolsCard,
    borderWidth: 1,
    borderColor: COLORS.toolsCardBorder,
    borderBottomLeftRadius: s(6),
  },
  bubbleFailed: {
    borderColor: COLORS.error,
  },
  bubbleText: {
    color: COLORS.textSecondary,
    fontSize: sf(15),
    lineHeight: sf(21),
  },
  bubbleTextUser: {
    color: COLORS.paleGold,
  },
  actionCard: {
    maxWidth: '86%',
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: COLORS.goldBorderLight,
    backgroundColor: COLORS.darkCard2,
    paddingHorizontal: s(14),
    paddingVertical: sv(12),
    marginTop: sv(4),
    marginBottom: sv(4),
  },
  actionCardDone: {
    borderColor: COLORS.toolsCardBorder,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sv(6),
  },
  actionLabel: {
    color: COLORS.mutedGold,
    fontSize: sf(11),
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginLeft: s(6),
  },
  actionSummary: {
    color: COLORS.textPrimary,
    fontSize: sf(15),
    lineHeight: sf(21),
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: s(8),
    marginTop: sv(10),
  },
  actionConfirm: {
    flex: 1,
    minHeight: sv(38),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
  },
  actionConfirmText: {
    color: COLORS.black,
    fontSize: sf(14),
    fontWeight: '700',
  },
  actionReject: {
    flex: 1,
    minHeight: sv(38),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderMid,
  },
  actionRejectText: {
    color: COLORS.textSecondary,
    fontSize: sf(14),
    fontWeight: '600',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sv(8),
  },
  actionStatusText: {
    color: COLORS.textMuted,
    fontSize: sf(13),
    marginLeft: s(6),
  },
  actionError: {
    color: COLORS.errorLight,
    fontSize: sf(12),
    marginTop: sv(6),
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: sv(6),
  },
  thinkingText: {
    color: COLORS.textDim,
    fontSize: sf(13),
    marginLeft: s(8),
  },
  starterWrap: {
    paddingTop: sv(18),
  },
  starterTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(18),
    fontWeight: '700',
    marginBottom: sv(4),
  },
  starterSubtitle: {
    color: COLORS.textMuted,
    fontSize: sf(13),
    marginBottom: sv(14),
    lineHeight: sf(19),
  },
  starterChip: {
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.toolsCardBorder,
    backgroundColor: COLORS.toolsCardSoft,
    paddingVertical: sv(11),
    paddingHorizontal: s(14),
    marginBottom: sv(8),
  },
  starterChipText: {
    color: COLORS.toolsText,
    fontSize: sf(14),
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: 'rgba(212,106,106,0.4)',
    backgroundColor: 'rgba(212,106,106,0.08)',
    paddingHorizontal: s(12),
    paddingVertical: sv(9),
    marginBottom: sv(8),
  },
  bannerText: {
    flex: 1,
    color: COLORS.errorLight,
    fontSize: sf(13),
    lineHeight: sf(18),
    marginLeft: s(8),
  },
  bannerAction: {
    color: COLORS.softGold,
    fontSize: sf(13),
    fontWeight: '700',
    marginLeft: s(8),
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: s(22),
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    backgroundColor: COLORS.darkCard4,
    paddingLeft: s(14),
    paddingRight: s(6),
    paddingVertical: sv(6),
  },
  composerInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: sf(15),
    maxHeight: sv(120),
    paddingTop: sv(8),
    paddingBottom: sv(8),
  },
  sendButton: {
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
    marginLeft: s(6),
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.borderMid,
  },
  composerArea: {
    paddingBottom: TAB_BAR_SPACE,
  },
  composerAreaKeyboard: {
    paddingBottom: sv(8),
  },
  disclaimer: {
    color: COLORS.textFaint,
    fontSize: sf(11),
    textAlign: 'center',
    marginTop: sv(6),
  },

  // Memory screen
  memoryIntro: {
    color: COLORS.textMuted,
    fontSize: sf(14),
    lineHeight: sf(20),
    marginBottom: sv(14),
  },
  memoryToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: COLORS.toolsCardBorder,
    backgroundColor: COLORS.toolsCard,
    paddingHorizontal: s(14),
    paddingVertical: sv(12),
    marginBottom: sv(18),
  },
  memoryToggleTextWrap: {
    flex: 1,
    marginRight: s(12),
  },
  memoryToggleTitle: {
    color: COLORS.toolsText,
    fontSize: sf(15),
    fontWeight: '600',
  },
  memoryToggleHint: {
    color: COLORS.toolsTextDim,
    fontSize: sf(12),
    marginTop: sv(2),
  },
  memorySectionHeader: {
    color: COLORS.textDim,
    fontSize: sf(12),
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: sv(10),
    marginBottom: sv(8),
  },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.toolsCardBorder,
    backgroundColor: COLORS.toolsCard,
    paddingVertical: sv(12),
    paddingHorizontal: s(14),
    marginBottom: sv(8),
  },
  memoryRowResolved: {
    opacity: 0.6,
  },
  memoryTextWrap: {
    flex: 1,
    marginRight: s(8),
  },
  memoryText: {
    color: COLORS.toolsText,
    fontSize: sf(14),
    lineHeight: sf(20),
  },
  memoryBadge: {
    alignSelf: 'flex-start',
    color: COLORS.toolsTextMuted,
    fontSize: sf(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: sv(4),
  },
  deleteAllButton: {
    alignSelf: 'center',
    paddingVertical: sv(10),
    paddingHorizontal: s(16),
    marginTop: sv(12),
  },
  deleteAllText: {
    color: COLORS.errorLight,
    fontSize: sf(14),
    fontWeight: '600',
  },

  // Rename modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: s(24),
  },
  modalCard: {
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard2,
    padding: s(18),
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(16),
    fontWeight: '700',
    marginBottom: sv(12),
  },
  modalInput: {
    color: COLORS.textPrimary,
    fontSize: sf(15),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    backgroundColor: COLORS.darkCard4,
    paddingHorizontal: s(12),
    paddingVertical: sv(10),
    marginBottom: sv(14),
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancel: {
    paddingVertical: sv(8),
    paddingHorizontal: s(14),
  },
  modalCancelText: {
    color: COLORS.textDim,
    fontSize: sf(14),
    fontWeight: '600',
  },
  modalSave: {
    marginLeft: s(8),
  },
});
