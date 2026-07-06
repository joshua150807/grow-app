import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

export const trainingSessionStyles = {
  startTrainingBanner: {
    minHeight: sv(108),
    borderRadius: s(22),
    backgroundColor: 'rgba(10, 9, 17, 0.72)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(18),
    marginBottom: sv(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  startTrainingIconWrap: {
    width: s(48),
    height: s(48),
    borderRadius: s(24),
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(14),
  },

  startTrainingContent: {
    flex: 1,
  },

  startTrainingTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(21),
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  startTrainingSubtitle: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    marginTop: sv(5),
    lineHeight: sf(18),
  },

  trainingDaySelectCard: {
    minHeight: sv(82),
    borderRadius: s(20),
    backgroundColor: 'rgba(10, 9, 17, 0.68)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(16),
    marginBottom: sv(12),
    flexDirection: 'row',
    alignItems: 'center',
  },

  trainingDaySelectIconWrap: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(14),
  },

  trainingDaySelectContent: {
    flex: 1,
  },

  trainingDaySelectTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(17),
    fontWeight: '800',
  },

  trainingDaySelectSubtitle: {
    color: COLORS.textDim,
    fontSize: sf(13),
    marginTop: sv(4),
  },

  sessionExerciseCard: {
    borderRadius: s(20),
    backgroundColor: 'rgba(10, 9, 17, 0.68)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(16),
    marginBottom: sv(14),
  },

  sessionExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sv(14),
  },

  sessionExerciseIndex: {
    width: s(30),
    height: s(30),
    borderRadius: s(15),
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    color: COLORS.softGold,
    fontSize: sf(13),
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: s(28),
    marginRight: s(12),
  },

  sessionExerciseTitleWrap: {
    flex: 1,
  },

  sessionExerciseName: {
    color: COLORS.textPrimary,
    fontSize: sf(17),
    fontWeight: '800',
  },

  sessionExerciseHint: {
    color: COLORS.textDim,
    fontSize: sf(12),
    marginTop: sv(4),
  },

  sessionInputRow: {
    flexDirection: 'row',
    gap: s(10),
    marginBottom: sv(12),
  },

  sessionInputGroup: {
    flex: 1,
  },

  sessionInputLabel: {
    color: COLORS.textDim,
    fontSize: sf(11),
    fontWeight: '700',
    marginBottom: sv(6),
    textTransform: 'uppercase',
  },

  sessionSmallInput: {
    minHeight: sv(44),
    borderRadius: s(12),
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    color: COLORS.textPrimary,
    fontSize: sf(15),
    fontWeight: '700',
    paddingHorizontal: s(12),
  },

  sessionNoteInput: {
    minHeight: sv(54),
    borderRadius: s(12),
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    color: COLORS.textPrimary,
    fontSize: sf(13),
    paddingHorizontal: s(12),
    paddingVertical: sv(10),
    textAlignVertical: 'top',
  },

  sessionOverallNoteInput: {
    minHeight: sv(84),
    borderRadius: s(14),
    backgroundColor: 'rgba(18, 13, 25, 0.72)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    color: COLORS.textPrimary,
    fontSize: sf(14),
    paddingHorizontal: s(14),
    paddingVertical: sv(12),
    textAlignVertical: 'top',
    marginBottom: sv(16),
  },

  lastSessionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sv(12),
  },

  lastSessionsList: {
    gap: sv(10),
    marginTop: sv(4),
  },

  lastSessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sv(8),
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },

  lastSessionDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: 'rgba(231,201,138,0.16)',
    marginRight: s(12),
  },

  lastSessionContent: {
    flex: 1,
  },

  lastSessionTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(15),
    fontWeight: '800',
  },

  lastSessionMeta: {
    color: COLORS.textDim,
    fontSize: sf(12),
    marginTop: sv(3),
  },

  lastSessionsEmpty: {
    color: COLORS.textDim,
    fontSize: sf(13),
    marginTop: sv(6),
    lineHeight: sf(18),
  },

  lastSessionsError: {
    color: COLORS.error,
    fontSize: sf(13),
    marginTop: sv(6),
    lineHeight: sf(18),
  },

  trainingSessionCard: {
    minHeight: sv(78),
    borderRadius: s(20),
    backgroundColor: 'rgba(10, 9, 17, 0.68)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(16),
    marginBottom: sv(12),
    flexDirection: 'row',
    alignItems: 'center',
  },

  trainingSessionCardOpenArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  trainingSessionDeleteButton: {
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.22)',
    marginLeft: s(10),
  },

  trainingSessionCardIcon: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(14),
  },

  trainingSessionCardContent: {
    flex: 1,
  },

  trainingSessionCardTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(17),
    fontWeight: '800',
  },

  trainingSessionCardMeta: {
    color: COLORS.textDim,
    fontSize: sf(13),
    marginTop: sv(4),
  },

  trainingSessionCardNote: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    marginTop: sv(8),
    lineHeight: sf(18),
  },

  trainingSessionDetailNoteBox: {
    borderRadius: s(16),
    backgroundColor: 'rgba(18, 13, 25, 0.72)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(16),
    marginBottom: sv(20),
  },

  trainingSessionDetailNoteTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(14),
    fontWeight: '800',
    marginBottom: sv(6),
  },

  trainingSessionDetailNoteText: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    lineHeight: sf(18),
  },

  trainingSessionExerciseCard: {
    borderRadius: s(20),
    backgroundColor: 'rgba(10, 9, 17, 0.68)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(16),
    marginBottom: sv(12),
  },

  trainingSessionExerciseNote: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    lineHeight: sf(18),
    marginTop: sv(8),
  },


  pauseScreen: {
    flex: 1,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(28),
    fontWeight: '900',
    marginBottom: sv(24),
  },
  pauseTimer: {
    color: COLORS.softGold,
    fontSize: sf(72),
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  pauseStartButton: {
    minHeight: sv(44),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sv(-4),
    marginBottom: sv(14),
  },
  pauseStartButtonText: {
    color: COLORS.softGold,
    fontSize: sf(13),
    fontWeight: '800',
  },
  sectionSecondaryButton: {
    minHeight: sv(48),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sv(10),
  },
  sectionSecondaryButtonText: {
    color: COLORS.softGold,
    fontSize: sf(14),
    fontWeight: '800',
  },
};
