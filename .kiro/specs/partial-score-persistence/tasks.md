# Implementation Plan: Partial Score Persistence

## Overview

Incremental implementation of per-module score persistence. Tasks are ordered so the data layer is established first, then API routes, then client-side integration, and finally UI updates.

## Tasks

- [x] 1. Add ModuleScores type and extend TestAttempt schema
  - [x] 1.1 Add `ModuleScores` type to `src/lib/testing/types.ts`
    - Add `ModuleScores` with five nullable number fields: listening, reading, writing, speaking, overall
    - _Requirements: 8.1, 8.2_
  - [x] 1.2 Add `moduleScores` field to TestAttempt interface and Mongoose schema in `src/lib/testing/test-attempt-model.ts`
    - Add `moduleScores?: ModuleScores | null` to the TypeScript interface
    - Add `moduleScores: { type: Schema.Types.Mixed, default: null }` to the schema definition
    - No migration needed — existing documents will return null for this field
    - _Requirements: 8.1, 8.3_
  - [x]* 1.3 Write unit tests for schema defaults
    - Verify a newly created TestAttempt document has `moduleScores` equal to null
    - _Requirements: 8.3_

- [x] 2. Add Zod validator for submit-module request
  - [x] 2.1 Add `submitModuleSchema` to `src/lib/testing/validators.ts`
    - Schema: `{ module: z.enum(['listening','reading','writing','speaking']), band: z.number().finite().min(0).max(9), moduleResult: z.object({}).passthrough() }`
    - Export `SubmitModuleInput` type inferred from the schema
    - _Requirements: 6.2_
  - [x]* 2.2 Write property test for submit-module input validation
    - **Property 8: Input validation for submit-module endpoint**
    - **Validates: Requirements 6.2**
    - Use fast-check to generate valid module names and bands 0-9, verify schema parses successfully
    - Use fast-check to generate invalid module names and out-of-range bands, verify schema rejects with errors
    - _Requirements: 6.2_

- [x] 3. Create POST /api/test-attempts/[testId]/submit-module route
  - [x] 3.1 Create `src/app/api/test-attempts/[testId]/submit-module/route.ts`
    - Authenticate via `getSessionUserFromRequest()`
    - Look up TestAttempt by testId/sessionId matching the authenticated user's studentId
    - Guard: verify `status === 'IN_PROGRESS'` and `resultLocked !== true`
    - Update via MongoDB dot-notation: `$set: { ['moduleScores.${module}']: band, ['moduleResults.${module}']: moduleResult }`
    - After update: if all 4 module scores are non-null, compute overall with `calculateOverallBand`, write `moduleScores.overall`, set `status: 'COMPLETED'`, `resultLocked: true`, `completedAt: new Date()`, populate `finalScores` for backward compatibility
    - Return `{ success: true, moduleScores, status }` on success
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 1.1, 1.4, 1.5, 9.1, 9.2_
  - [x]* 3.2 Write unit tests for authentication and status guards
    - Test 401 when no auth token provided
    - Test 403 when authenticated user does not own the TestAttempt
    - Test 400 (ALREADY_FINALIZED) when TestAttempt has `resultLocked: true`
    - Test 400 (ALREADY_FINALIZED) when TestAttempt status is COMPLETED
    - _Requirements: 6.3, 6.4_
  - [x]* 3.3 Write property test for module score field isolation
    - **Property 2: Module score field isolation**
    - **Validates: Requirements 6.5, 8.4**
    - For any module and valid band score, after submitting that module, only that module's score should change; all others must remain at prior values
    - _Requirements: 6.5_
  - [x]* 3.4 Write integration test for auto-finalization
    - Submit the 4th module score, verify TestAttempt has overall band computed, status=COMPLETED, resultLocked=true, and finalScores populated
    - _Requirements: 6.6, 1.4, 1.5, 9.1_

- [x] 4. Checkpoint — Ensure submit-module route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create GET /api/test-attempts/active route
  - [x] 5.1 Create `src/app/api/test-attempts/active/route.ts`
    - Authenticate via `getSessionUserFromRequest()`
    - Query: `TestAttemptModel.findOne({ studentId: user._id, $or: [{ status: 'IN_PROGRESS' }, { status: 'COMPLETED', resultLocked: true }] }).sort({ createdAt: -1 }).lean()`
    - Return `{ sessionId, status, moduleScores, moduleResults }` if found
    - Return `{ sessionId: null, moduleScores: null }` if not found
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x]* 5.2 Write unit test for empty state response
    - Query the endpoint with no TestAttempt documents in DB for the user
    - Verify response is `{ sessionId: null, moduleScores: null }`
    - _Requirements: 7.4_
  - [x]* 5.3 Write property test for active attempt round-trip
    - **Property 9: Active attempt response round-trip**
    - **Validates: Requirements 7.3**
    - For any Active_Attempt with any combination of module scores, the API response must contain the exact same sessionId, status, and moduleScores as stored in the database
    - _Requirements: 7.3_
  - [x]* 5.4 Write property test for most recent attempt selection
    - **Property 10: Most recent attempt selection**
    - **Validates: Requirements 7.5**
    - For any set of Active_Attempt documents with different createdAt values, the returned attempt must have the maximum createdAt value
    - _Requirements: 7.5_

- [x] 6. Update TestProvider for session hydration and per-module submission
  - [x] 6.1 Add `sessionLoaded` boolean flag to TestProvider state and reducer in `src/components/ielts/TestProvider.tsx`
    - Add `sessionLoaded: false` to initial state
    - Add `LOAD_SESSION` action (sets sessionId, results, and sessionLoaded: true — only if sessionLoaded is false)
    - Add `SET_SESSION_LOADED` action (sets sessionLoaded to true without changing results)
    - Guard the LOAD_SESSION reducer case: if `state.sessionLoaded` is already true, return state unchanged
    - _Requirements: 10.3_
  - [x] 6.2 Add mount effect for session hydration in TestProvider
    - On mount, if user is authenticated and not in demo mode and not yet loaded, call GET `/api/test-attempts/active`
    - If response has a sessionId and moduleScores, map moduleScores to ModuleResult[] and dispatch LOAD_SESSION
    - If response has sessionId: null or on error, dispatch SET_SESSION_LOADED(true)
    - Log errors to console but do not throw (graceful degradation)
    - _Requirements: 2.1, 2.2, 2.4, 10.1, 10.2_
  - [x] 6.3 Replace finalize-all-at-once logic with per-module API submission in TestProvider
    - Remove the block that waits for all 4 modules then calls the finalize endpoint
    - After each `dispatch(ADD_RESULT)`, fire-and-forget POST to `/api/test-attempts/${sessionId}/submit-module`
    - Do not await or block on this call; catch and log errors silently
    - _Requirements: 1.1, 10.4_
  - [ ]* 6.4 Write unit test for LOAD_SESSION idempotence
    - **Property 12: Session hydration idempotence**
    - **Validates: Requirements 10.3**
    - Dispatch LOAD_SESSION with initial data, then dispatch LOAD_SESSION again with different data; verify state reflects only the first dispatch
    - _Requirements: 10.3_
  - [ ]* 6.5 Write property test for session hydration correctness
    - **Property 11: Session hydration correctness**
    - **Validates: Requirements 2.2, 10.2**
    - For any moduleScores with any combination of null and numeric values from the API, the hydrated ModuleResult[] must contain exactly the same band scores for each non-null module
    - _Requirements: 2.2, 10.2_

- [x] 7. Checkpoint — Ensure provider tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update HomeScreen Certificate Unlock panel
  - [x] 8.1 Replace `results.length === 4` check with `hasAllModuleBands` computation in `src/components/ielts/HomeScreen.tsx`
    - Derive `moduleScores` object from results array (null for each module not yet in results)
    - Compute `hasAllModuleBands = all four module scores are non-null`
    - Compute `completedCount` and `remainingCount` from moduleScores
    - _Requirements: 3.1, 3.5_
  - [x] 8.2 Add helper text for partial completion
    - When `!hasAllModuleBands`, render a message: "X of 4 modules completed — finish Y more to unlock certificate generation."
    - When `hasAllModuleBands`, hide this helper text
    - _Requirements: 3.4_
  - [x] 8.3 Disable certificate generation button when any module score is null
    - Set `disabled={!hasAllModuleBands}` on the generate certificate button
    - Verify the existing `--` display for null modules remains intact
    - _Requirements: 3.5_
  - [ ]* 8.4 Write property test for score display correctness
    - **Property 3: Score display correctness**
    - **Validates: Requirements 3.1, 3.2**
    - For any ModuleScores with any mix of null and numeric values, each non-null score must display its band, each null score must display "--"
    - _Requirements: 3.1, 3.2_
  - [ ]* 8.5 Write property test for overall band display
    - **Property 4: Overall band display correctness**
    - **Validates: Requirements 3.3**
    - For any four valid module bands (all non-null), the displayed overall must equal calculateOverallBand([l, r, w, s])
    - _Requirements: 3.3_
  - [ ]* 8.6 Write property test for helper text accuracy
    - **Property 5: Helper text accuracy**
    - **Validates: Requirements 3.4**
    - For any moduleScores with k null values (1 ≤ k ≤ 4), the helper text must indicate k modules remain
    - _Requirements: 3.4_
  - [ ]* 8.7 Write property test for certificate button disabling
    - **Property 6: Certificate button disabling**
    - **Validates: Requirements 3.5**
    - For any moduleScores with at least one null value, the certificate generation button must be disabled
    - _Requirements: 3.5_

- [x] 9. Add "Start New Test" button to HomeScreen
  - [x] 9.1 Add `confirmNewTest` boolean state and handlers to `src/components/ielts/HomeScreen.tsx`
    - Add `const [confirmNewTest, setConfirmNewTest] = useState(false)`
    - Add handler `handleConfirmNewTest` that calls `resetAll()` and sets `confirmNewTest` to false
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 9.2 Render "Start New Test" button and inline confirmation UI
    - Show the button only when `hasAllModuleBands` is true
    - When `confirmNewTest` is false, show the "Start New Test" button
    - When `confirmNewTest` is true, show the confirmation message and Confirm/Cancel buttons
    - Confirmation message: "Starting a new test will begin a fresh attempt. Your current results are saved."
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 9.3 Write unit tests for Start New Test flow
    - Verify "Start New Test" button appears when all 4 modules are complete
    - Verify confirmation message appears on button click
    - Verify state is cleared after confirm (sessionId = null, results = [])
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 10. Add INCOMPLETE_MODULES guard to certificate generation route
  - [x] 10.1 Add null-check guard to `src/app/api/certificates/generate/route.ts`
    - Fetch the TestAttempt's moduleScores before proceeding
    - If `moduleScores` is null or any of the four module scores is null or overall is null, return 400 with `{ error: 'INCOMPLETE_MODULES', message: '...' }`
    - Existing logic for reading from `finalScores` remains unchanged after the guard
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ]* 10.2 Write property test for certificate generation rejection
    - **Property 7: Certificate generation rejection**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - For any moduleScores with at least one null value, the endpoint must return 400 with error code INCOMPLETE_MODULES
    - _Requirements: 4.1, 4.2_

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. End-to-end integration wiring
  - [x] 12.1 Write integration test for full partial-session flow
    - Create user, start a test, complete 2 modules via submit-module, simulate page refresh (query active attempt API), verify 2 module scores are returned and state is hydrated correctly
    - _Requirements: 1.1, 2.1, 2.2, 2.3_
  - [ ]* 12.2 Write integration test for complete-and-new-test flow
    - Complete all 4 modules, verify COMPLETED status and finalScores, trigger Start New Test, start a module, verify a new TestAttempt is created and the old one remains in DB
    - _Requirements: 5.5, 5.6, 9.3_
  - [ ]* 12.3 Write property test for overall band calculation
    - **Property 1: Overall band calculation correctness**
    - **Validates: Requirements 1.4**
    - For any four valid module band scores (0-9), after all are set, the stored overall must equal calculateOverallBand([listening, reading, writing, speaking])
    - Use fast-check to generate 4 random bands and verify the calculation
    - _Requirements: 1.4_

- [x] 13. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The submit-module API is fire-and-forget from the client; failures degrade gracefully
- No database migration is needed — null is the correct default for moduleScores
- The finalize-all-at-once route can be deprecated in a future cleanup pass

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "3.1", "5.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "5.2", "5.3", "5.4", "6.1"] },
    { "id": 4, "tasks": ["3.4", "6.2", "6.3"] },
    { "id": 5, "tasks": ["6.4", "6.5", "8.1", "10.1"] },
    { "id": 6, "tasks": ["8.2", "8.3", "9.1", "10.2"] },
    { "id": 7, "tasks": ["8.4", "8.5", "8.6", "8.7", "9.2"] },
    { "id": 8, "tasks": ["9.3", "12.1"] },
    { "id": 9, "tasks": ["12.2", "12.3"] }
  ]
}
```
