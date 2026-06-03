import { StyleSheet } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';
import {
  SLOT_HEIGHT,
  TIME_LABEL_WIDTH,
} from '../utils/plannerUtils';

export const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  backgroundImage: {
    opacity: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },

  // ─── Day view ──────────────────────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    top: sv(54),
    left: s(16),
    zIndex: 10,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingVertical: sv(6),
    paddingRight: s(10),
  },

  backText: {
    color: COLORS.softGold,
    fontSize: sf(16),
    fontWeight: '700',
  },

  dayHeaderRow: {
    paddingTop: sv(108),
    paddingHorizontal: s(20),
    paddingBottom: sv(14),
    backgroundColor: 'rgba(0,0,0,0.24)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(127,98,54,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  addPlusBtn: {
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.08)',
  },

  dayHeaderText: {
    color: COLORS.paleGold,
    fontSize: sf(16),
    fontWeight: '700',
  },

  timeline: {
    position: 'relative',
  },

  slotRow: {
    height: SLOT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  timeLabelWrap: {
    width: TIME_LABEL_WIDTH,
    justifyContent: 'flex-start',
    paddingTop: sv(2),
    paddingLeft: s(14),
  },

  timeLabel: {
    color: COLORS.textDim,
    fontSize: sf(10),
    fontWeight: '500',
  },

  slotHour: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },

  slotHalf: {
    flex: 1,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.03)',
  },

  // ─── States ─────────────────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: s(20),
  },

  errorText: {
    color: COLORS.white,
    fontSize: sf(16),
    textAlign: 'center',
    marginBottom: sv(12),
  },

  retryBtn: {
    backgroundColor: COLORS.white,
    paddingHorizontal: s(16),
    paddingVertical: sv(10),
    borderRadius: s(10),
  },

  retryBtnText: {
    color: COLORS.black,
    fontWeight: '600',
  },

  pressedSoft: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },

  pressedCircle: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },

  pressedButton: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});