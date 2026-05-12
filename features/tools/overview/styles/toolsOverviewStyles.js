import { StyleSheet } from 'react-native';
import { COLORS } from '../../../../constants/colors';
import { s, sv, sf, SCREEN } from '../../../../constants/layout';

const veryCompact = SCREEN.height < 760;
const compact = SCREEN.height < 820;

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.toolsBg ?? '#050403',
  },

  content: {
    flex: 1,
    paddingTop: sv(66),
    paddingHorizontal: s(14),
    paddingBottom: sv(72),
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
    width: s(56),
    height: s(56),
    borderRadius: s(20),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.35)',
    backgroundColor: 'rgba(231,201,138,0.045)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(12),

    shadowColor: COLORS.toolsGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },

  avatarText: {
    fontSize: sf(20),
  },

  headerTextBox: {
    flex: 1,
  },

  topLabel: {
    color: 'rgba(255,241,210,0.48)',
    fontSize: sf(9.5),
    fontWeight: '400',
    letterSpacing: 2.2,
    marginBottom: sv(2),
  },

  accountName: {
    color: COLORS.toolsText,
    fontSize: sf(19),
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
    marginRight: s(12),
  },

  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sv(2),
  },

  coinPlaceholder: {
    width: s(24),
    height: s(24),
    borderRadius: s(12),
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
    fontSize: sf(11),
    fontWeight: '500',
    textShadowColor: 'rgba(231,201,138,0.45)',
    textShadowRadius: 7,
    textShadowOffset: { width: 0, height: 0 },
  },

  pointsValue: {
    color: COLORS.toolsText,
    fontSize: sf(18),
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  pointsLabel: {
    color: 'rgba(255,241,210,0.48)',
    fontSize: sf(9),
    fontWeight: '400',
    textAlign: 'center',
  },

  menuButton: {
    marginLeft: s(10),
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
    marginBottom: veryCompact ? sv(2) : compact ? sv(4) : sv(12),
    paddingHorizontal: s(2),
  },

  sectionTitle: {
    color: COLORS.toolsText,
    fontSize: sf(21),
    fontWeight: '500',
    marginBottom: sv(4),
    letterSpacing: 1.3,
  },

  sectionSubtitle: {
    color: 'rgba(255,241,210,0.50)',
    fontSize: sf(12),
    fontWeight: '400',
    lineHeight: sf(17),
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  mentorCard: {
    marginTop: compact ? 0 : sv(4),
    marginBottom: veryCompact ? sv(2) : compact ? sv(4) : sv(10),
    borderRadius: s(10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.toolsCardBorder,
    backgroundColor: COLORS.toolsCard,
    paddingVertical: sv(8),
    paddingHorizontal: s(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sv(82),
  },

  mentorLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  mentorIconWrap: {
    width: s(42),
    height: s(42),
    borderRadius: s(14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.42)',
    backgroundColor: 'rgba(231,201,138,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(10),

    shadowColor: COLORS.toolsGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 4,
  },

  mentorTextBox: {
    flex: 1,
  },

  mentorTitle: {
    color: COLORS.toolsText,
    fontSize: sf(13.2),
    fontWeight: '500',
    marginBottom: sv(2),
    letterSpacing: 0.1,
  },

  mentorDescription: {
    color: 'rgba(255,241,210,0.55)',
    fontSize: sf(9.3),
    fontWeight: '400',
    lineHeight: sf(12.4),
  },

  mentorButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.32)',
    borderRadius: 999,
    paddingVertical: sv(6),
    paddingHorizontal: s(10),
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  mentorButtonText: {
    color: 'rgba(255,241,210,0.82)',
    fontSize: sf(9.2),
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  trackerSection: {
    flex: 1,
    marginTop: sv(4),
    paddingHorizontal: s(2),
  },

  trackerTitle: {
    color: COLORS.toolsText,
    fontSize: sf(14.5),
    fontWeight: '500',
    marginBottom: sv(2),
    letterSpacing: 1,
  },

  trackerSubtitle: {
    color: 'rgba(255,241,210,0.48)',
    fontSize: sf(10.5),
    fontWeight: '400',
    marginBottom: sv(4),
  },

  trackerRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: s(8),
    maxHeight: sv(110),
  },
});