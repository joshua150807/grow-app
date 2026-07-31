import { describe, expect, it } from 'vitest';
import { remapUnitAcrossRevisions } from '../src/modules/trainingSessions/trainingSessionCycleRemap.js';

const keyA = 'aaaaaaaa-0000-4000-8000-000000000000';
const keyB = 'bbbbbbbb-0000-4000-8000-000000000000';
const keyC = 'cccccccc-0000-4000-8000-000000000000';
const keyD = 'dddddddd-0000-4000-8000-000000000000';

describe('remapUnitAcrossRevisions', () => {
  it('reuses the same unit when its logical key still exists in the new revision', () => {
    const oldUnits = [{ id: 'old-a', orderIndex: 0, logicalUnitKey: keyA }, { id: 'old-b', orderIndex: 1, logicalUnitKey: keyB }];
    const newUnits = [{ id: 'new-a', orderIndex: 0, logicalUnitKey: keyA }, { id: 'new-b', orderIndex: 1, logicalUnitKey: keyB }];
    const result = remapUnitAcrossRevisions(oldUnits, newUnits, { orderIndex: 1, logicalUnitKey: keyB });
    expect(result).toEqual({ id: 'new-b', orderIndex: 1, logicalUnitKey: keyB });
  });

  it('falls forward to the next surviving logical key (by the old revision\'s own order) when the target key was removed', () => {
    const oldUnits = [
      { id: 'old-a', orderIndex: 0, logicalUnitKey: keyA },
      { id: 'old-b', orderIndex: 1, logicalUnitKey: keyB },
      { id: 'old-c', orderIndex: 2, logicalUnitKey: keyC },
    ];
    // keyB was removed from the new revision; keyC survives (renumbered to orderIndex 0 there).
    const newUnits = [{ id: 'new-a', orderIndex: 1, logicalUnitKey: keyA }, { id: 'new-c', orderIndex: 0, logicalUnitKey: keyC }];
    const result = remapUnitAcrossRevisions(oldUnits, newUnits, { orderIndex: 1, logicalUnitKey: keyB });
    expect(result).toEqual({ id: 'new-c', orderIndex: 0, logicalUnitKey: keyC });
  });

  it('skips further-removed keys and picks the nearest surviving successor first', () => {
    const oldUnits = [
      { id: 'old-a', orderIndex: 0, logicalUnitKey: keyA },
      { id: 'old-b', orderIndex: 1, logicalUnitKey: keyB },
      { id: 'old-c', orderIndex: 2, logicalUnitKey: keyC },
      { id: 'old-d', orderIndex: 3, logicalUnitKey: keyD },
    ];
    // Target is keyA; both keyB and keyC were removed, but keyD survives -- must pick keyD,
    // not stop early or pick something out of old order.
    const newUnits = [{ id: 'new-d', orderIndex: 0, logicalUnitKey: keyD }];
    const result = remapUnitAcrossRevisions(oldUnits, newUnits, { orderIndex: 0, logicalUnitKey: keyA });
    expect(result).toEqual({ id: 'new-d', orderIndex: 0, logicalUnitKey: keyD });
  });

  it('falls back to the new revision\'s first unit (by orderIndex) when no later key survives', () => {
    const oldUnits = [
      { id: 'old-a', orderIndex: 0, logicalUnitKey: keyA },
      { id: 'old-b', orderIndex: 1, logicalUnitKey: keyB },
    ];
    const newUnits = [{ id: 'new-c', orderIndex: 1, logicalUnitKey: keyC }, { id: 'new-d', orderIndex: 0, logicalUnitKey: keyD }];
    const result = remapUnitAcrossRevisions(oldUnits, newUnits, { orderIndex: 1, logicalUnitKey: keyB });
    expect(result).toEqual({ id: 'new-d', orderIndex: 0, logicalUnitKey: keyD });
  });

  it('never considers a key at or before the target\'s own old position as a forward fallback', () => {
    const oldUnits = [
      { id: 'old-a', orderIndex: 0, logicalUnitKey: keyA },
      { id: 'old-b', orderIndex: 1, logicalUnitKey: keyB },
      { id: 'old-c', orderIndex: 2, logicalUnitKey: keyC },
    ];
    // Target is keyB (orderIndex 1); keyC (the only later key) was removed. keyA (orderIndex
    // 0, *before* the target) still survives, but at a new position that is not the new
    // revision's first unit -- a wrong (unfiltered) implementation would find keyA via the
    // forward scan and return it; the correct one must instead fall through to the new
    // revision's genuine first unit, keyE.
    const newUnits = [{ id: 'new-a', orderIndex: 5, logicalUnitKey: keyA }, { id: 'new-e', orderIndex: 0, logicalUnitKey: keyD }];
    const result = remapUnitAcrossRevisions(oldUnits, newUnits, { orderIndex: 1, logicalUnitKey: keyB });
    expect(result).toEqual({ id: 'new-e', orderIndex: 0, logicalUnitKey: keyD });
  });
});
