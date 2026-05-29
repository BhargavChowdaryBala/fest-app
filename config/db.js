import mongoose from 'mongoose';

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        console.warn('WARNING: MONGO_URI environment variable is missing. MongoDB connection skipped.');
        return;
    }
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: 'fest_users' });
        console.log('MongoDB Connected to fest_users');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

export default connectDB;
