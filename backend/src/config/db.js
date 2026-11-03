import mongoose from 'mongoose';

// One connection per process; on Vercel a warm function instance reuses it across requests
let connection = null;

export const isDbConfigured = () => Boolean(process.env.MONGO_URI) || process.env.NODE_ENV !== 'production';

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connection) {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/celiac-square';
    connection = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 8000 })
      .then((conn) => {
        console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
        return conn.connection;
      })
      .catch((error) => {
        console.error(`[Database Error] MongoDB connection failure: ${error.message}`);
        connection = null; // let the next request retry
        throw error;
      });
  }
  return connection;
};
