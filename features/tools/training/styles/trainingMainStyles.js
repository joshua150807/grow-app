import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

export const trainingMainStyles = {
  setupChoiceCard: {
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(16),
    padding: s(18),
    marginBottom: sv(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(16),
  },

  setupChoiceCardIconWrap: {
    width: s(52),
    height: s(52),
    borderRadius: s(26),
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  setupChoiceCardContent: {
    flex: 1,
  },

  setupChoiceCardTitle: {
    color: COLORS.paleGold,
    fontSize: sf(15),
    fontWeight: '700',
    marginBottom: sv(2),
  },

  setupChoiceCardDesc: {
    color: COLORS.textDim,
    fontSize: sf(12),
  },

  presetCard: {
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(16),
    padding: s(16),
    marginBottom: sv(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(14),
  },

  presetCardIconWrap: {
    width: s(48),
    height: s(48),
    borderRadius: s(24),
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  presetCardContent: {
    flex: 1,
  },

  presetCardName: {
    color: COLORS.paleGold,
    fontSize: sf(14),
    fontWeight: '700',
    marginBottom: sv(1),
  },

  presetCardDesc: {
    color: COLORS.textDim,
    fontSize: sf(11),
    marginBottom: sv(3),
  },

  presetCardBadge: {
    color: COLORS.softGold,
    fontSize: sf(11),
    fontWeight: '600',
  },

  dayCardRenameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginBottom: sv(12),
  },

  dayCardRenameInput: {
    flex: 1,
    backgroundColor: COLORS.darkCard,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: s(10),
    paddingHorizontal: s(12),
    paddingVertical: sv(8),
    color: COLORS.textPrimary,
    fontSize: sf(15),
    fontWeight: '700',
  },

  trainingMainBanner: {
    minHeight: sv(112),
    borderRadius: s(20),
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    padding: s(18),
    marginBottom: sv(22),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  trainingMainBannerTitle: {
    color: COLORS.paleGold,
    fontSize: sf(22),
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  trainingMainBannerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    marginTop: sv(6),
  },

  muscleGroupSection: {
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
    width: s(64),
    height: s(64),
    borderRadius: s(18),
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sv(8),
  },

  muscleGroupLabel: {
    color: COLORS.textMuted,
    fontSize: sf(11),
    fontWeight: '600',
    textAlign: 'center',
  },

  lastSessionsBanner: {
    minHeight: sv(104),
    borderRadius: s(18),
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(18),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  lastSessionsTitle: {
    color: COLORS.paleGold,
    fontSize: sf(18),
    fontWeight: '800',
  },

  lastSessionsSubtitle: {
    color: COLORS.textDim,
    fontSize: sf(13),
    marginTop: sv(6),
    maxWidth: s(240),
  },
};