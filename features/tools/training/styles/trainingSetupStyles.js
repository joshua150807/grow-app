import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

export const trainingSetupStyles = {
    // ── Setup: Day Card ───────────────────────────────────────────────────────
  setupDayCard: {
    backgroundColor: 'rgba(18, 13, 25, 0.72)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(18),
    padding: s(14),
    marginBottom: sv(12),
  },
  setupDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    marginBottom: sv(12),
  },
  setupDayNameInput: {
    flex: 1,
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(12),
    paddingHorizontal: s(14),
    paddingVertical: sv(10),
    color: COLORS.textPrimary,
    fontSize: sf(14),
    fontWeight: '600',
  },

  // ── Setup: Exercise Row ───────────────────────────────────────────────────
  setupExerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
    marginBottom: sv(10),
    paddingBottom: sv(10),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDeep,
  },
  setupExerciseInputs: {
    flex: 1,
    gap: sv(6),
  },
  setupExerciseNameInput: {
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(12),
    paddingHorizontal: s(12),
    paddingVertical: sv(8),
    color: COLORS.textPrimary,
    fontSize: sf(13),
  },
  setupExerciseDetailsRow: {
    flexDirection: 'row',
    gap: s(6),
  },
  setupExerciseSmallInput: {
    flex: 1,
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(12),
    paddingHorizontal: s(10),
    paddingVertical: sv(8),
    color: COLORS.textPrimary,
    fontSize: sf(13),
    textAlign: 'center',
  },
  setupExerciseNoteInput: {
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(12),
    paddingHorizontal: s(12),
    paddingVertical: sv(8),
    color: COLORS.textMuted,
    fontSize: sf(12),
  },
  setupExerciseDeleteBtn: {
    paddingTop: sv(10),
  },

  // ── Setup: Add Buttons ────────────────────────────────────────────────────
  setupAddExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingVertical: sv(8),
    paddingHorizontal: s(4),
    marginTop: sv(4),
  },
  setupAddExerciseBtnText: {
    color: COLORS.softGold,
    fontSize: sf(13),
    fontWeight: '600',
  },
  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    height: sv(50),
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: COLORS.goldBorderLight,
    marginTop: sv(4),
    marginBottom: sv(16),
  },
  addDayBtnText: {
    color: COLORS.softGold,
    fontSize: sf(14),
    fontWeight: '700',
  },
};