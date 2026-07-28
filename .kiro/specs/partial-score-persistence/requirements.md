# Requirements Document

## Introduction

The Test Craft IELTS application currently requires users to complete all four test modules (Listening, Reading, Writing, Speaking) in a single session. If a user closes their browser or logs out before completing all modules, their progress is lost. This feature implements per-module score persistence, session resumption, and the ability to start new test attempts while preserving historical data.

## Glossary

- **Test_System**: The Test Craft IELTS testing application
- **Test_Attempt**: A single instance of a user's IELTS test, tracked in MongoDB with a unique sessionId
- **Module**: One of the four IELTS test components: Listening, Reading, Writing, or Speaking
- **Module_Score**: A band score (0.0 to 9.0) for a single module
- **Overall_Band**: The combined band score calculated from all four module scores using IELTS rounding rules
- **Certificate_Unlock**: The user interface panel that displays module scores and enables certificate generation
- **Active_Attempt**: The most recent Test_Attempt for a user that is either IN_PROGRESS or COMPLETED with results available
- **Session_Resumption**: The process of loading a user's existing Test_Attempt when they return to the application
- **Fresh_Attempt**: A new Test_Attempt created when a user chooses to start a new test, archiving the previous attempt

## Requirements

### Requirement 1: Per-Module Score Persistence

**User Story:** As a user, I want my score for each completed module to be saved immediately, so that I do not lose my progress if I close my browser or log out.

#### Acceptance Criteria

1. WHEN a user completes a module, THE Test_System SHALL save that Module_Score to the database immediately
2. THE Test_Attempt SHALL store five nullable band score fields: listening, reading, writing, speaking, and overall
3. WHEN a module has not been attempted, THE Test_System SHALL store null for that Module_Score
4. WHEN all four Module_Score values are non-null, THE Test_System SHALL calculate and store the Overall_Band
5. WHEN all four Module_Score values are non-null, THE Test_System SHALL set the Test_Attempt status to COMPLETED and mark resultLocked as true

### Requirement 2: Session Resumption on Page Load

**User Story:** As a user, I want to see my saved module scores when I return to the application, so that I can continue from where I left off.

#### Acceptance Criteria

1. WHEN the application loads, THE Test_System SHALL query the database for the user's Active_Attempt
2. WHEN an Active_Attempt exists, THE Test_System SHALL load the Module_Score values into the application state
3. WHEN an Active_Attempt has status COMPLETED with resultLocked true, THE Test_System SHALL display all scores in the Certificate_Unlock panel
4. WHEN no Active_Attempt exists, THE Test_System SHALL initialize the application with null scores for all modules

### Requirement 3: Certificate Unlock Panel Display

**User Story:** As a user, I want to see which modules I have completed and which remain, so that I know my progress toward certificate eligibility.

#### Acceptance Criteria

1. THE Certificate_Unlock panel SHALL display the Module_Score for each completed module
2. WHEN a Module_Score is null, THE Certificate_Unlock panel SHALL display "--" for that module
3. WHEN all four Module_Score values are non-null, THE Certificate_Unlock panel SHALL display the Overall_Band
4. WHEN any Module_Score is null, THE Certificate_Unlock panel SHALL display helper text indicating how many modules remain
5. WHEN any Module_Score is null, THE Certificate_Unlock panel SHALL disable the certificate generation button

### Requirement 4: Certificate Generation Blocking

**User Story:** As a user, I want the system to prevent certificate generation until I have completed all four modules, so that I do not receive an incomplete certificate.

#### Acceptance Criteria

1. THE certificate generation API route SHALL verify that all four Module_Score values are non-null before proceeding
2. WHEN any Module_Score is null, THE certificate generation API route SHALL return an error with code INCOMPLETE_MODULES
3. WHEN the Overall_Band is null, THE certificate generation API route SHALL return an error with code INCOMPLETE_MODULES

### Requirement 5: Start New Test Flow

**User Story:** As a user, I want to start a new test after completing one, so that I can practice again or improve my scores.

#### Acceptance Criteria

1. WHEN all four Module_Score values are non-null, THE Test_System SHALL display a "Start New Test" button
2. WHEN the user clicks "Start New Test", THE Test_System SHALL display an inline confirmation message
3. THE confirmation message SHALL inform the user that starting a new test will begin a fresh attempt and that their current results are saved
4. WHEN the user confirms, THE Test_System SHALL clear the sessionId and all Module_Score values from application state
5. WHEN the user starts any module after confirming, THE Test_System SHALL create a new Test_Attempt in the database
6. THE previous Test_Attempt SHALL remain in the database with status COMPLETED

### Requirement 6: Per-Module Submission API

**User Story:** As a developer, I want a dedicated API endpoint for submitting individual module results, so that scores can be saved incrementally.

#### Acceptance Criteria

1. THE Test_System SHALL provide a POST endpoint at `/api/test-attempts/[testId]/submit-module`
2. THE endpoint SHALL accept module name (listening, reading, writing, speaking) and band score in the request body
3. THE endpoint SHALL verify the user is authenticated and owns the Test_Attempt
4. THE endpoint SHALL verify the Test_Attempt has status IN_PROGRESS and resultLocked is false
5. THE endpoint SHALL use MongoDB dot-notation to update only the specified Module_Score field
6. WHEN all four Module_Score values become non-null after the update, THE endpoint SHALL calculate the Overall_Band and transition the Test_Attempt to COMPLETED

### Requirement 7: Active Attempt Retrieval API

**User Story:** As a developer, I want a dedicated API endpoint for retrieving the user's active test attempt, so that the application can resume sessions on page load.

#### Acceptance Criteria

1. THE Test_System SHALL provide a GET endpoint at `/api/test-attempts/active`
2. THE endpoint SHALL query for the most recent Test_Attempt where status is IN_PROGRESS or status is COMPLETED with resultLocked true
3. THE endpoint SHALL return the sessionId, status, and all Module_Score values
4. WHEN no Active_Attempt exists, THE endpoint SHALL return sessionId as null and moduleScores as null
5. THE endpoint SHALL sort Test_Attempt documents by createdAt in descending order to find the most recent

### Requirement 8: Module Score Schema Extension

**User Story:** As a developer, I want the TestAttempt database schema to include per-module score storage, so that I can persist and query individual module results.

#### Acceptance Criteria

1. THE Test_Attempt schema SHALL include a moduleScores field of type ModuleScores
2. THE ModuleScores type SHALL define five nullable number fields: listening, reading, writing, speaking, overall
3. THE moduleScores field SHALL have a default value of null to represent "never attempted"
4. THE Test_System SHALL support MongoDB dot-notation updates for individual Module_Score fields without replacing the entire moduleScores object

### Requirement 9: Backward Compatibility with Finalization

**User Story:** As a developer, I want the new per-module persistence to coexist with the existing finalization logic, so that no existing functionality is broken.

#### Acceptance Criteria

1. WHEN the submit-module endpoint calculates the Overall_Band, THE Test_System SHALL populate the finalScores field for backward compatibility
2. THE finalScores field SHALL contain all five band scores (listening, reading, writing, speaking, overallBand)
3. THE certificate generation route SHALL continue to read from finalScores without modification

### Requirement 10: Session Hydration in TestProvider

**User Story:** As a developer, I want the TestProvider to automatically load saved module scores on mount, so that users see their progress immediately.

#### Acceptance Criteria

1. WHEN the TestProvider mounts and a user is authenticated, THE Test_System SHALL call the active attempt API endpoint
2. WHEN the API returns an Active_Attempt, THE Test_System SHALL dispatch actions to set the sessionId and load Module_Score values into state
3. THE Test_System SHALL prevent hydration from overwriting already-loaded results in the current session
4. WHEN a module is submitted, THE Test_System SHALL call the submit-module endpoint without waiting for all four modules
