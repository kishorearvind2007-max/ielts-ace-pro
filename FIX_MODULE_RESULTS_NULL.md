# Fix for "Cannot create field in element {moduleResults: null}" Error

## Problem

When completing test modules, you're encountering this MongoDB error:
```
MongoServerError: Cannot create field 'listening' in element {moduleResults: null}
```

This happens because older test attempts have `moduleResults: null` instead of `moduleResults: {}` (empty object).

## Solution

### Option 1: Quick Manual Fix (Recommended)

1. Open MongoDB Compass or mongosh
2. Connect to your database: `ielts_ace_pro`
3. Open the `testattempts` collection
4. Run this update command:

```javascript
db.testattempts.updateMany(
  { moduleResults: null },
  { $set: { moduleResults: {} } }
)
```

This will update all test attempts with null `moduleResults` to have an empty object instead.

### Option 2: Delete and Restart Test

If you prefer to start fresh:

1. Delete the problematic test attempt:
```javascript
db.testattempts.deleteOne({ sessionId: "TST-20260727-569AE90A-91HX" })
```

2. Start a new test from the dashboard

### Option 3: Run Migration Script

A migration script is available at `scripts/fix-null-module-results.mjs`, but it requires proper environment setup.

To run it:
```bash
# Windows CMD
set MONGODB_URI=mongodb+srv://deepeshcdm_db_user:DMKS123@dkms.661vl4h.mongodb.net/?appName=DKMS
set MONGODB_DB_NAME=ielts_ace_pro
node scripts/fix-null-module-results.mjs
```

## Verification

After applying the fix, verify the change:

```javascript
db.testattempts.findOne({ sessionId: "TST-20260727-569AE90A-91HX" })
```

Check that `moduleResults` is now `{}` instead of `null`.

## What Was Fixed in the Code

1. **Schema Default Changed**: `test-attempt-model.ts` now initializes `moduleResults` as `{}` instead of `null` for new test attempts
2. **Submit Route Enhanced**: `submit-module/route.ts` now handles both old (null) and new (object) test attempts by initializing `moduleResults` as an empty object before setting nested fields
3. **Type Safety**: Added `moduleResults` to the `AttemptLookup` type

## Prevention

All new test attempts created after this fix will have `moduleResults: {}` by default, preventing this error from occurring again.
