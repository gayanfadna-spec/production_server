import mongoose, { Document, Schema } from 'mongoose';
import { ILastEditedBy, LastEditedBySchema } from './User.js';

export type ProductDivision = 'Fadna Tea' | 'Fadna Life Science';

export interface IFinishedGood extends Document {
  sku: string;
  shortCode: string; // e.g. S(SPN), DSN, GPN2, CN3, T(SPN), BN3, etc.
  name: string;
  division: ProductDivision;
  category: string;
  unit: string;
  packSize: string;
  productionFloorStock: number;
  finishedStoreStock: number;
  totalStock: number;
  physicalActualStock?: number;
  minReorderLevel: number;
  standardBatchSize: number;
  costPerUnit: number;
  sellingPrice: number;
  description: string;
  imageUrl?: string;
  isActive: boolean;
  lastEditedBy?: ILastEditedBy;
  createdAt: Date;
  updatedAt: Date;
}

const FinishedGoodSchema = new Schema<IFinishedGood>(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    shortCode: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    division: {
      type: String,
      enum: ['Fadna Tea', 'Fadna Life Science'],
      default: 'Fadna Tea',
    },
    category: { type: String, required: true, default: 'Herbal Tea' },
    unit: { type: String, required: true, default: 'Packs' },
    packSize: { type: String, default: '20 Tea Bags' },
    productionFloorStock: { type: Number, default: 0, min: 0 },
    finishedStoreStock: { type: Number, default: 0, min: 0 },
    physicalActualStock: { type: Number, default: null },
    minReorderLevel: { type: Number, default: 500, min: 0 },
    standardBatchSize: { type: Number, default: 1000, min: 1 },
    costPerUnit: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastEditedBy: { type: LastEditedBySchema, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

FinishedGoodSchema.virtual('totalStock').get(function (this: IFinishedGood) {
  return (this.productionFloorStock || 0) + (this.finishedStoreStock || 0);
});

FinishedGoodSchema.virtual('variance').get(function (this: IFinishedGood) {
  const current = (this.productionFloorStock || 0) + (this.finishedStoreStock || 0);
  return (this.physicalActualStock || 0) - current;
});

export const FinishedGood = mongoose.model<IFinishedGood>('FinishedGood', FinishedGoodSchema);
