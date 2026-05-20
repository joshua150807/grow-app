import { StyleSheet } from 'react-native';
import { COLORS } from '../../../../constants/colors';
import { s, sv, sf, SCREEN } from '../../../../constants/layout';

const veryCompact = SCREEN.height < 760;
const compact = SCREEN.height < 900;

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.toolsBg ?? '#050403',
  },

  content: {
    flex: 1,
    paddingTop: veryCompact ? sv(44) : compact ? sv(50) : sv(62),
    paddingHorizontal: s(14),
    paddingBottom: veryCompact ? sv(20) : compact ? sv(26) : sv(34),
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: veryCompact ? sv(2) : compact ? sv(6) : sv(16),
    paddingHorizontal: s(2),
  },

  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  avatar: {
    width: veryCompact ? s(48) : compact ? s(52) : s(56),
    height: veryCompact ? s(48) : compact ? s(52) : s(56),
    borderRadius: veryCompact ? s(24) : compact ? s(26) : s(28),
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: compact ? s(10) : s(12),
  },

  avatarImageClip: {
    width: '100%',
    height: '100%',
    borderRadius: veryCompact ? s(24) : compact ? s(26) : s(28),
    overflow: 'hidden',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarText: {
    fontSize: veryCompact ? sf(17) : compact ? sf(18) : sf(20),
  },

  headerTextBox: {
    flex: 1,
  },

  topLabel: {
    color: 'rgba(255,241,210,0.48)',
    fontSize: compact ? sf(8.8) : sf(9.5),
    fontWeight: '400',
    letterSpacing: 2.2,
    marginBottom: sv(2),
  },

  accountName: {
    color: COLORS.toolsText,
    fontSize: veryCompact ? sf(16.5) : compact ? sf(17.5) : sf(19),
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  pointsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: compact ? s(8) : s(12),
  },

  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sv(2),
  },

  coinPlaceholder: {
    width: compact ? s(21) : s(24),
    height: compact ? s(21) : s(24),
    borderRadius: compact ? s(10.5) : s(12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.42)',
    backgroundColor: 'rgba(231,201,138,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(6),

    shadowColor: COLORS.toolsGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },

  coinStar: {
    color: COLORS.toolsGold,
    fontSize: compact ? sf(10) : sf(11),
    fontWeight: '500',
    textShadowColor: 'rgba(231,201,138,0.45)',
    textShadowRadius: 7,
    textShadowOffset: { width: 0, height: 0 },
  },

  pointsValue: {
    color: COLORS.toolsText,
    fontSize: veryCompact ? sf(15.5) : compact ? sf(16.5) : sf(18),
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  pointsLabel: {
    color: 'rgba(255,241,210,0.48)',
    fontSize: compact ? sf(8.2) : sf(9),
    fontWeight: '400',
    textAlign: 'center',
  },

  menuButton: {
    marginLeft: compact ? s(6) : s(10),
    padding: s(4),
  },

  dropdown: {
    position: 'absolute',
    top: sv(46),
    right: 0,
    width: s(190),
    backgroundColor: COLORS.toolsCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.toolsCardBorder,
    borderRadius: s(10),
    paddingVertical: sv(10),
    paddingHorizontal: s(14),
    zIndex: 999,
  },

  menuItem: {
    color: COLORS.toolsText,
    fontSize: sf(14),
    fontWeight: '400',
    paddingVertical: 8,
  },

  logoutItem: {
    color: COLORS.error,
    fontSize: sf(14),
    fontWeight: '400',
    paddingVertical: 8,
  },

  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 6,
  },

  sectionHeader: {
    marginTop: veryCompact ? sv(0) : compact ? sv(2) : sv(4),
    marginBottom: veryCompact ? sv(8) : compact ? sv(10) : sv(14),
    paddingHorizontal: s(2),
    alignItems: 'center',
  },

  sectionTitle: {
    color: COLORS.toolsText,
    fontSize: veryCompact ? sf(19) : compact ? sf(20.5) : sf(22),
    fontWeight: '600',
    marginBottom: 0,
    letterSpacing: 4,
    textAlign: 'center',
},

  sectionSubtitle: {
    color: 'rgba(255,241,210,0.50)',
    fontSize: compact ? sf(11) : sf(12),
    fontWeight: '400',
    lineHeight: compact ? sf(15) : sf(17),
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: veryCompact ? sv(0) : compact ? sv(2) : sv(4),
    marginBottom: veryCompact ? sv(8) : compact ? sv(10) : sv(14),
    paddingHorizontal: s(2),
  },

  sectionHeaderSpacer: {
    width: s(72),
  },

  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },

  sectionSmallButton: {
    minWidth: s(72),
    minHeight: sv(30),
    borderRadius: s(999),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.32)',
    backgroundColor: 'rgba(231,201,138,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(10),
  },

  sectionSmallButtonText: {
    color: COLORS.toolsGold,
    fontSize: veryCompact ? sf(8.2) : sf(8.8),
    fontWeight: '700',
  },

  gridExpanded: {
    marginTop: veryCompact ? sv(-2) : 0,
  },

  moreToolsButton: {
    marginTop: veryCompact ? sv(4) : sv(8),
    marginBottom: veryCompact ? sv(4) : sv(6),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: 'rgba(231,201,138,0.45)',
    backgroundColor: 'rgba(231,201,138,0.08)',
    paddingVertical: veryCompact ? sv(8) : sv(9),
    alignItems: 'center',
    justifyContent: 'center',
  },

  moreToolsText: {
    color: COLORS.toolsGold,
    fontSize: sf(12),
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  editPanel: {
    marginTop: sv(4),
    marginBottom: sv(8),
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

  editDoneButton: {
    marginTop: sv(8),
    alignSelf: 'flex-start',
    borderRadius: s(999),
    backgroundColor: COLORS.toolsGold,
    paddingHorizontal: s(12),
    paddingVertical: sv(6),
  },

  editDoneText: {
    color: COLORS.black,
    fontSize: sf(10.5),
    fontWeight: '900',
  },

  mentorCard: {
    marginTop: veryCompact ? sv(4) : compact ? sv(6) : sv(8),
    borderRadius: s(10),
    overflow: 'hidden',
  },

  mentorCardImage: {
    borderRadius: s(10),
  },

  mentorOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: veryCompact ? sv(8) : compact ? sv(10) : sv(12),
    paddingLeft: '34%',
    paddingRight: compact ? s(10) : s(12),
    backgroundColor: 'rgba(0,0,0,0.16)',
  },

  mentorLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  mentorTextBox: {
    flex: 1,
  },

  mentorTitle: {
    color: COLORS.toolsText,
    fontSize: veryCompact ? sf(11.5) : compact ? sf(12.2) : sf(13.2),
    fontWeight: '500',
    marginBottom: compact ? sv(1) : sv(2),
    letterSpacing: 0.1,
  },

  mentorDescription: {
    color: 'rgba(255,241,210,0.55)',
    fontSize: veryCompact ? sf(8.2) : compact ? sf(8.7) : sf(9.3),
    fontWeight: '400',
    lineHeight: veryCompact ? sf(10.5) : compact ? sf(11.2) : sf(12.4),
  },

  mentorButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.32)',
    borderRadius: 999,
    paddingVertical: compact ? sv(5) : sv(6),
    paddingHorizontal: compact ? s(8) : s(10),
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  mentorButtonText: {
    color: 'rgba(255,241,210,0.82)',
    fontSize: compact ? sf(8.6) : sf(9.2),
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  trackerSection: {
    marginTop: veryCompact ? sv(6) : compact ? sv(8) : sv(10),
    paddingHorizontal: s(2),
  },

  trackerTitle: {
    color: COLORS.toolsText,
    fontSize: veryCompact ? sf(12.5) : compact ? sf(13.2) : sf(14.5),
    fontWeight: '500',
    marginBottom: compact ? sv(1) : sv(2),
    letterSpacing: 1,
  },

  trackerSubtitle: {
    color: 'rgba(255,241,210,0.48)',
    fontSize: veryCompact ? sf(9.2) : compact ? sf(9.8) : sf(10.5),
    fontWeight: '400',
    marginBottom: veryCompact ? sv(7) : compact ? sv(9) : sv(11),
  },

  trackerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: s(8),
    height: veryCompact ? sv(82) : compact ? sv(96) : sv(112),
  },
  allToolsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: veryCompact ? sv(10) : compact ? sv(12) : sv(16),
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
    paddingBottom: sv(24),
  },

  allToolsHeader: {
    alignItems: 'center',
    marginBottom: veryCompact ? sv(12) : compact ? sv(14) : sv(18),
    paddingHorizontal: s(8),
  },
  selectedOrderList: {
    marginTop: sv(10),
    gap: sv(7),
  },

  selectedOrderItem: {
    minHeight: sv(38),
    borderRadius: s(10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(10),
  },

  selectedOrderIndex: {
    width: s(22),
    color: COLORS.toolsGold,
    fontSize: sf(11),
    fontWeight: '900',
  },

  selectedOrderTitle: {
    flex: 1,
    color: COLORS.toolsText,
    fontSize: sf(12),
    fontWeight: '700',
  },

  selectedOrderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },

  selectedOrderButton: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.26)',
    backgroundColor: 'rgba(231,201,138,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedOrderButtonDisabled: {
    opacity: 0.35,
  },
  replacePanel: {
    marginTop: sv(4),
    marginBottom: sv(8),
    borderRadius: s(12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.30)',
    backgroundColor: 'rgba(231,201,138,0.07)',
    paddingHorizontal: s(12),
    paddingVertical: sv(10),
  },

  replacePanelTitle: {
    color: COLORS.toolsGold,
    fontSize: sf(12.5),
    fontWeight: '900',
    marginBottom: sv(3),
  },

  replacePanelText: {
    color: 'rgba(255,241,210,0.62)',
    fontSize: sf(10.3),
    lineHeight: sf(14),
  },

  replaceCancelButton: {
    marginTop: sv(8),
    alignSelf: 'flex-start',
    borderRadius: s(999),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: s(12),
    paddingVertical: sv(6),
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  replaceCancelText: {
    color: COLORS.toolsText,
    fontSize: sf(10.5),
    fontWeight: '800',
  },
});