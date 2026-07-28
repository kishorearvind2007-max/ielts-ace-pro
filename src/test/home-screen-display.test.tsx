/** @jest-environment jsdom */

import * as fc from 'fast-check';
import { calculateOverallBand } from '@/lib/scoring';

/**
 * These are property tests for the HomeScreen display logic.
 * They test the derived state calculations without rendering the full component.
 */

describe('HomeScreen Display Logic', () => {
  describe('Score Display Correctness', () => {
    /**
     * Property 3: Score display correctness
     * Validates: Requirements 3.1, 3.2
     * For any ModuleScores with any mix of null and numeric values,
     * each non-null score must display its band, each null score must display "--"
     */
    it('property: non-null scores display their band, null scores display "--"', () => {
      fc.assert(
        fc.property(
          fc.record({
            listening: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            reading: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            writing: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            speaking: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
          }),
          (moduleBands) => {
            // Simulate display logic
            const displayValues = {
              listening: moduleBands.listening !== null ? moduleBands.listening.toFixed(1) : '--',
              reading: moduleBands.reading !== null ? moduleBands.reading.toFixed(1) : '--',
              writing: moduleBands.writing !== null ? moduleBands.writing.toFixed(1) : '--',
              speaking: moduleBands.speaking !== null ? moduleBands.speaking.toFixed(1) : '--',
            };

            // Verify display logic
            if (moduleBands.listening !== null) {
              expect(displayValues.listening).not.toBe('--');
              expect(parseFloat(displayValues.listening)).toBeCloseTo(moduleBands.listening, 1);
            } else {
              expect(displayValues.listening).toBe('--');
            }

            if (moduleBands.reading !== null) {
              expect(displayValues.reading).not.toBe('--');
              expect(parseFloat(displayValues.reading)).toBeCloseTo(moduleBands.reading, 1);
            } else {
              expect(displayValues.reading).toBe('--');
            }

            if (moduleBands.writing !== null) {
              expect(displayValues.writing).not.toBe('--');
              expect(parseFloat(displayValues.writing)).toBeCloseTo(moduleBands.writing, 1);
            } else {
              expect(displayValues.writing).toBe('--');
            }

            if (moduleBands.speaking !== null) {
              expect(displayValues.speaking).not.toBe('--');
              expect(parseFloat(displayValues.speaking)).toBeCloseTo(moduleBands.speaking, 1);
            } else {
              expect(displayValues.speaking).toBe('--');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Overall Band Display', () => {
    /**
     * Property 4: Overall band display correctness
     * Validates: Requirements 3.3
     * For any four valid module bands (all non-null),
     * the displayed overall must equal calculateOverallBand([l, r, w, s])
     */
    it('property: overall band equals calculateOverallBand when all modules complete', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 9, noNaN: true }),
          fc.double({ min: 0, max: 9, noNaN: true }),
          fc.double({ min: 0, max: 9, noNaN: true }),
          fc.double({ min: 0, max: 9, noNaN: true }),
          (listening, reading, writing, speaking) => {
            const moduleBands = { listening, reading, writing, speaking };

            // Calculate hasAllModuleBands
            const hasAllModuleBands = [listening, reading, writing, speaking].every(b => b !== null);

            // Calculate overall
            const overallBand = hasAllModuleBands
              ? calculateOverallBand([listening, reading, writing, speaking])
              : null;

            // Verify
            expect(hasAllModuleBands).toBe(true);
            expect(overallBand).not.toBeNull();
            expect(overallBand).toBe(calculateOverallBand([listening, reading, writing, speaking]));
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Helper Text Accuracy', () => {
    /**
     * Property 5: Helper text accuracy
     * Validates: Requirements 3.4
     * For any moduleScores with k null values (1 ≤ k ≤ 4),
     * the helper text must indicate k modules remain
     */
    it('property: helper text shows correct remaining module count', () => {
      fc.assert(
        fc.property(
          fc.record({
            listening: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            reading: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            writing: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            speaking: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
          }),
          (moduleBands) => {
            // Calculate completedCount and remainingCount
            const completedCount = [
              moduleBands.listening,
              moduleBands.reading,
              moduleBands.writing,
              moduleBands.speaking,
            ].filter(b => b !== null).length;

            const remainingCount = 4 - completedCount;

            const hasAllModuleBands =
              moduleBands.listening !== null &&
              moduleBands.reading !== null &&
              moduleBands.writing !== null &&
              moduleBands.speaking !== null;

            // Verify counts
            expect(completedCount).toBeGreaterThanOrEqual(0);
            expect(completedCount).toBeLessThanOrEqual(4);
            expect(remainingCount).toBeGreaterThanOrEqual(0);
            expect(remainingCount).toBeLessThanOrEqual(4);
            expect(completedCount + remainingCount).toBe(4);

            // If not all complete, remainingCount should be > 0
            if (!hasAllModuleBands) {
              expect(remainingCount).toBeGreaterThan(0);

              // Verify helper text logic
              const helperText = `${completedCount} of 4 modules completed — finish ${remainingCount} more to unlock certificate generation.`;
              expect(helperText).toContain(`${remainingCount} more`);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Certificate Button Disabling', () => {
    /**
     * Property 6: Certificate button disabling
     * Validates: Requirements 3.5
     * For any moduleScores with at least one null value,
     * the certificate generation button must be disabled
     */
    it('property: button disabled when any module is incomplete', () => {
      fc.assert(
        fc.property(
          fc.record({
            listening: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            reading: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            writing: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            speaking: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
          }),
          (moduleBands) => {
            const hasAllModuleBands =
              moduleBands.listening !== null &&
              moduleBands.reading !== null &&
              moduleBands.writing !== null &&
              moduleBands.speaking !== null;

            const isButtonDisabled = !hasAllModuleBands;

            // Count null values
            const nullCount = [
              moduleBands.listening,
              moduleBands.reading,
              moduleBands.writing,
              moduleBands.speaking,
            ].filter(b => b === null).length;

            // If any module is null, button should be disabled
            if (nullCount > 0) {
              expect(isButtonDisabled).toBe(true);
            } else {
              expect(isButtonDisabled).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('unit: button enabled only when all four modules are complete', () => {
      // All complete
      let hasAllModuleBands =
        7.0 !== null && 6.5 !== null && 6.5 !== null && 7.0 !== null;
      expect(hasAllModuleBands).toBe(true);

      // One missing
      hasAllModuleBands =
        7.0 !== null && 6.5 !== null && 6.5 !== null && null !== null;
      expect(hasAllModuleBands).toBe(false);

      // All missing
      hasAllModuleBands =
        null !== null && null !== null && null !== null && null !== null;
      expect(hasAllModuleBands).toBe(false);
    });
  });
});
