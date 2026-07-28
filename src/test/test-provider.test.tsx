/** @jest-environment jsdom */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { TestProvider, useTest } from '@/components/ielts/TestProvider';
import * as fc from 'fast-check';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'student-1',
      registerNumber: '24UCS046',
      email: 'student@example.com',
      fullName: 'Student One',
    },
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('TestProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestProvider>{children}</TestProvider>
  );

  describe('LOAD_SESSION Idempotence', () => {
    /**
     * Property 12: Session hydration idempotence
     * Validates: Requirements 10.3
     * Dispatch LOAD_SESSION with initial data, then dispatch LOAD_SESSION again with different data;
     * verify state reflects only the first dispatch
     */
    it('property: LOAD_SESSION is idempotent (first dispatch wins)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionId1: fc.string({ minLength: 10, maxLength: 30 }),
            sessionId2: fc.string({ minLength: 10, maxLength: 30 }),
            band1: fc.double({ min: 0, max: 9, noNaN: true }),
            band2: fc.double({ min: 0, max: 9, noNaN: true }),
          }),
          async (testData) => {
            const { result } = renderHook(() => useTest(), { wrapper });

            // First LOAD_SESSION dispatch
            act(() => {
              result.current.dispatch({
                type: 'LOAD_SESSION',
                sessionId: testData.sessionId1,
                results: [
                  {
                    module: 'listening',
                    band: testData.band1,
                  },
                ],
              });
            });

            const firstSessionId = result.current.state.sessionId;
            const firstBand = result.current.state.results[0]?.band;

            // Second LOAD_SESSION dispatch with different data
            act(() => {
              result.current.dispatch({
                type: 'LOAD_SESSION',
                sessionId: testData.sessionId2,
                results: [
                  {
                    module: 'reading',
                    band: testData.band2,
                  },
                ],
              });
            });

            // State should still reflect the first dispatch
            expect(result.current.state.sessionId).toBe(firstSessionId);
            expect(result.current.state.sessionId).toBe(testData.sessionId1);
            expect(result.current.state.results[0]?.band).toBe(firstBand);
            expect(result.current.state.results[0]?.band).toBe(testData.band1);
            expect(result.current.state.results[0]?.module).toBe('listening');
            expect(result.current.state.sessionLoaded).toBe(true);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('unit: first LOAD_SESSION succeeds, second is ignored', () => {
      const { result } = renderHook(() => useTest(), { wrapper });

      act(() => {
        result.current.dispatch({
          type: 'LOAD_SESSION',
          sessionId: 'SESSION-001',
          results: [{ module: 'listening', band: 7.0 }],
        });
      });

      expect(result.current.state.sessionId).toBe('SESSION-001');
      expect(result.current.state.results).toHaveLength(1);
      expect(result.current.state.sessionLoaded).toBe(true);

      act(() => {
        result.current.dispatch({
          type: 'LOAD_SESSION',
          sessionId: 'SESSION-002',
          results: [{ module: 'reading', band: 6.5 }],
        });
      });

      // State should not change
      expect(result.current.state.sessionId).toBe('SESSION-001');
      expect(result.current.state.results).toHaveLength(1);
      expect(result.current.state.results[0]?.module).toBe('listening');
    });
  });

  describe('Session Hydration Correctness', () => {
    /**
     * Property 11: Session hydration correctness
     * Validates: Requirements 2.2, 10.2
     * For any moduleScores with any combination of null and numeric values from the API,
     * the hydrated ModuleResult[] must contain exactly the same band scores for each non-null module
     */
    it('property: hydrated results match API moduleScores', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            listening: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            reading: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            writing: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            speaking: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
          }),
          async (moduleScores) => {
            // Mock the fetch call that happens during hydration
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                sessionId: 'TEST-SESSION',
                moduleScores: {
                  ...moduleScores,
                  overall: null,
                },
                moduleResults: {},
              }),
            });

            const { result, rerender } = renderHook(() => useTest(), { wrapper });

            // Wait for hydration effect
            await act(async () => {
              await new Promise(resolve => setTimeout(resolve, 50));
              rerender();
            });

            // Verify that hydrated results contain correct bands for non-null modules
            const modules = ['listening', 'reading', 'writing', 'speaking'] as const;
            for (const mod of modules) {
              const band = moduleScores[mod];
              const hydratedResult = result.current.state.results.find(r => r.module === mod);

              if (band !== null) {
                expect(hydratedResult).toBeDefined();
                expect(hydratedResult?.band).toBe(band);
              } else {
                expect(hydratedResult).toBeUndefined();
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
