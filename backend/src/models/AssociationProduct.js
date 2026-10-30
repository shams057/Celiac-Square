import mongoose from 'mongoose';

const associationProductSchema = new mongoose.Schema(
  {
    productNameFr: {
      type: String,
      required: true,
      trim: true,
    },
    productNameAr: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['MEAT', 'OILS', 'FRUITS_VEG', 'DAIRY', 'GRAINS', 'SPICES', 'PASTRY', 'PROCESSED'],
    },
    isGlutenFree: {
      type: Boolean,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['SAFE', 'WARNING', 'UNSAFE', 'CROSS_CONTAMINATION_RISK', 'UNKNOWN'],
      default: 'SAFE',
    },
    brand: {
      type: String,
      trim: true,
      default: 'Staple / Local Produce',
    },
    barcode: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String, // Guidance from Association
      required: true,
    },
    notesAr: {
      type: String,
      default: '',
    },
    officialDocReference: {
      type: String,
      default: "Guide Officiel de l'Association Tunisienne de la Cœliaque (ATC)",
    },
    keywords: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

associationProductSchema.index({ productNameFr: 'text', productNameAr: 'text', keywords: 'text' });
associationProductSchema.index({ category: 1, isGlutenFree: 1, status: 1 });

export const AssociationProduct = mongoose.model('AssociationProduct', associationProductSchema);
