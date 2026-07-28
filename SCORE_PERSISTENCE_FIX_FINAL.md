# Final Fix: Score Persistence and Certificate Generation

## Issues Identified

### 1. Primary Issue: Module Results Not Saving
**Error**: `MongoServerError: Cannot create field 'listening' in element {moduleResults: null}`

**Root Cause**: 
- Old test attempts have `moduleResults: null`
- MongoDB cannot use dot notation (e.g., `moduleResults.listening`) when the parent field is `null`
- The code was trying to set nested fields without first initializing the parent as an object

**Impact**:
- Module scores (listening, reading, writing, speaking) not persisting to database
- Test status remaining as "IN_PROGRESS" instead of "COMPLETED"
- Certificate generation failing due to missing completed test data

### 2. Secondary Issue: Questions Not Matching Test
**Observation**: The test attempt document contains different questions than what appeared in the actual test

**Likely Cause**: The test questions are generated dynamically each time and stored in the test attempt document, but if the page is refreshed or re-generated, new questions are created.

## Solutions Implemented

### Fix 1: Update Schema Default (Prevents Future Issues)

**File**: `src/lib/testing/test-attempt-model.ts`

Changed `moduleResults` default from `null` to `{}`:
```typescript
moduleResults: {
  type: Schema.Types.Mixed,
  default: () => ({}),  // Was: default: null
},
```

**Impact**: All new test attempts will have `moduleResults: {}` and won't encounter the error.

### Fix 2: Handle Null Module Results in Submit Route

**File**: `src/app/api/test-attempts/[testId]/submit-module/route.ts`

Enhanced the update logic to check if `moduleResults` is null and initialize it as an empty object before setting nested fields:

```typescript
const needsModuleResultsInit = !attempt.moduleResults || attempt.moduleResults === null;

if (needsModuleResultsInit) {
  updateOperation.moduleResults = {};
}

if (needsModuleResultsInit) {
  (updateOperation.moduleResults as Record<string, unknown>)[module] = moduleResult;
} else {
  updateOperation[`moduleResults.${module}`] = moduleResult;
}
```

**Impact**: Both old (null) and new (object) test attempts will work correctly.

### Fix 3: Add moduleResults to Type Definition

**File**: `src/app/api/test-attempts/[testId]/submit-module/route.ts`

Added `moduleResults` field to `AttemptLookup` type:
```typescript
type AttemptLookup = {
  _id: unknown;
  sessionId?: string;
  testId?: string;
  status: string;
  resultLocked?: boolean;
  moduleScores?: ModuleScores | null;
  moduleResults?: unknown;  // Added this field
};
```

**Impact**: Type safety ensures we can check this field without TypeScript errors.

## Migration Required for Existing Test

The existing test attempt (TST-20260727-569AE90A-91HX) still has `moduleResults: null`.

### Quick Fix via MongoDB:

```javascript
// Connect to MongoDB and run:
db.testattempts.updateMany(
  { moduleResults: null },
  { $set: { moduleResults: {} } }
)
```

This will fix all existing test attempts with null moduleResults.

### Alternative: Delete and Restart

```javascript
// Delete the problematic test:
db.testattempts.deleteOne({ sessionId: "TST-20260727-569AE90A-91HX" })
```

Then start a new test from the dashboard.

## Certificate Generation Flow

Once the score persistence is fixed, the certificate generation should work automatically:

1. ✅ Complete all 4 modules (listening, reading, writing, speaking)
2. ✅ Scores saved to `moduleScores` and `moduleResults`
3. ✅ Test status updated to "COMPLETED"
4. ✅ `resultLocked` set to `true`
5. ✅ `completedAt` timestamp recorded
6. ✅ Dashboard shows "Generate Certificate" button
7. ✅ Certificate generation endpoint creates PDF
8. ✅ Certificate stored in database with `certificateIssued` flag

## Files Modified

1. `src/lib/testing/test-attempt-model.ts` - Schema default changed
2. `src/app/api/test-attempts/[testId]/submit-module/route.ts` - Handle null moduleResults
3. `scripts/fix-null-module-results.mjs` - Migration script created
4. `scripts/run-fix-module-results.cmd` - Helper batch file created
5. `package.json` - Added migration npm script

## Testing Recommendations

### Test New Flow:
1. Start a new test
2. Complete listening module → Verify score saves
3. Complete reading module → Verify score saves
4. Complete writing module → Verify score saves
5. Complete speaking module → Verify all scores save and test completes
6. Verify certificate generation button appears
7. Generate certificate → Verify PDF is created

### Test Old Flow (After Migration):
1. Run MongoDB update command to fix existing test
2. Navigate to the test and complete any remaining modules
3. Verify certificate generation works

## Expected Behavior After Fix

✅ Module scores persist correctly to database
✅ Test status updates to "COMPLETED" when all modules are done
✅ Dashboard shows correct scores for each module
✅ Certificate generation button becomes active
✅ Certificate PDF generates with correct scores and student details
✅ No more "Cannot create field" MongoDB errors

## Monitoring

Watch for these log messages to confirm successful operation:

```
[submit-module] Looking up test attempt
[submit-module] Found attempt
[submit-module] Performing update with operation
[submit-module] Update completed successfully
```

If you see errors, check:
1. MongoDB connection is working
2. moduleResults is initialized as `{}` not `null`
3. Environment variables are set correctly
