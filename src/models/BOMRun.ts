import mongoose, { Document, Schema, Types } from 'mongoose';
import { ILastEditedBy, LastEditedBySchema } from './User.js';

export type ProductDivision = 'Fadna Tea' | 'Fadna Life Science';
export type BOMRunStatus = 'In BOM Stage' | 'Partially Transferred' | 'Completed';

export interface IBOMPackingItemUsed {
  packingMaterial: Types.ObjectId;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
}

export interface IBOMRun extends Document {
  bomRunNumber: string; // e.g. BOM-20261026-0001
  bomName: string; // e.g. "Shape-Up WIP Packing Run #1"
  division: ProductDivision;
  finishedGood: Types.ObjectId;
  finishedGoodName: string;
  finishedGoodSku: string;
  blendStock: Types.ObjectId;
  blendCode: string;
  blendName: string;
  blendWeightConsumed: number; // in kg
  blendWeightUnit: string; // 'kg'
  packingMaterialsUsed: IBOMPackingItemUsed[];
  bomProductCount: number; // Initial product count produced in BOM stage
  availableBOMCount: number; // Current remaining WIP product count in BOM stage
  transferredToFGCount: number; // How many transferred into Finished Goods
  status: BOMRunStatus;
  notes?: string;
  createdBy: Types.ObjectId;
  createdByName: string;
  lastEditedBy?: ILastEditedBy;
  createdAt: Date;
  updatedAt: Date;
}

const BOMPackingItemUsedSchema = new Schema<IBOMPackingItemUsed>(
  {
    packingMaterial: { type: Schema.Types.ObjectId, ref: 'PackingMaterial', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, default: 'Pcs' },
  },
  { _id: false }
);

const BOMRunSchema = new Schema<IBOMRun>(
  {
    bomRunNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    bomName: {
      type: String,
      required: true,
      trim: true,
    },
    division: {
      type: String,
      enum: ['Fadna Tea', 'Fadna Life Science'],
      default: 'Fadna Tea',
      required: true,
    },
    finishedGood: {
      type: Schema.Types.ObjectId,
      ref: 'FinishedGood',
      required: true,
    },
    finishedGoodName: {
      type: String,
      required: true,
    },
    finishedGoodSku: {
      type: String,
      required: true,
    },
    blendStock: {
      type: Schema.Types.ObjectId,
      ref: 'BlendStock',
      required: true,
    },
    blendCode: {
      type: String,
      required: true,
    },
    blendName: {
      type: String,
      required: true,
    },
    blendWeightConsumed: {
      type: Number,
      required: true,
      min: 0.001,
    },
    blendWeightUnit: {
      type: String,
      default: 'kg',
    },
    packingMaterialsUsed: [BOMPackingItemUsedSchema],
    bomProductCount: {
      type: Number,
      required: true,
      min: 1,
    },
    availableBOMCount: {
      type: Number,
      required: true,
      min: 0,
    },
    transferredToFGCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['In BOM Stage', 'Partially Transferred', 'Completed'],
      default: 'In BOM Stage',
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
    },
    lastEditedBy: {
      type: LastEditedBySchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const BOMRun = mongoose.model<IBOMRun>('BOMRun', BOMRunSchema);
