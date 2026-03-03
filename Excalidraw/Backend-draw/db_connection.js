import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            console.error("No MONGO_URI found in environment variables.");
            return false;
        }
        console.log("Attempting to connect to MongoDB...");
        await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
        console.log("MongoDB connected successfully");
        return true;
    } catch (err) {
        console.error("MongoDB connection error:", err);
        return false;
    }
};
