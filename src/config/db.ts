import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fadna_production';

  try {
    mongoose.set('strictQuery', false);
    console.log(`[MongoDB] Connecting to: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully to ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (error: any) {
    console.error(`[MongoDB] Connection error with primary URI:`, error.message);
    console.warn(`[MongoDB] Note: Ensure MongoDB Atlas has IP 0.0.0.0/0 allowed, or set MONGODB_URI in Render Environment.`);
    setTimeout(() => {
      connectDB();
    }, 10000);
  }
};

export default connectDB;
