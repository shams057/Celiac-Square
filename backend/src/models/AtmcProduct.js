import mongoose from 'mongoose';

const atmcProductSchema = new mongoose.Schema(
  {
    categoryFr: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    categoryAr: {
      type: String,
      required: true,
      trim: true,
    },
    categorySlug: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['ALLOWED', 'TO_CHECK', 'NOT_ALLOWED'],
      index: true,
    },
    statusLabelFr: {
      type: String,
      required: true,
    },
    statusLabelAr: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // French version of the entry (the guide mixes Arabic and French)
    nameFr: {
      type: String,
      trim: true,
      default: '',
    },
    brand: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    items: {
      type: [String],
      default: [],
    },
    rawText: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      default: 'Association Tunisienne de la Maladie Cœliaque (ATMC) - Guide 2023',
    },
  },
  {
    timestamps: true,
  }
);

atmcProductSchema.index({ name: 'text', nameFr: 'text', brand: 'text', rawText: 'text', items: 'text' });
atmcProductSchema.index({ categorySlug: 1, status: 1 });

export const AtmcProduct = mongoose.model('AtmcProduct', atmcProductSchema);
