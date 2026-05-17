import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

export const trainingOverviewStyles = {
  // ── Overview: Days List ───────────────────────────────────────────────────
  daysList: {
    gap: sv(14),
  },

  // ── Overview: Day Card ────────────────────────────────────────────────────
  dayCard: {
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(16),
    padding: s(16),
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sv(12),
  },
  dayCardTitle: {
    color: COLORS.paleGold,
    fontSize: sf(15),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayCardCount: {
    color: COLORS.textDim,
    fontSize: sf(12),
    fontWeight: '500',
  },
  dayCardEmpty: {
    color: COLORS.textFaint,
    fontSize: sf(13),
    marginBottom: sv(8),
  },

  // ── Overview: Exercise List ───────────────────────────────────────────────
  exerciseList: {
    gap: sv(8),
    marginBottom: sv(8),
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.darkCard,
    borderRadius: s(12),
    paddingHorizontal: s(14),
    paddingVertical: sv(10),
    borderWidth: 1,
    borderColor: COLORS.borderDeep,
    gap: s(8),
  },
  exerciseItemMain: {
    flex: 1,
    gap: sv(3),
  },
  exerciseItemName: {
    color: COLORS.textPrimary,
    fontSize: sf(14),
    fontWeight: '600',
  },
  exerciseItemDetails: {
    flexDirection: 'row',
    gap: s(10),
    alignItems: 'center',
  },
  exerciseItemWeight: {
    color: COLORS.gold,
    fontSize: sf(12),
    fontWeight: '600',
  },
  exerciseItemSetsReps: {
    color: COLORS.textMuted,
    fontSize: sf(12),
  },
  exerciseItemNote: {
    color: COLORS.textFaint,
    fontSize: sf(11),
    fontStyle: 'italic',
    marginTop: sv(2),
  },

  // ── Overview: Add Exercise to Day ─────────────────────────────────────────
  addExerciseToDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingVertical: sv(6),
    paddingTop: sv(10),
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDeep,
    marginTop: sv(4),
  },
  addExerciseToDayBtnText: {
    color: COLORS.softGold,
    fontSize: sf(12),
    fontWeight: '600',
  },
};