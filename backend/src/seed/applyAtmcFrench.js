import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AtmcProduct } from '../models/AtmcProduct.js';
import { loadAtmcTranslations } from './seedData.js';

/**
 * Adds the French names to the ATMC products already in MongoDB,
 * without reseeding (which would also wipe the spots).
 */
dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/celiac-square';
const dataFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../Data/ATMC2023.json');

await mongoose.connect(MONGO_URI);
const translations = loadAtmcTranslations(dataFile);
const products = await AtmcProduct.find({}, { name: 1 });
const ops = products.map((p) => ({
  updateOne: { filter: { _id: p._id }, update: { $set: { nameFr: translations[p.name] || p.name } } },
}));
const res = await AtmcProduct.bulkWrite(ops);
console.log(`[ATMC] French names set on ${res.modifiedCount} of ${products.length} products.`);
await mongoose.disconnect();
