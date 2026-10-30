import mongoose from 'mongoose';

const spotSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['DOCTOR', 'CAFE', 'RESTAURANT', 'ARTISAN', 'SUPERMARKET'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    speciality: {
      type: String,
      trim: true,
      default: '',
    },
    hours: {
      type: String,
      trim: true,
      default: '',
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 1,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    submittedBy: {
      type: String,
      default: 'Community / Admin',
    },
  },
  {
    timestamps: true,
  }
);

spotSchema.index({ location: '2dsphere' });
spotSchema.index({ city: 1, category: 1, isVerified: 1 });

export const Spot = mongoose.model('Spot', spotSchema);
