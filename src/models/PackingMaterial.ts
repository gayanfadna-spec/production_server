import mongoose, { Document, Schema } from 'mongoose';
import { ILastEditedBy, LastEditedBySchema } from './User.js';

export interface IPackingMaterial extends Document {
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minReorderLevel: number;
  costPerUnit: number;
  supplier: string;
  storageLocation: string;
  specs?: string;
  isActive: boolean;
  lastEditedBy?: ILastEditedBy;
  createdAt: Date;
  updatedAt: Date;
}

const PackingMaterialSchema = new Schema<IPackingMaterial>(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      default: 'Monocartons',
    },
    unit: { type: String, required: true, default: 'Pcs' },
    currentStock: { type: Number, default: 0, min: 0 },
    minReorderLevel: { type: Number, default: 1000, min: 0 },
    costPerUnit: { type: Number, default: 0, min: 0 },
    supplier: { type: String, default: 'Print & Pack Lanka Ltd' },
    storageLocation: { type: String, default: 'PM Store Rack 01' },
    specs: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastEditedBy: { type: LastEditedBySchema, default: null },
  },
  { timestamps: true }
);

export const PackingMaterial = mongoose.model<IPackingMaterial>('PackingMaterial', PackingMaterialSchema);
