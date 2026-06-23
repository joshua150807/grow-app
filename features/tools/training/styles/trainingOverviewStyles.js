import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

export const trainingOverviewStyles = {
  // ── Overview: Days List ───────────────────────────────────────────────────
  daysList: {
    gap: sv(14),
  },

  // ── Overview: Day Card ────────────────────────────────────────────────────
  dayCard: {
    backgroundColor: 'rgba(18, 13, 25, 0.72)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(20),
    padding: s(16),
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sv(12),
  },
  dayCardTitle: {
    color: COLORS.textPrimary,
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
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderRadius: s(14),
    paddingHorizontal: s(14),
    paddingVertical: sv(10),
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
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
    color: COLORS.softGold,
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
    // ── Muscle Group Exercise Directory ───────────────────────────────────────
  muscleExerciseHeader: {
    alignItems: 'center',
    marginBottom: sv(24),
  },

  muscleExerciseHeaderCompact: {
    alignItems: 'center',
    marginTop: sv(-2),
    marginBottom: sv(22),
    paddingHorizontal: s(8),
  },

  muscleExerciseSubtitle: {
    color: COLORS.textDim,
    fontSize: sf(13),
    textAlign: 'center',
    marginTop: sv(8),
    lineHeight: sf(19),
    paddingHorizontal: s(8),
  },

  muscleGroupInfoCardList: {
    gap: sv(0),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },

  exerciseSectionHeaderWrap: {
    alignItems: 'center',
    marginTop: sv(28),
    marginBottom: sv(12),
  },

  exerciseSectionTitle: {
    color: COLORS.textPrimary,
    fontSize: sf(18),
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  exerciseDirectoryList: {
    gap: sv(0),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },

  exerciseDirectoryItem: {
    minHeight: sv(86),
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sv(14),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: s(14),
  },

  exerciseDirectoryIcon: {
    width: s(56),
    height: s(56),
    borderRadius: s(16),
    backgroundColor: 'rgba(18, 13, 25, 0.72)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  exerciseDirectoryContent: {
    flex: 1,
    gap: sv(4),
  },

  exerciseDirectoryName: {
    color: COLORS.textPrimary,
    fontSize: sf(18),
    fontWeight: '800',
  },

  exerciseDirectoryCategory: {
    color: COLORS.textMuted,
    fontSize: sf(14),
    fontWeight: '700',
  },
    // ── Exercise Detail ───────────────────────────────────────────────────────
  exerciseDetailHeader: {
    alignItems: 'center',
    marginBottom: sv(22),
    paddingHorizontal: s(8),
  },

  exerciseDetailHeaderCompact: {
    alignItems: 'center',
    marginTop: sv(-10),
    marginBottom: sv(22),
  },

  exerciseDetailCategory: {
    color: COLORS.textDim,
    fontSize: sf(15),
    fontWeight: '700',
    marginTop: sv(6),
  },

  exerciseDetailCard: {
    backgroundColor: 'rgba(13, 9, 19, 0.74)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(20),
    padding: s(16),
    marginBottom: sv(14),
  },

  exerciseDetailSectionTitle: {
    color: COLORS.textMuted,
    fontSize: sf(15),
    fontWeight: '800',
    marginBottom: sv(10),
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  exerciseDetailText: {
    color: COLORS.textPrimary,
    fontSize: sf(15),
    lineHeight: sf(22),
    fontWeight: '500',
  },

  exerciseDetailBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(12),
    marginBottom: sv(12),
  },

  exerciseDetailBullet: {
    width: s(26),
    height: s(26),
    borderRadius: s(13),
    backgroundColor: 'rgba(231,201,138,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sv(1),
  },

  exerciseDetailBulletNumber: {
    color: COLORS.textPrimary,
    fontSize: sf(13),
    fontWeight: '900',
  },

  exerciseDetailBulletText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: sf(15),
    lineHeight: sf(22),
    fontWeight: '500',
  },

  exerciseDetailTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(10),
    marginBottom: sv(10),
  },

  exerciseDetailTipText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: sf(15),
    lineHeight: sf(21),
    fontWeight: '500',
  },

  muscleAnatomyImagePlaceholder: {
    minHeight: sv(220),
    borderRadius: s(22),
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    backgroundColor: 'rgba(10, 9, 17, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sv(14),
    gap: sv(10),
  },

  muscleAnatomyImageText: {
    color: COLORS.textDim,
    fontSize: sf(14),
    fontWeight: '700',
  },


  anatomyPosterScreen: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },

  anatomyPosterImage: {
    marginTop: sv(100),
  },

  anatomyPosterBackButton: {
    position: 'absolute',
    top: sv(44),
    left: s(18),
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sv(8),
    paddingRight: s(14),
  },

  anatomyPosterBackText: {
    color: COLORS.softGold,
    fontSize: sf(16),
    fontWeight: '600',
    marginLeft: s(2),
  },

};