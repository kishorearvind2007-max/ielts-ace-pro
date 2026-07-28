# Design Document: Partial Score Persistence

## Overview

This design implements per-module score persistence for the Test Craft IELTS application. Currently, test scores are only saved after all four modules are completed in a single session. This feature enables:

1. **Incremental persistence**: Each module score is saved to MongoDB immediately upon completion
2. **Session resumption**: Users can close the browser and return to see their saved progress
3. **Fresh test starts**: Users can begin a new test attempt while preserving previous results

The design extends the existing `TestAttempt` model with a `moduleScores` field, adds two new API routes for per-module submission and session retrieval, and updates the client-side `TestProvider` and `HomeScreen` components to support partial score display and resumption.

## Architecture

### High-Level Flow

```
User completes module
    ↓
TestProvider.submitModule()
    ↓
Dispatch ADD_RESULT (local state)
    ↓
POST /api/test-attempts/[testId]/submit-module (fire-and-forget)
    ↓
Update TestAttempt.moduleScores.<module> via MongoDB dot-notation
    ↓
If all 4 modules complete → auto-calculate overall, set status=COMPLETED
```

### Session Resumption Flow

```
User returns to app (page load)
    ↓
TestProvider mounts
    ↓
GET /api/test-attempts/active
    ↓
If active attempt exists → dispatch SET_SESSION_ID + LOAD_RESULTS
    ↓
HomeScreen renders with persisted scores
```

### New Test Flow

```
User completes all 4 modules
    ↓
HomeScreen shows "Start New Test" button
    ↓
User clicks → Inline confirmation
    ↓
User confirms → dispatch RESET_ALL (clears sessionId, results)
    ↓
User starts any module → new TestAttempt created
    ↓
Old TestAttempt remains in DB with status=COMPLETED
```

## Components and Interfaces

### 1. Database Schema Extension

**File:** `src/lib/testing/types.ts`

Add new type:

```typescript
export type ModuleScores = {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
};
```

**File:** `src/lib/testing/test-attempt-model.ts`

Extend `TestAttempt` interface:

```typescript
export interface TestAttempt {
  // ... existing fields
  moduleScores?: ModuleScores | null;  // NEW: per-module persistence
}
```

Update Mongoose schema:

```typescript
const testAttemptSchema = new Schema<TestAttempt>({
  // ... existing fields
  moduleScores: {
    type: Schema.Types.Mixed,
    default: null,
  },
});
```

**Default value:** `null` for new documents (represents "never attempted")

**MongoDB dot-notation updates:**
- `{ $set: { 'moduleScores.listening': 6.5 } }` — updates only the listening field
- Other fields (reading, writing, speaking, overall) remain at their prior values (null or previously set)

### 2. Per-Module Submission API

**Route:** `POST /api/test-attempts/[testId]/submit-module`

**File:** `src/app/api/test-attempts/[testId]/submit-module/route.ts`

**Request body:**

```typescript
{
  module: 'listening' | 'reading' | 'writing' | 'speaking',
  band: number,  // 0.0 - 9.0
  moduleResult: object  // FinalizedListeningScore | FinalizedReadingScore | etc.
}
```

**Request validator (Zod):**

File: `src/lib/testing/validators.ts`

```typescript
export const submitModuleSchema = z.object({
  module: z.enum(['listening', 'reading', 'writing', 'speaking']),
  band: z.number().finite().min(0).max(9),
  moduleResult: z.object({}).passthrough(),  // Flexible structure
});
```

**Processing logic:**

1. **Authenticate:** Call `getSessionUserFromRequest()` to get authenticated user
2. **Authorize:** Query TestAttempt by testId/sessionId + studentId match
3. **Guard:** Verify `status === 'IN_PROGRESS'` and `resultLocked !== true`
4. **Update:** Use MongoDB `findByIdAndUpdate` with dot-notation:
   ```typescript
   {
     $set: {
       [`moduleScores.${module}`]: band,
       [`moduleResults.${module}`]: moduleResult
     }
   }
   ```
5. **Auto-finalize:** After update, check if all 4 moduleScores are non-null:
   - Calculate `overall = calculateOverallBand([l, r, w, s])`
   - Update: `{ $set: { 'moduleScores.overall': overall, status: 'COMPLETED', resultLocked: true, completedAt: new Date() } }`
   - Populate `finalScores` for backward compatibility:
     ```typescript
     finalScores: {
       listening: moduleScores.listening,
       reading: moduleScores.reading,
       writing: moduleScores.writing,
       speaking: moduleScores.speaking,
       overallBand: overall
     }
     ```

**Response:**

```typescript
{
  success: true,
  moduleScores: ModuleScores,
  status: 'IN_PROGRESS' | 'COMPLETED'
}
```

**Error cases:**
- 401: Not authenticated
- 403: User does not own this TestAttempt
- 400: Test already finalized (resultLocked=true) or status not IN_PROGRESS
- 400: Invalid module name or band out of range

### 3. Active Attempt Retrieval API

**Route:** `GET /api/test-attempts/active`

**File:** `src/app/api/test-attempts/active/route.ts`

**Query logic:**

```typescript
const activeAttempt = await TestAttemptModel.findOne({
  studentId: user._id,
  $or: [
    { status: 'IN_PROGRESS' },
    { status: 'COMPLETED', resultLocked: true }
  ]
})
.sort({ createdAt: -1 })  // Most recent first
.lean();
```

**Response when found:**

```typescript
{
  sessionId: string,
  status: 'IN_PROGRESS' | 'COMPLETED',
  moduleScores: ModuleScores,
  moduleResults: {
    listening?: FinalizedListeningScore,
    reading?: FinalizedReadingScore,
    writing?: FinalizedWritingScore,
    speaking?: FinalizedSpeakingScore
  }
}
```

**Response when not found:**

```typescript
{
  sessionId: null,
  moduleScores: null
}
```

**Purpose:** Called on TestProvider mount to hydrate saved progress.

### 4. TestProvider Updates

**File:** `src/components/ielts/TestProvider.tsx`

**State additions:**

```typescript
type State = {
  // ... existing fields
  sessionLoaded: boolean;  // NEW: prevents re-hydration
};
```

**Actions:**

```typescript
type Action =
  | { type: 'SET_SESSION_LOADED'; loaded: boolean }
  | { type: 'LOAD_SESSION'; sessionId: string; results: ModuleResult[] }
  | ... existing actions;
```

**Reducer updates:**

```typescript
case 'LOAD_SESSION':
  if (state.sessionLoaded) return state;  // Prevent overwrite
  return {
    ...state,
    sessionId: action.sessionId,
    results: action.results,
    sessionLoaded: true
  };

case 'SET_SESSION_LOADED':
  return { ...state, sessionLoaded: action.loaded };
```

**Mount effect (session hydration):**

```typescript
useEffect(() => {
  if (!user || isDemoMode || state.sessionLoaded) return;

  const loadSession = async () => {
    try {
      const response = await fetch('/api/test-attempts/active');
      const data = await response.json();

      if (data.sessionId && data.moduleScores) {
        const results: ModuleResult[] = [];
        
        // Map moduleScores to ModuleResult[]
        if (data.moduleScores.listening !== null) {
          results.push({
            module: 'listening',
            band: data.moduleScores.listening,
            // ... map from data.moduleResults.listening
          });
        }
        // Repeat for reading, writing, speaking

        dispatch({ type: 'LOAD_SESSION', sessionId: data.sessionId, results });
      }

      dispatch({ type: 'SET_SESSION_LOADED', loaded: true });
    } catch (error) {
      console.error('Failed to load active attempt:', error);
      dispatch({ type: 'SET_SESSION_LOADED', loaded: true });
    }
  };

  loadSession();
}, [user, isDemoMode, state.sessionLoaded]);
```

**submitModule update:**

Remove the "wait until all 4 modules then finalize" logic. Replace with per-module submission:

```typescript
const submitModule = async (module: string, result: ModuleResult) => {
  dispatch({ type: 'ADD_RESULT', result });

  // Fire-and-forget per-module persistence
  if (!isDemoMode && state.sessionId) {
    try {
      await fetch(`/api/test-attempts/${state.sessionId}/submit-module`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          band: result.band,
          moduleResult: result  // Full result object
        })
      });
    } catch (error) {
      console.error('Failed to submit module:', error);
      // Non-blocking: user can continue even if this fails
    }
  }
};
```

**resetAll update:**

No changes needed — already clears sessionId and results.

### 5. HomeScreen Certificate Unlock Panel

**File:** `src/components/ielts/HomeScreen.tsx`

**Current logic (broken):**

```typescript
const allDone = results.length === 4;
```

**New logic:**

```typescript
const moduleScores: ModuleScores = {
  listening: results.find(r => r.module === 'listening')?.band ?? null,
  reading: results.find(r => r.module === 'reading')?.band ?? null,
  writing: results.find(r => r.module === 'writing')?.band ?? null,
  speaking: results.find(r => r.module === 'speaking')?.band ?? null,
  overall: null  // Calculated server-side
};

const hasAllModuleBands = 
  moduleScores.listening !== null &&
  moduleScores.reading !== null &&
  moduleScores.writing !== null &&
  moduleScores.speaking !== null;

const completedCount = [
  moduleScores.listening,
  moduleScores.reading,
  moduleScores.writing,
  moduleScores.speaking
].filter(b => b !== null).length;

const remainingCount = 4 - completedCount;
```

**UI updates:**

1. **Band display:** Already handles `--` for missing modules (keep existing logic)
2. **Helper text:** Show when `!hasAllModuleBands`:
   ```tsx
   {!hasAllModuleBands && (
     <p className="text-sm text-muted-foreground">
       {completedCount} of 4 modules completed — finish {remainingCount} more to unlock certificate generation.
     </p>
   )}
   ```
3. **Button state:**
   ```tsx
   <Button disabled={!hasAllModuleBands}>
     Generate Certificate
   </Button>
   ```

### 6. Start New Test Button

Add to HomeScreen when all modules complete:

```tsx
{hasAllModuleBands && (
  <div className="mt-4 border-t pt-4">
    {!confirmNewTest ? (
      <Button onClick={() => setConfirmNewTest(true)}>
        Start New Test
      </Button>
    ) : (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Starting a new test will begin a fresh attempt. Your current results are saved.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleConfirmNewTest}>Confirm</Button>
          <Button variant="outline" onClick={() => setConfirmNewTest(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )}
  </div>
)}
```

**State:**

```typescript
const [confirmNewTest, setConfirmNewTest] = useState(false);
```

**Handler:**

```typescript
const handleConfirmNewTest = () => {
  resetAll();  // Clears sessionId and results
  setConfirmNewTest(false);
  // Next module start will create a new TestAttempt
};
```

### 7. Certificate Generation Gate

**File:** `src/app/api/certificates/generate/route.ts`

**Current logic:** Reads from `TestAttempt.finalScores`

**New guard (add at the beginning):**

```typescript
// Verify all modules completed
if (!attempt.moduleScores || 
    attempt.moduleScores.listening === null ||
    attempt.moduleScores.reading === null ||
    attempt.moduleScores.writing === null ||
    attempt.moduleScores.speaking === null ||
    attempt.moduleScores.overall === null) {
  return NextResponse.json(
    { error: 'INCOMPLETE_MODULES', message: 'All four modules must be completed before certificate generation.' },
    { status: 400 }
  );
}
```

**Backward compatibility:** The submit-module endpoint populates `finalScores` when the 4th module is submitted, so existing certificate generation logic continues to work.

## Data Models

### ModuleScores Type

```typescript
export type ModuleScores = {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
};
```

**Semantics:**
- `null`: Module not attempted
- `number`: Band score (0.0 - 9.0)
- `overall`: Calculated by `calculateOverallBand([l, r, w, s])` when all 4 are non-null

### TestAttempt Schema Update

```typescript
{
  sessionId: string;
  studentId: ObjectId;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'VOID';
  modules: AttemptModuleContent;
  submissions: AttemptSubmissions;
  moduleScores?: ModuleScores | null;       // NEW
  moduleResults?: FinalizedAttemptResult;   // Existing
  finalScores?: TestSessionFinalScores;     // Existing (populated for backward compat)
  resultLocked: boolean;
  certificateIssued: boolean;
  completedAt?: Date;
  finalizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Migration:** Not needed — Mongoose default handles `moduleScores: null` for existing documents.

### API Request/Response Schemas

**Submit Module Request:**

```typescript
{
  module: 'listening' | 'reading' | 'writing' | 'speaking',
  band: number,
  moduleResult: FinalizedListeningScore | FinalizedReadingScore | FinalizedWritingScore | FinalizedSpeakingScore
}
```

**Active Attempt Response:**

```typescript
{
  sessionId: string | null,
  status?: 'IN_PROGRESS' | 'COMPLETED',
  moduleScores: ModuleScores | null,
  moduleResults?: Partial<FinalizedAttemptResult>
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Overall band calculation correctness

*For any* four valid module band scores (listening, reading, writing, speaking in range 0-9), when all four are set in a TestAttempt, the stored overall band SHALL equal `calculateOverallBand([listening, reading, writing, speaking])`.

**Validates: Requirements 1.4**

### Property 2: Module score field isolation

*For any* module (listening, reading, writing, speaking) and any valid band score, when that module is submitted via the submit-module endpoint, only that module's score SHALL be updated in the TestAttempt document, and all other module scores SHALL remain at their prior values (null or previously set).

**Validates: Requirements 6.5, 8.4**

### Property 3: Score display correctness

*For any* ModuleScores object with any combination of null and numeric values, the Certificate_Unlock panel SHALL display each non-null score as its numeric band value, and each null score as "--".

**Validates: Requirements 3.1, 3.2**

### Property 4: Overall band display correctness

*For any* four valid module band scores, when all four are non-null in the UI state, the displayed overall band SHALL equal `calculateOverallBand([listening, reading, writing, speaking])`.

**Validates: Requirements 3.3**

### Property 5: Helper text accuracy

*For any* ModuleScores object with k null values (where 1 ≤ k ≤ 4), the Certificate_Unlock panel helper text SHALL indicate that k modules remain to be completed.

**Validates: Requirements 3.4**

### Property 6: Certificate button disabling

*For any* ModuleScores object where at least one module score is null, the certificate generation button SHALL be disabled.

**Validates: Requirements 3.5**

### Property 7: Certificate generation rejection

*For any* TestAttempt where at least one of the four module scores (listening, reading, writing, speaking) is null, OR the overall score is null, the certificate generation API route SHALL reject the request with status 400 and error code INCOMPLETE_MODULES.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 8: Input validation for submit-module endpoint

*For any* valid module name (listening, reading, writing, speaking) and band score in range [0, 9], the submit-module endpoint SHALL accept the request and return success. *For any* invalid module name or band score outside [0, 9], the endpoint SHALL reject the request with status 400.

**Validates: Requirements 6.2**

### Property 9: Active attempt response round-trip

*For any* Active_Attempt in the database with any combination of module scores, the GET /api/test-attempts/active endpoint SHALL return a response containing the exact same sessionId, status, and moduleScores as stored in the database.

**Validates: Requirements 7.3**

### Property 10: Most recent attempt selection

*For any* set of Active_Attempt documents with different createdAt timestamps, the GET /api/test-attempts/active endpoint SHALL return the attempt with the maximum createdAt value.

**Validates: Requirements 7.5**

### Property 11: Session hydration correctness

*For any* moduleScores object returned by the active attempt API, the TestProvider SHALL hydrate the application state with ModuleResult[] that contains exactly the same band scores for each non-null module.

**Validates: Requirements 2.2, 10.2**

### Property 12: Session hydration idempotence

*For any* initial loaded state, calling the session hydration logic a second time with different API data SHALL NOT change the state (hydration happens only once per session load).

**Validates: Requirements 10.3**

## Error Handling

### API Error Responses

**Submit Module Endpoint:**
- **401 Unauthorized:** Missing or invalid authentication token
- **403 Forbidden:** User does not own the specified TestAttempt
- **400 Bad Request (ALREADY_FINALIZED):** Test has status COMPLETED with resultLocked=true
- **400 Bad Request (INVALID_MODULE):** Module name not in [listening, reading, writing, speaking]
- **400 Bad Request (INVALID_BAND):** Band score outside [0, 9]
- **404 Not Found:** TestAttempt with specified sessionId/testId does not exist
- **500 Internal Server Error:** Database operation failed

**Active Attempt Endpoint:**
- **401 Unauthorized:** Missing or invalid authentication token
- **500 Internal Server Error:** Database query failed

**Certificate Generation Endpoint:**
- **400 Bad Request (INCOMPLETE_MODULES):** One or more module scores are null
- **400 Bad Request (NOT_LOCKED):** Test results not locked (resultLocked=false)
- **404 Not Found:** No TestAttempt found for user

### Client-Side Error Handling

**Session Hydration Failure:**
- Log error to console
- Set `sessionLoaded: true` to prevent infinite retry
- Continue with empty state (graceful degradation)

**Submit Module Failure:**
- Log error to console
- Do NOT block user from continuing (fire-and-forget)
- User's in-memory state remains valid
- Retry can happen on next module submit or page refresh

**New Test Confirmation:**
- No server call during confirmation
- resetAll() is synchronous and cannot fail
- Next module start creates new attempt (standard flow)

## Testing Strategy

### Integration Tests (Primary Testing Approach)

This feature involves substantial I/O (MongoDB writes, API calls, React state management) and infrastructure coordination. Integration tests are the primary strategy:

1. **Per-Module Persistence:** Complete each of the 4 modules, query TestAttempt from DB, assert moduleScores field contains expected bands
2. **Auto-Finalization:** Submit 4th module score, verify TestAttempt has overall band set and status=COMPLETED
3. **Session Resumption:** Create an Active_Attempt in DB, mount TestProvider, verify state is hydrated with correct scores
4. **Certificate Generation Gate:** Attempt to generate certificate with incomplete modules, verify 400/INCOMPLETE_MODULES error
5. **New Test Flow:** Complete all 4 modules, trigger "Start New Test" confirmation, start a module, verify new TestAttempt created and old one remains in DB with status=COMPLETED
6. **Backward Compatibility:** Complete all 4 modules via submit-module, verify finalScores populated correctly, call existing certificate generation route

### Property-Based Tests (Computation Logic)

For pure computation logic that does not involve I/O:

1. **Property 1 (Overall band calculation):** Generate random sets of 4 module bands (0-9), verify overall = calculateOverallBand([l, r, w, s])
2. **Property 3 (Score display):** Generate random ModuleScores with mix of null/numeric, render Certificate_Unlock, verify each non-null shows band and each null shows "--"
3. **Property 4 (Overall band display):** Generate random 4 module bands, verify displayed overall matches calculateOverallBand
4. **Property 5 (Helper text accuracy):** Generate ModuleScores with k nulls, verify helper text mentions k remaining
5. **Property 6 (Button disabling):** Generate ModuleScores with at least one null, verify button is disabled
6. **Property 8 (Input validation):** Generate valid and invalid module names and band scores, verify endpoint accepts/rejects correctly
7. **Property 11 (Hydration correctness):** Generate random moduleScores, hydrate state, verify ModuleResult[] matches API data

### Unit Tests (Specific Examples and Edge Cases)

1. **Schema Defaults:** Create TestAttempt without moduleScores, verify default is null
2. **Authentication Guards:** Call submit-module without auth token, verify 401; with wrong user's token, verify 403
3. **Status Guards:** Call submit-module on COMPLETED attempt, verify rejection
4. **Empty State:** Query active attempt API with no attempts in DB, verify `{ sessionId: null, moduleScores: null }`
5. **UI Rendering:** Render HomeScreen with all 4 scores set, verify "Start New Test" button visible
6. **Confirmation Flow:** Simulate "Start New Test" button click, verify confirmation text appears, click Confirm, verify state cleared

### Testing Configuration

**Property-Based Testing Library:** fast-check (TypeScript/JavaScript)

**Minimum Iterations:** 100 per property test

**Tag Format:** Each property test MUST include a comment:

```typescript
// Feature: partial-score-persistence, Property 1: For any four valid module band scores...
test('overall band calculation correctness', () => {
  fc.assert(
    fc.property(
      fc.float({ min: 0, max: 9 }),
      fc.float({ min: 0, max: 9 }),
      fc.float({ min: 0, max: 9 }),
      fc.float({ min: 0, max: 9 }),
      (listening, reading, writing, speaking) => {
        // Test implementation
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Environment

- **Unit/Property Tests:** Jest with mocked fetch and MongoDB
- **Integration Tests:** Playwright with test database
- **Database:** MongoDB test instance with isolated collections per test
- **Auth:** Mocked JWT tokens with test user IDs

## Implementation Notes

### No Migration Needed

Existing TestAttempt documents do not have `moduleScores` field. Mongoose will return `null` for this field when querying old documents, which is the correct "never attempted" state. No data migration is required.

### Fire-and-Forget Submit

The `submitModule` call in TestProvider is non-blocking:

```typescript
fetch('/api/test-attempts/[testId]/submit-module', { ... })
  .catch(error => console.error('Failed to submit module:', error));
```

If the API call fails, the user can continue with in-memory state. The score will be re-submitted on the next module or on page refresh (session hydration will detect the missing score and allow re-submission).

### Auto-Finalization Logic

The submit-module endpoint auto-finalizes when all 4 modules are complete:

1. After updating `moduleScores.<module>`, re-fetch the document
2. Check if all 4 module scores are non-null
3. If yes:
   - Calculate overall
   - Update status, resultLocked, completedAt
   - Populate finalScores for backward compatibility

This eliminates the need for a separate finalization route.

### Session Hydration Race Condition

The `sessionLoaded` flag prevents race conditions:

- On mount, session hydration starts asynchronously
- If user starts a module before hydration completes, the module creates a new TestAttempt (sessionId is null)
- Once hydration completes, `sessionLoaded: true` prevents overwriting the newly created sessionId

This is acceptable behavior: if the user starts a module before hydration, they're starting a fresh test. The old attempt remains in the database and can be resumed by navigating away and back.

### Backward Compatibility Guarantee

The `finalScores` field is populated when the 4th module is submitted. This ensures:

- Certificate generation route (unchanged) continues to work
- Historical TestAttempt documents (pre-moduleScores) remain valid
- Gradual migration: old finalization route can be deprecated later

### IndexedDB / LocalStorage

This design does NOT use browser storage (IndexedDB, LocalStorage). All persistence is server-side in MongoDB. This ensures:

- Scores are tied to user account (accessible across devices)
- No stale client-side data
- Simpler implementation (no sync logic)

### Demo Mode

Demo mode (no authentication) continues to work:

- `isDemoMode` check skips all API calls
- In-memory state works as before
- No persistence for demo users

## Dependencies

### External Libraries
- **Mongoose** (existing): MongoDB ODM for schema and queries
- **Zod** (existing): Request body validation
- **fast-check**: Property-based testing library (NEW)

### Internal Modules
- `src/lib/scoring.ts`: `calculateOverallBand()`, `roundIELTS()`
- `src/lib/testing/finalize-service.ts`: Module result computation (unchanged)
- `src/lib/testing/certificate-eligibility.ts`: Certificate validation (unchanged)
- `src/app/api/auth/middleware.ts`: `getSessionUserFromRequest()`

### New Files
- `src/app/api/test-attempts/[testId]/submit-module/route.ts`
- `src/app/api/test-attempts/active/route.ts`

### Modified Files
- `src/lib/testing/types.ts` (add ModuleScores)
- `src/lib/testing/test-attempt-model.ts` (add moduleScores field)
- `src/lib/testing/validators.ts` (add submitModuleSchema)
- `src/components/ielts/TestProvider.tsx` (session hydration, per-module submit)
- `src/components/ielts/HomeScreen.tsx` (UI updates, Start New Test button)
- `src/app/api/certificates/generate/route.ts` (add INCOMPLETE_MODULES guard)
