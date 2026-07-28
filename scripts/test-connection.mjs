import mongoose from 'mongoose';

const uri = 'mongodb+srv://deepeshcdm_db_user:DMKS123@dkms.661vl4h.mongodb.net/ielts_ace_pro?appName=DKMS';

console.log('Attempting to connect...');

try {
  await mongoose.connect(uri);
  console.log('Connected successfully!');
  
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));
  
  await mongoose.disconnect();
  console.log('Disconnected');
  process.exit(0);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
