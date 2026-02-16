import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n=== MongoDB Connection Test ===\n');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI not found in .env file!');
  process.exit(1);
}

// Show URI with hidden password
const safeUri = uri.replace(/:[^:@]+@/, ':****@');
console.log('Connection URI:', safeUri);
console.log('\nAttempting connection...\n');

mongoose.connect(uri, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('✅ ✅ ✅ CONNECTION SUCCESSFUL! ✅ ✅ ✅\n');
    console.log('MongoDB is working correctly!');
    console.log('Database:', mongoose.connection.db.databaseName);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ ❌ ❌ CONNECTION FAILED! ❌ ❌ ❌\n');
    console.error('Error:', err.message);
    console.error('\nPossible issues:');
    console.error('1. Wrong username or password');
    console.error('2. Password has special characters (needs encoding)');
    console.error('3. Cluster name is incorrect');
    console.error('4. Wait 1-2 minutes after changing IP whitelist');
    process.exit(1);
  });
