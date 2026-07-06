import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

export const trainingMainStyles = {
  setupChoiceCard: {
    backgroundColor: 'rgba(10, 9, 17, 0.68)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(20),
    padding: s(16),
    marginBottom: sv(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(14),
  },

  setupChoiceCardIconWrap: {
    width: s(48),
    height: s(48),
    borderRadius: s(24),
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  setupChoiceCardContent: {
    flex: 1,
  },

  setupChoiceCardTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(15),
    fontWeight: '800',
    marginBottom: sv(3),
  },

  setupChoiceCardDesc: {
    color: COLORS.textDim,
    fontSize: sf(12),
    lineHeight: sf(17),
  },

  presetCard: {
    backgroundColor: 'rgba(10, 9, 17, 0.68)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(18),
    padding: s(15),
    marginBottom: sv(11),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(13),
  },

  presetCardIconWrap: {
    width: s(46),
    height: s(46),
    borderRadius: s(23),
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  presetCardContent: {
    flex: 1,
  },

  presetCardName: {
    color: COLORS.textPrimary,
    fontSize: sf(14),
    fontWeight: '800',
    marginBottom: sv(2),
  },

  presetCardDesc: {
    color: COLORS.textDim,
    fontSize: sf(11),
    marginBottom: sv(4),
    lineHeight: sf(16),
  },

  presetCardBadge: {
    color: COLORS.textMuted,
    fontSize: sf(11),
    fontWeight: '700',
  },

  dayCardRenameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginBottom: sv(12),
  },

  dayCardRenameInput: {
    flex: 1,
    backgroundColor: 'rgba(8, 7, 14, 0.72)',
    borderWidth: 1,
    borderColor: COLORS.goldBorderLight,
    borderRadius: s(12),
    paddingHorizontal: s(12),
    paddingVertical: sv(9),
    color: COLORS.textPrimary,
    fontSize: sf(15),
    fontWeight: '700',
  },

  trainingMainBanner: {
    minHeight: sv(104),
    borderRadius: s(22),
    backgroundColor: 'rgba(10, 9, 17, 0.68)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(17),
    marginBottom: sv(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(14),
  },

  trainingMainBannerTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(19),
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: sf(24),
  },

  trainingMainBannerSubtitle: {
    color: COLORS.textDim,
    fontSize: sf(13),
    marginTop: sv(6),
    lineHeight: sf(18),
  },

  muscleGroupSection: {
    marginTop: sv(4),
    marginBottom: sv(22),
  },

  muscleGroupRow: {
    gap: s(12),
    paddingRight: s(20),
  },

  muscleGroupItem: {
    width: s(74),
    alignItems: 'center',
  },

  muscleGroupImagePlaceholder: {
    width: s(62),
    height: s(62),
    borderRadius: s(19),
    backgroundColor: 'rgba(10, 9, 17, 0.68)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sv(8),
  },

  muscleGroupLabel: {
    color: COLORS.textMuted,
    fontSize: sf(11),
    fontWeight: '700',
    textAlign: 'center',
  },

  lastSessionsBanner: {
    minHeight: sv(104),
    borderRadius: s(22),
    backgroundColor: 'rgba(10, 9, 17, 0.68)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(17),
    marginBottom: sv(16),
  },

  lastSessionsTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(18),
    fontWeight: '900',
  },

  lastSessionsSubtitle: {
    color: COLORS.textDim,
    fontSize: sf(13),
    marginTop: sv(6),
    maxWidth: s(240),
    lineHeight: sf(18),
  },
};
