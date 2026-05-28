import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

export const trainingModalStyles = {
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(20),
  },

  modalContainer: {
    width: '100%',
    maxHeight: '86%',
    backgroundColor: COLORS.darkCard2,
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(18),
  },

  modalHeader: {
    marginBottom: sv(16),
  },

  modalTitle: {
    color: COLORS.paleGold,
    fontSize: sf(18),
    fontWeight: '800',
  },

  modalLabel: {
    color: COLORS.textDim,
    fontSize: sf(11),
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: sv(6),
    marginTop: sv(10),
  },

  modalInput: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: s(12),
    paddingHorizontal: s(14),
    paddingVertical: sv(12),
    color: COLORS.textPrimary,
    fontSize: sf(14),
  },

  modalTextArea: {
    minHeight: sv(90),
    textAlignVertical: 'top',
  },

  modalRow: {
    flexDirection: 'row',
    gap: s(10),
  },

  modalRowSpacer: {
    flex: 1,
  },

  modalError: {
    color: COLORS.error,
    fontSize: sf(12),
    marginTop: sv(10),
  },

  modalSaveBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: s(12),
    paddingVertical: sv(13),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sv(16),
  },

  modalSaveBtnText: {
    color: COLORS.background,
    fontSize: sf(14),
    fontWeight: '800',
  },

  modalDeleteBtn: {
    borderWidth: 1,
    borderColor: 'rgba(220,50,50,0.45)',
    borderRadius: s(12),
    paddingVertical: sv(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sv(10),
  },

  modalDeleteBtnText: {
    color: COLORS.error,
    fontSize: sf(13),
    fontWeight: '700',
  },
};