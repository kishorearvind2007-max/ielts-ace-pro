# Troubleshooting Guide: Test Completion and Certificate Generation

## Current Issue Summary

After completing all 4 test modules (Listening, Reading, Writing, Speaking), the system shows:
- ❌ Scores NOT saved in database (all remain `null`)
- ❌ Test status remains `IN_PROGRESS` instead of `COMPLETED`
- ❌ Certificate generation fails with "No completed test found"
- ❌ Error in logs: `MongoServerError: Cannot create field 'listening' in element {moduleResults: null}`

## Root Cause

The test attempt document has `moduleResults: null` instead of `moduleResults: {}`. When the system tries to save individual module results using dot notation (`moduleResults.listening`), MongoDB rejects it because you cannot set nested properties on a `null` value.

## Step-by-Step Fix

### Step 1: Fix the Database (REQUIRED)

You need to update the existing test attempt in MongoDB. Choose ONE of these methods:

#### Method A: MongoDB Compass (Easiest)

1. Open MongoDB Compass
2. Connect to: `mongodb+srv://deepeshcdm_db_user:DMKS123@dkms.661vl4h.mongodb.net/`
3. Select database: `ielts_ace_pro`
4. Select collection: `testattempts`
5. Click on the "Aggregations" tab or use the shell
6. Run this command:

```javascript
db.testattempts.updateMany(
  { moduleResults: null },
  { $set: { moduleResults: {} } }
)
```

You should see output like:
```
{ acknowledged: true, modifiedCount: 1 }
```

#### Method B: mongosh CLI

1. Open terminal/command prompt
2. Connect to MongoDB:
```bash
mongosh "mongodb+srv://deepeshcdm_db_user:DMKS123@dkms.661vl4h.mongodb.net/ielts_ace_pro"
```
3. Run the update:
```javascript
db.testattempts.updateMany(
  { moduleResults: null },
  { $set: { moduleResults: {} } }
)
```

#### Method C: Start Fresh

If you prefer to just restart the test:

```javascript
// In MongoDB Compass or mongosh:
db.testattempts.deleteOne({ sessionId: "TST-20260727-569AE90A-91HX" })
```

Then go to the dashboard and start a new test.

### Step 2: Verify the Fix

Check that the update worked:

```javascript
db.testattempts.findOne({ sessionId: "TST-20260727-569AE90A-91HX" })
```

Look for:
```javascript
{
  ...
  "moduleResults": {},  // Should be {} not null
  "moduleScores": {
    "listening": null,
    "reading": null,
    "writing": null,
    "speaking": null,
    "overall": null
  },
  ...
}
```

### Step 3: Retake Test Modules

After fixing the database:

1. Navigate to your test: `/listening?testId=TST-20260727-569AE90A-91HX`
2. Complete the listening module again
3. Check database - `moduleScores.listening` should now have a value (e.g., 3.5)
4. Repeat for reading, writing, and speaking

### Step 4: Verify Test Completion

After all 4 modules are complete, check the database:

```javascript
db.testattempts.findOne({ sessionId: "TST-20260727-569AE90A-91HX" })
```

You should see:
```javascript
{
  "status": "COMPLETED",
  "resultLocked": true,
  "moduleScores": {
    "listening": 3.5,
    "reading": 5.0,
    "writing": 7.0,
    "speaking": 6.0,
    "overall": 5.5
  },
  "moduleResults": {
    "listening": { /* listening result details */ },
    "reading": { /* reading result details */ },
    "writing": { /* writing result details */ },
    "speaking": { /* speaking result details */ }
  },
  "finalScores": {
    "listening": 3.5,
    "reading": 5.0,
    "writing": 7.0,
    "speaking": 6.0,
    "overallBand": 5.5
  },
  "completedAt": "2026-07-27T..."
}
```

### Step 5: Generate Certificate

1. Go to dashboard
2. You should see the "Generate Certificate" button
3. Click it
4. Certificate should generate successfully

## Common Problems and Solutions

### Problem: "No completed test found"

**Cause**: Test status is still `IN_PROGRESS` or `resultLocked` is `false`

**Solution**:
```javascript
// Check the test status:
db.testattempts.findOne(
  { sessionId: "TST-20260727-569AE90A-91HX" },
  { status: 1, resultLocked: 1, moduleScores: 1 }
)

// If all modules have scores but status is wrong, manually update:
db.testattempts.updateOne(
  { sessionId: "TST-20260727-569AE90A-91HX" },
  {
    $set: {
      status: "COMPLETED",
      resultLocked: true,
      completedAt: new Date()
    }
  }
)
```

### Problem: "All four modules must be completed"

**Cause**: One or more module scores are `null`

**Solution**: Retake the missing modules. Check which are null:
```javascript
db.testattempts.findOne(
  { sessionId: "TST-20260727-569AE90A-91HX" },
  { moduleScores: 1 }
)
```

### Problem: "Module results are incomplete"

**Cause**: `finalScores` field is missing or null

**Solution**: This should be automatically populated when all 4 modules are complete. If not:
```javascript
db.testattempts.updateOne(
  { sessionId: "TST-20260727-569AE90A-91HX" },
  {
    $set: {
      finalScores: {
        listening: 3.5,   // Use actual scores from moduleScores
        reading: 5.0,
        writing: 7.0,
        speaking: 6.0,
        overallBand: 5.5  // Average of all four
      }
    }
  }
)
```

### Problem: Still getting "Cannot create field" error

**Cause**: The database update didn't work or you're looking at a different test

**Solution**:
1. Verify you updated the correct document:
```javascript
db.testattempts.findOne(
  { sessionId: "TST-20260727-569AE90A-91HX" },
  { moduleResults: 1, _id: 1 }
)
```

2. If `moduleResults` is still `null`, the update didn't work. Try again or restart the server after the update.

## Prevention (For Future Tests)

The code has been updated to prevent this issue:

1. **Schema change**: New test attempts will have `moduleResults: {}` by default
2. **Route enhancement**: The submit-module route now handles both old (null) and new (object) test attempts
3. **Type safety**: Added proper type checking for `moduleResults`

New tests should work without any manual intervention.

## Verification Checklist

After completing the fix, verify:

- [ ] Database shows `moduleResults: {}` instead of `null`
- [ ] Can complete listening module and score saves
- [ ] Can complete reading module and score saves  
- [ ] Can complete writing module and score saves
- [ ] Can complete speaking module and score saves
- [ ] Test status changes to `COMPLETED`
- [ ] `resultLocked` is set to `true`
- [ ] `finalScores` object is populated
- [ ] Dashboard shows "Generate Certificate" button
- [ ] Certificate generation works and returns PDF
- [ ] No errors in server logs

## Still Having Issues?

If you've followed all steps and still have problems:

1. Check the server logs for detailed error messages
2. Verify MongoDB connection is working
3. Ensure environment variables are set correctly
4. Check that the code changes were saved and the server was restarted
5. Try creating a completely new test attempt from scratch

## Files to Check

If issues persist, verify these files have the correct code:

1. `src/lib/testing/test-attempt-model.ts` - `moduleResults` default should be `() => ({})`
2. `src/app/api/test-attempts/[testId]/submit-module/route.ts` - Should handle null moduleResults
3. Database collection: `testattempts` - Should have `moduleResults: {}` not `null`
