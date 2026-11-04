import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fadna_production';

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully to ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (error: any) {
    console.error(`[MongoDB] Connection error with primary URI (${uri}):`, error.message);
    console.warn(`[MongoDB] Note: Ensure MongoDB Community Server is running on port 27017 or set MONGODB_URI in .env.`);
    setTimeout(() => {
      connectDB();
    }, 10000);
  }
};

export default connectDB;
