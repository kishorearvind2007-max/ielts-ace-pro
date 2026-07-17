import mongoose from 'mongoose';

function hasTemplatePlaceholder(value) {
  return /<[^>]+>/.test(value);
}

function normalizeBand(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(9, value));
}

function buildKey(studentId, sessionId) {
  return `${String(studentId)}::${String(sessionId)}`;
}

function parseFlags(argv) {
  const flags = new Set(argv.slice(2));

  return {
    execute: flags.has('--execute'),
    cleanupLegacy: flags.has('--cleanup-legacy'),
  };
}

function getMongoConfig() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;

  if (!uri) {
    throw new Error('Missing MONGODB_URI.');
  }

  if (hasTemplatePlaceholder(uri)) {
    throw new Error('MONGODB_URI still contains template placeholder values.');
  }

  if (dbName && hasTemplatePlaceholder(dbName)) {
    throw new Error('MONGODB_DB_NAME still contains template placeholder values.');
  }

  return { uri, dbName };
}

function extractFinalScoresFromLegacyResult(legacyResult) {
  const modules = legacyResult?.modules ?? {};

  const listening = normalizeBand(modules?.listening?.band);
  const reading = normalizeBand(modules?.reading?.band);
  const writing = normalizeBand(modules?.writing?.band);
  const speaking = normalizeBand(modules?.speaking?.band);
  const overallBand = normalizeBand(legacyResult?.overallBand ?? modules?.overallBand);

  return {
    listening,
    reading,
    writing,
    speaking,
    overallBand,
  };
}

function extractScoresFromCertificate(certificate) {
  if (certificate?.scores && typeof certificate.scores === 'object') {
    return {
      listening: normalizeBand(certificate.scores.listening),
      reading: normalizeBand(certificate.scores.reading),
      writing: normalizeBand(certificate.scores.writing),
      speaking: normalizeBand(certificate.scores.speaking),
      overallBand: normalizeBand(certificate.scores.overallBand),
    };
  }

  const moduleBands = certificate?.moduleBands ?? {};

  return {
    listening: normalizeBand(moduleBands.listening),
    reading: normalizeBand(moduleBands.reading),
    writing: normalizeBand(moduleBands.writing),
    speaking: normalizeBand(moduleBands.speaking),
    overallBand: normalizeBand(certificate?.overallBand),
  };
}

async function countDuplicates(collection, fieldName) {
  const duplicates = await collection.aggregate([
    { $match: { [fieldName]: { $type: 'string', $ne: '' } } },
    { $group: { _id: `$${fieldName}`, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'duplicateCount' },
  ]).toArray();

  return duplicates[0]?.duplicateCount ?? 0;
}

async function run() {
  const flags = parseFlags(process.argv);
  const { uri, dbName } = getMongoConfig();

  console.log('Migration mode:', flags.execute ? 'EXECUTE' : 'DRY RUN');
  console.log('Cleanup legacy fields:', flags.cleanupLegacy ? 'ENABLED' : 'DISABLED');

  await mongoose.connect(uri, {
    dbName: dbName || undefined,
  });

  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Mongo connection is not initialized.');
    }

    const students = db.collection('students');
    const testAttempts = db.collection('testattempts');
    const testResults = db.collection('testresults');
    const certificates = db.collection('certificates');

    const summary = {
      studentGoogleIdBackfilled: 0,
      testAttemptsScanned: 0,
      testAttemptsUpdated: 0,
      testAttemptsWithLegacyResults: 0,
      certificatesScanned: 0,
      certificatesUpdated: 0,
    };

    const studentFilter = {
      googleId: { $in: [null, ''] },
      googleSub: { $type: 'string', $ne: '' },
    };

    if (flags.execute) {
      const studentUpdate = await students.updateMany(studentFilter, [
        {
          $set: {
            googleId: '$googleSub',
          },
        },
      ]);
      summary.studentGoogleIdBackfilled = studentUpdate.modifiedCount;
    } else {
      summary.studentGoogleIdBackfilled = await students.countDocuments(studentFilter);
    }

    const legacyResults = await testResults.find({}, {
      projection: {
        studentId: 1,
        testId: 1,
        modules: 1,
        overallBand: 1,
        completedAt: 1,
      },
    }).toArray();

    const resultByAttemptKey = new Map();
    for (const legacyResult of legacyResults) {
      const sessionId = legacyResult.testId;
      if (!sessionId) {
        continue;
      }

      resultByAttemptKey.set(
        buildKey(legacyResult.studentId, sessionId),
        legacyResult,
      );
    }

    const allCertificates = await certificates.find({}, {
      projection: {
        studentId: 1,
        sessionId: 1,
        testId: 1,
      },
    }).toArray();

    const certificateSessionKeySet = new Set();
    for (const certificate of allCertificates) {
      const sessionId = certificate.sessionId || certificate.testId;
      if (!sessionId) {
        continue;
      }

      certificateSessionKeySet.add(buildKey(certificate.studentId, sessionId));
    }

    const attemptCursor = testAttempts.find({}, {
      projection: {
        studentId: 1,
        sessionId: 1,
        testId: 1,
        status: 1,
        resultLocked: 1,
        certificateIssued: 1,
        completedAt: 1,
        finalizedAt: 1,
      },
    });

    const attemptBulkOps = [];

    while (await attemptCursor.hasNext()) {
      const attempt = await attemptCursor.next();
      if (!attempt) {
        continue;
      }

      summary.testAttemptsScanned += 1;

      const resolvedSessionId = attempt.sessionId || attempt.testId;
      if (!resolvedSessionId) {
        continue;
      }

      const resultKey = buildKey(attempt.studentId, resolvedSessionId);
      const legacyResult = resultByAttemptKey.get(resultKey);

      if (legacyResult) {
        summary.testAttemptsWithLegacyResults += 1;
      }

      const derivedScores = legacyResult
        ? extractFinalScoresFromLegacyResult(legacyResult)
        : null;

      const hasCertificateForSession = certificateSessionKeySet.has(resultKey);

      const setPayload = {
        sessionId: resolvedSessionId,
        testId: resolvedSessionId,
        status: legacyResult ? 'COMPLETED' : attempt.status,
        resultLocked: legacyResult ? true : Boolean(attempt.resultLocked),
        certificateIssued: hasCertificateForSession || Boolean(attempt.certificateIssued),
      };

      if (legacyResult) {
        setPayload.moduleResults = legacyResult.modules;
        setPayload.finalScores = derivedScores;
        setPayload.completedAt = legacyResult.completedAt || attempt.completedAt || attempt.finalizedAt || null;
        setPayload.finalizedAt = legacyResult.completedAt || attempt.finalizedAt || attempt.completedAt || null;
      }

      if (!flags.execute) {
        summary.testAttemptsUpdated += 1;
        continue;
      }

      attemptBulkOps.push({
        updateOne: {
          filter: { _id: attempt._id },
          update: {
            $set: setPayload,
          },
        },
      });

      if (attemptBulkOps.length >= 500) {
        const bulkResult = await testAttempts.bulkWrite(attemptBulkOps, { ordered: false });
        summary.testAttemptsUpdated += bulkResult.modifiedCount;
        attemptBulkOps.length = 0;
      }
    }

    if (flags.execute && attemptBulkOps.length > 0) {
      const bulkResult = await testAttempts.bulkWrite(attemptBulkOps, { ordered: false });
      summary.testAttemptsUpdated += bulkResult.modifiedCount;
    }

    const certCursor = certificates.find({}, {
      projection: {
        sessionId: 1,
        testId: 1,
        scores: 1,
        moduleBands: 1,
        overallBand: 1,
      },
    });

    const certBulkOps = [];

    while (await certCursor.hasNext()) {
      const cert = await certCursor.next();
      if (!cert) {
        continue;
      }

      summary.certificatesScanned += 1;

      const resolvedSessionId = cert.sessionId || cert.testId;
      if (!resolvedSessionId) {
        continue;
      }

      const resolvedScores = extractScoresFromCertificate(cert);

      const update = {
        $set: {
          sessionId: resolvedSessionId,
          testId: resolvedSessionId,
          scores: resolvedScores,
        },
      };

      if (flags.cleanupLegacy) {
        update.$unset = {
          moduleBands: '',
          overallBand: '',
          resultId: '',
          attemptId: '',
        };
      }

      if (!flags.execute) {
        summary.certificatesUpdated += 1;
        continue;
      }

      certBulkOps.push({
        updateOne: {
          filter: { _id: cert._id },
          update,
        },
      });

      if (certBulkOps.length >= 500) {
        const bulkResult = await certificates.bulkWrite(certBulkOps, { ordered: false });
        summary.certificatesUpdated += bulkResult.modifiedCount;
        certBulkOps.length = 0;
      }
    }

    if (flags.execute && certBulkOps.length > 0) {
      const bulkResult = await certificates.bulkWrite(certBulkOps, { ordered: false });
      summary.certificatesUpdated += bulkResult.modifiedCount;
    }

    const duplicateAttemptSessionIds = await countDuplicates(testAttempts, 'sessionId');
    const duplicateCertificateSessionIds = await countDuplicates(certificates, 'sessionId');

    if (flags.execute) {
      await testAttempts.createIndex({ sessionId: 1 }, { unique: true, name: 'sessionId_1' });
      await certificates.createIndex({ sessionId: 1 }, { unique: true, name: 'sessionId_1' });
    }

    console.log('Summary:', JSON.stringify(summary, null, 2));
    console.log('Duplicate test sessionId count:', duplicateAttemptSessionIds);
    console.log('Duplicate certificate sessionId count:', duplicateCertificateSessionIds);
    console.log(flags.execute ? 'Migration finished.' : 'Dry run finished. Re-run with --execute to persist changes.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
