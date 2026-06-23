import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

export const trainingBaseStyles = {
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // ── Loading / Error ───────────────────────────────────────────────────────
  centered: {
    flex: 1,
    backgroundColor: 'transparent',
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
    paddingHorizontal: s(18),
    paddingVertical: sv(10),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: 'rgba(220,50,50,0.36)',
    backgroundColor: 'rgba(180,30,30,0.10)',
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
    paddingTop: sv(116),
    paddingHorizontal: s(20),
    paddingBottom: sv(120),
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: sv(22),
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: sf(28),
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: sf(13),
    textAlign: 'center',
    marginTop: sv(7),
    lineHeight: sf(18),
  },

  // ── Section Labels ────────────────────────────────────────────────────────
  sectionLabel: {
    color: COLORS.textDim,
    fontSize: sf(11),
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: sv(9),
    textTransform: 'uppercase',
  },

  // ── Text Inputs ───────────────────────────────────────────────────────────
  input: {
    backgroundColor: 'rgba(8, 7, 14, 0.66)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(14),
    paddingHorizontal: s(16),
    paddingVertical: sv(13),
    color: COLORS.textPrimary,
    fontSize: sf(15),
  },

  // ── Save Button ───────────────────────────────────────────────────────────
  saveBtn: {
    height: sv(52),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.goldBorderLight,
    backgroundColor: 'rgba(10, 9, 17, 0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sv(8),
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    color: COLORS.softGold,
    fontSize: sf(15),
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
    paddingVertical: sv(44),
    gap: sv(8),
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: sf(15),
    fontWeight: '600',
  },
};
