# Certificate Generation Flow - Visual Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER STARTS TEST                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   TestProvider.startModule   │
                    └──────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
         ┌──────────────────┐        ┌──────────────────────┐
         │   Demo User?     │        │   Regular User       │
         │  (DEMO-CERT-001) │        │                      │
         └──────────────────┘        └──────────────────────┘
                    │                             │
                    │ Skip DB                     │ Create DB Record
                    │                             ▼
                    │              POST /api/test-attempts
                    │                             │
                    │                             ▼
                    │              Store sessionId in state
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  USER COMPLETES MODULE 1-3   │
                    │  (Results stored locally)    │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  USER COMPLETES MODULE 4     │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ TestProvider.submitModule    │
                    │ Detects: All 4 modules done  │
                    └──────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
         ┌──────────────────┐        ┌──────────────────────┐
         │   Demo User?     │        │   Regular User       │
         └──────────────────┘        └──────────────────────┘
                    │                             │
                    │ Skip DB                     │ Finalize in DB
                    │                             ▼
                    │         POST /api/test-attempts/{sessionId}/finalize
                    │                             │
                    │                             ▼
                    │              Database Updates:
                    │              • status: 'COMPLETED'
                    │              • resultLocked: true
                    │              • finalScores: { L, R, W, S, overall }
                    │              • moduleResults: detailed
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │    Navigate to Dashboard     │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  USER CLICKS "ISSUE CERT"    │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    POST /api/certificates/generate
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  Find Most Recent Test:      │
                    │  • status: 'COMPLETED'       │
                    │  • resultLocked: true        │
                    │  • Sort by completedAt desc  │
                    └──────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
         ┌──────────────────┐        ┌──────────────────────┐
         │   No Test Found  │        │   Test Found         │
         └──────────────────┘        └──────────────────────┘
                    │                             │
                    ▼                             ▼
         Return 404 Error          Extract finalScores from DB
                                                  │
                                                  ▼
                                   ┌──────────────────────────────┐
                                   │  Check Eligibility:          │
                                   │  • All modules ≥ 6.0         │
                                   │  • Overall band ≥ 6.0        │
                                   └──────────────────────────────┘
                                                  │
                                   ┌──────────────┴──────────────┐
                                   │                             │
                                   ▼                             ▼
                        ┌──────────────────┐        ┌──────────────────────┐
                        │   Not Eligible   │        │   Eligible           │
                        └──────────────────┘        └──────────────────────┘
                                   │                             │
                                   ▼                             ▼
                        Return 400 Error          Check if cert exists
                                                                 │
                                                  ┌──────────────┴──────────────┐
                                                  │                             │
                                                  ▼                             ▼
                                       ┌──────────────────┐        ┌──────────────────────┐
                                       │   Cert Exists    │        │   No Cert            │
                                       └──────────────────┘        └──────────────────────┘
                                                  │                             │
                                                  ▼                             ▼
                                       Return existing cert       Create new cert
                                       (idempotent: true)          (idempotent: false)
                                                                                │
                                                                                ▼
                                                                   Generate unique IDs:
                                                                   • certificateId
                                                                   • testId (for cert)
                                                                                │
                                                                                ▼
                                                                   Save to CertificateModel
                                                  │                             │
                                                  └──────────────┬──────────────┘
                                                                 │
                                                                 ▼
                                                  ┌──────────────────────────────┐
                                                  │  Return Certificate Response │
                                                  │  • certificate details       │
                                                  │  • previewUrl                │
                                                  │  • downloadUrl               │
                                                  └──────────────────────────────┘
                                                                 │
                                                                 ▼
                                                  ┌──────────────────────────────┐
                                                  │  USER DOWNLOADS/VIEWS CERT   │
                                                  └──────────────────────────────┘
```

---

## Key Decision Points

### 1. Demo User Detection
```
isDemoEnabled() && isDemoRegisterNumber(user.registerNumber)
↓
TRUE:  Skip database operations, use pre-populated data
FALSE: Full database integration
```

### 2. Test Completion Detection
```
results.length === 4 
AND 
['listening', 'reading', 'writing', 'speaking'].every(mod => completed)
↓
TRUE:  Trigger finalization
FALSE: Continue test
```

### 3. Certificate Eligibility
```
all_module_bands >= 6.0 
AND 
overall_band >= 6.0
↓
TRUE:  Create/return certificate
FALSE: Return 400 error with details
```

### 4. Certificate Idempotency
```
Certificate exists for (studentId, testId)?
↓
TRUE:  Return existing certificate
FALSE: Create new certificate
```

---

## Database Collections

### TestAttempt
```javascript
{
  _id: ObjectId("..."),
  sessionId: "TEST-20260722-ABC123",  // unique
  studentId: ObjectId("..."),         // indexed
  status: "COMPLETED",                // indexed
  resultLocked: true,                 // indexed
  completedAt: ISODate("..."),        // indexed
  finalScores: {
    listening: 7.0,
    reading: 6.5,
    writing: 6.5,
    speaking: 7.0,
    overallBand: 7.0
  },
  moduleResults: { /* detailed */ },
  modules: { /* test content */ },
  submissions: { /* user answers */ }
}
```

### Certificate
```javascript
{
  _id: ObjectId("..."),
  certificateId: "CERT-20260722-XYZ789",  // unique
  testId: "CERT-TEST-XYZ789",             // unique
  studentId: ObjectId("..."),              // indexed
  attemptId: ObjectId("..."),              // reference to TestAttempt
  fullName: "John Doe",
  registerNumber: "REG-12345",
  moduleBands: {
    listening: 7.0,
    reading: 6.5,
    writing: 6.5,
    speaking: 7.0
  },
  overallBand: 7.0,
  status: "ISSUED",
  issuedAt: ISODate("..."),
  verificationUrl: "https://..."
}
```

---

## API Response Examples

### Successful Certificate Generation
```json
{
  "issued": true,
  "idempotent": false,
  "source": "test-attempt",
  "certificate": {
    "certificateId": "CERT-20260722-XYZ789",
    "fullName": "John Doe",
    "registerNumber": "REG-12345",
    "overallBand": 7.0,
    "moduleBands": {
      "listening": 7.0,
      "reading": 6.5,
      "writing": 6.5,
      "speaking": 7.0
    },
    "issuedAt": "2026-07-22T10:30:00.000Z",
    "status": "ISSUED"
  },
  "previewUrl": "https://app.com/api/certificates/preview/CERT-20260722-XYZ789",
  "downloadUrl": "https://app.com/api/certificates/download/CERT-20260722-XYZ789"
}
```

### Idempotent Response (Certificate Already Exists)
```json
{
  "issued": false,
  "idempotent": true,
  "source": "database",
  "certificate": { /* same as above */ },
  "previewUrl": "...",
  "downloadUrl": "..."
}
```

### No Completed Test
```json
{
  "error": "NO_COMPLETED_TEST",
  "message": "No completed and finalized test found. Complete all four modules and finalize your test first."
}
```

### Not Eligible
```json
{
  "error": "INELIGIBLE",
  "message": "Certificate requirements not met. All module bands must be ≥ 6.0 and overall band must be ≥ 6.0. Failed: writing (5.5)",
  "details": {
    "threshold": 6.0,
    "failedCriteria": ["writing"],
    "moduleBands": {
      "listening": 7.0,
      "reading": 6.5,
      "writing": 5.5,
      "speaking": 7.0
    },
    "overallBand": 6.5
  }
}
```
