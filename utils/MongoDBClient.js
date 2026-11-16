import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
  } catch (error) {
    console.error("[database] Connection failed", {
      name: error.name,
      code: error.code || "UNKNOWN",
    });
    process.exit(1);
  }
};

export default connectDB;
