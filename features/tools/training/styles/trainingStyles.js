import { StyleSheet } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Loading / Error ───────────────────────────────────────────────────────
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sv(16),
    paddingHorizontal: s(32),
  },
  loadingText: {
    color: COLORS.textDim,
    fontSize: sf(14),
    textAlign: 'center',
    marginTop: sv(12),
  },
  errorText: {
    color: COLORS.error,
    fontSize: sf(14),
    textAlign: 'center',
    fontWeight: '600',
  },
  retryBtn: {
    paddingHorizontal: s(20),
    paddingVertical: sv(10),
    borderRadius: s(10),
    borderWidth: 1,
    borderColor: 'rgba(220,50,50,0.5)',
  },
  retryText: {
    color: COLORS.error,
    fontSize: sf(13),
    fontWeight: '700',
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    top: sv(54),
    left: s(16),
    right: s(16),
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  backText: {
    color: COLORS.softGold,
    fontSize: sf(16),
    fontWeight: '600',
  },
  deletePlanBtn: {
    padding: s(4),
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    paddingTop: sv(110),
    paddingHorizontal: s(20),
    paddingBottom: sv(120),
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: sv(28),
  },
  iconCircle: {
    width: s(80),
    height: s(80),
    borderRadius: s(40),
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sv(16),
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  title: {
    color: COLORS.paleGold,
    fontSize: sf(26),
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    textAlign: 'center',
    marginTop: sv(6),
  },

  // ── Section Labels ────────────────────────────────────────────────────────
  sectionLabel: {
    color: COLORS.textDim,
    fontSize: sf(11),
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: sv(8),
  },

  // ── Text Inputs ───────────────────────────────────────────────────────────
  input: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(12),
    paddingHorizontal: s(16),
    paddingVertical: sv(14),
    color: COLORS.textPrimary,
    fontSize: sf(15),
  },

  // ── Setup: Day Card ───────────────────────────────────────────────────────
  setupDayCard: {
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(14),
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
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(10),
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
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.borderDeep,
    borderRadius: s(10),
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
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.borderDeep,
    borderRadius: s(10),
    paddingHorizontal: s(10),
    paddingVertical: sv(8),
    color: COLORS.textPrimary,
    fontSize: sf(13),
    textAlign: 'center',
  },
  setupExerciseNoteInput: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.borderDeep,
    borderRadius: s(10),
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
    borderRadius: s(14),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.goldBorder,
    marginTop: sv(4),
    marginBottom: sv(16),
  },
  addDayBtnText: {
    color: COLORS.gold,
    fontSize: sf(14),
    fontWeight: '700',
  },

  // ── Save Button ───────────────────────────────────────────────────────────
  saveBtn: {
    height: sv(52),
    borderRadius: s(14),
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sv(8),
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    color: COLORS.black,
    fontSize: sf(16),
    fontWeight: '800',
  },

  // ── Save Error ────────────────────────────────────────────────────────────
  saveErrorText: {
    color: COLORS.error,
    fontSize: sf(13),
    textAlign: 'center',
    marginTop: sv(10),
  },

  // ── Empty State ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: sv(48),
    gap: sv(8),
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: sf(15),
    fontWeight: '600',
  },

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

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.darkCard2,
    borderTopLeftRadius: s(24),
    borderTopRightRadius: s(24),
    paddingHorizontal: s(20),
    paddingTop: sv(20),
    paddingBottom: sv(52),
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sv(20),
  },
  modalTitle: {
    color: COLORS.paleGold,
    fontSize: sf(18),
    fontWeight: '700',
  },
  modalLabel: {
    color: COLORS.textDim,
    fontSize: sf(11),
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: sv(6),
    marginTop: sv(14),
  },
  modalInput: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(12),
    paddingHorizontal: s(16),
    paddingVertical: sv(12),
    color: COLORS.textPrimary,
    fontSize: sf(15),
  },
  modalTextArea: {
    minHeight: sv(80),
    textAlignVertical: 'top',
    paddingTop: sv(10),
  },
  modalRow: {
    flexDirection: 'row',
  },
  modalRowSpacer: {
    width: s(12),
  },
  modalError: {
    color: COLORS.error,
    fontSize: sf(13),
    marginTop: sv(10),
    textAlign: 'center',
  },
  modalSaveBtn: {
    height: sv(52),
    borderRadius: s(14),
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sv(24),
  },
  modalSaveBtnText: {
    color: COLORS.black,
    fontSize: sf(16),
    fontWeight: '800',
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    height: sv(48),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: 'rgba(220,50,50,0.4)',
    marginTop: sv(10),
  },
  modalDeleteBtnText: {
    color: COLORS.error,
    fontSize: sf(14),
    fontWeight: '600',
  },

  // ── Setup: Choice Screen ──────────────────────────────────────────────────
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

  // ── Setup: Preset Selection ───────────────────────────────────────────────
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

  // ── Day Card: Inline Rename ──────────────────────────────────────────────
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
  startTrainingBanner: {
    minHeight: sv(112),
    borderRadius: s(20),
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.gold,
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
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(14),
  },

  startTrainingContent: {
    flex: 1,
  },

  startTrainingTitle: {
    color: COLORS.paleGold,
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
    borderRadius: s(18),
    backgroundColor: COLORS.darkCard2,
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
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(14),
  },

  trainingDaySelectContent: {
    flex: 1,
  },

  trainingDaySelectTitle: {
    color: COLORS.paleGold,
    fontSize: sf(17),
    fontWeight: '800',
  },

  trainingDaySelectSubtitle: {
    color: COLORS.textDim,
    fontSize: sf(13),
    marginTop: sv(4),
  },
  sessionExerciseCard: {
    borderRadius: s(18),
    backgroundColor: COLORS.darkCard2,
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
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    color: COLORS.gold,
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
    color: COLORS.paleGold,
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
    backgroundColor: COLORS.darkCard,
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
    backgroundColor: COLORS.darkCard,
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
    backgroundColor: COLORS.darkCard2,
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
    backgroundColor: COLORS.gold,
    marginRight: s(12),
  },

  lastSessionContent: {
    flex: 1,
  },

  lastSessionTitle: {
    color: COLORS.paleGold,
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
    borderRadius: s(18),
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(16),
    marginBottom: sv(12),
    flexDirection: 'row',
    alignItems: 'center',
  },

  trainingSessionCardIcon: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(14),
  },

  trainingSessionCardContent: {
    flex: 1,
  },

  trainingSessionCardTitle: {
    color: COLORS.paleGold,
    fontSize: sf(17),
    fontWeight: '800',
  },

  trainingSessionCardMeta: {
    color: COLORS.textDim,
    fontSize: sf(13),
    marginTop: sv(4),
  },
  trainingSessionCard: {
    minHeight: sv(78),
    borderRadius: s(18),
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(16),
    marginBottom: sv(12),
    flexDirection: 'row',
    alignItems: 'center',
  },

  trainingSessionCardIcon: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(14),
  },

  trainingSessionCardContent: {
    flex: 1,
  },

  trainingSessionCardTitle: {
    color: COLORS.paleGold,
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
    backgroundColor: COLORS.darkCard2,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(16),
    marginBottom: sv(20),
  },

  trainingSessionDetailNoteTitle: {
    color: COLORS.paleGold,
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
    borderRadius: s(18),
    backgroundColor: COLORS.darkCard2,
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
});
