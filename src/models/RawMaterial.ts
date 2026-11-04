import mongoose, { Document, Schema } from 'mongoose';
import { ILastEditedBy, LastEditedBySchema } from './User.js';

export const RAW_MATERIAL_CATEGORIES = ['Lifescience', 'QofL', 'Tea', 'Others'] as const;
export type RawMaterialCategory = (typeof RAW_MATERIAL_CATEGORIES)[number];

export const normalizeRawMaterialCategory = (val: string): string => {
  if (!val) return val;
  const trimmed = val.trim();
  if (/^lifescience$/i.test(trimmed)) return 'Lifescience';
  if (/^qofl$/i.test(trimmed)) return 'QofL';
  if (/^tea$/i.test(trimmed)) return 'Tea';
  if (/^others?$/i.test(trimmed)) return 'Others';
  return trimmed;
};

export interface IRawMaterial extends Document {
  sku: string;
  name: string;
  botanicalName?: string;
  category: RawMaterialCategory;
  unit: string;
  currentStock: number;
  minReorderLevel: number;
  costPerUnit: number;
  supplier: string;
  storageLocation: string;
  description: string;
  isActive: boolean;
  lastEditedBy?: ILastEditedBy;
  createdAt: Date;
  updatedAt: Date;
}

const RawMaterialSchema = new Schema<IRawMaterial>(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    botanicalName: { type: String, default: '' },
    category: {
      type: String,
      required: [true, 'Raw material category is required'],
      set: normalizeRawMaterialCategory,
      enum: {
        values: RAW_MATERIAL_CATEGORIES,
        message: '{VALUE} is not a valid category. Category must be one of: Lifescience, QofL, Tea, Others',
      },
      default: 'Tea',
    },
    unit: { type: String, required: true, default: 'kg' },
    currentStock: { type: Number, default: 0, min: 0 },
    minReorderLevel: { type: Number, default: 50, min: 0 },
    costPerUnit: { type: Number, default: 0, min: 0 },
    supplier: { type: String, default: 'Local Herbal Growers Co-op' },
    storageLocation: { type: String, default: 'RM Warehouse Bay A' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastEditedBy: { type: LastEditedBySchema, default: null },
  },
  { timestamps: true }
);

export const RawMaterial = mongoose.model<IRawMaterial>('RawMaterial', RawMaterialSchema);
