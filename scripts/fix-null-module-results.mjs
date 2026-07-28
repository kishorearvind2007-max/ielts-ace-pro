/**
 * Migration Script: Fix null moduleResults
 * 
 * This script updates test attempts where moduleResults is null to be an empty object.
 * This prevents MongoDB errors when trying to use dot notation to set nested fields.
 * 
 * Usage: Set MONGODB_URI and optionally MONGODB_DB_NAME environment variables before running
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  console.error('   Please set it before running this script');
  process.exit(1);
}

async function fixNullModuleResults() {
  let connection;
  try {
    console.log('🔌 Connecting to MongoDB...');
    connection = await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB_NAME || undefined,
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not initialized');
    }

    const testAttemptsCollection = db.collection('testattempts');

    // Find all test attempts where moduleResults is null
    const attemptsWithNullResults = await testAttemptsCollection.find({
      moduleResults: null,
    }).toArray();

    console.log(`📊 Found ${attemptsWithNullResults.length} test attempts with null moduleResults`);

    if (attemptsWithNullResults.length === 0) {
      console.log('✅ No test attempts to fix');
      return { success: true, modified: 0 };
    }

    // List the session IDs being updated
    console.log('   Session IDs:');
    attemptsWithNullResults.forEach((attempt) => {
      console.log(`   - ${attempt.sessionId || attempt.testId}`);
    });

    // Update all test attempts with null moduleResults to have an empty object
    const result = await testAttemptsCollection.updateMany(
      { moduleResults: null },
      { $set: { moduleResults: {} } }
    );

    console.log(`✅ Updated ${result.modifiedCount} test attempts`);
    console.log('   - Changed moduleResults from null to {}');

    return { success: true, modified: result.modifiedCount };
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    return { success: false, error: error.message };
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('👋 Disconnected from MongoDB');
    }
  }
}

// Run migration
fixNullModuleResults()
  .then((result) => {
    if (result.success) {
      console.log('🎉 Migration completed successfully');
      console.log(`   Modified ${result.modified} documents`);
      process.exit(0);
    } else {
      console.error('💥 Migration failed:', result.error);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error.message);
    process.exit(1);
  });
