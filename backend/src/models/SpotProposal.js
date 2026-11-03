import mongoose from 'mongoose';

/**
 * A spot suggested by the community. It stays out of the map until an admin
 * approves it from the backoffice inbox, which creates the real Spot.
 */
const spotProposalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['DOCTOR', 'CAFE', 'RESTAURANT', 'ARTISAN', 'SUPERMARKET'],
    },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    // Approximate position (city centre) until the admin sets the real one
    coordinates: { type: [Number], default: undefined },
    phone: { type: String, trim: true, default: '' },
    speciality: { type: String, trim: true, default: '' },
    hours: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    submittedBy: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reviewedAt: { type: Date },
    spot: { type: mongoose.Schema.Types.ObjectId, ref: 'Spot' },
  },
  { timestamps: true }
);

export const SpotProposal = mongoose.model('SpotProposal', spotProposalSchema);
