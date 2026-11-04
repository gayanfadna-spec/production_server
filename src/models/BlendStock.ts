import mongoose, { Document, Schema, Types } from 'mongoose';
import { ILastEditedBy, LastEditedBySchema } from './User.js';

export type ProductDivision = 'Fadna Tea' | 'Fadna Life Science';
export type BlendStatus = 'In Stock' | 'Partially Consumed' | 'Depleted';

export interface IBlendIngredient {
  rawMaterial: Types.ObjectId;
  rawMaterialName: string;
  sku: string;
  percentage?: number; // Raw material % in blend (e.g. 55%)
  quantity: number; // in kg or g
  unit: string;
}

export interface IBlendStock extends Document {
  blendCode: string; // e.g. BLD-20261026-0001
  blendName: string; // e.g. "Shape-Up Master Herbal Blend Batch #1"
  division: ProductDivision;
  blendType?: 'Master Blend' | 'Sub-Blend' | 'Extraction';
  stageName?: string;
  targetFinishedGood: Types.ObjectId;
  targetFinishedGoodName: string;
  targetFinishedGoodSku: string;
  ingredients: IBlendIngredient[];
  totalWeight: number; // in kg
  availableWeight: number; // in kg
  weightUnit: string; // default 'kg'
  blendGramsPerFinishedUnit: number; // e.g. 40g per pack
  predictedProductCount: number; // e.g. (availableWeight * 1000) / blendGramsPerFinishedUnit
  initialProductCount: number;
  status: BlendStatus;
  notes?: string;
  createdBy: Types.ObjectId;
  createdByName: string;
  lastEditedBy?: ILastEditedBy;
  createdAt: Date;
  updatedAt: Date;
}

const BlendIngredientSchema = new Schema<IBlendIngredient>(
  {
    rawMaterial: { type: Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    rawMaterialName: { type: String, required: true },
    sku: { type: String, required: true },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, default: 'kg' },
  },
  { _id: false }
);

const BlendStockSchema = new Schema<IBlendStock>(
  {
    blendCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    blendName: {
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
    blendType: {
      type: String,
      enum: ['Master Blend', 'Sub-Blend', 'Extraction'],
      default: 'Master Blend',
    },
    stageName: {
      type: String,
      default: '',
    },
    targetFinishedGood: {
      type: Schema.Types.ObjectId,
      ref: 'FinishedGood',
      required: true,
    },
    targetFinishedGoodName: {
      type: String,
      required: true,
    },
    targetFinishedGoodSku: {
      type: String,
      required: true,
    },
    ingredients: [BlendIngredientSchema],
    totalWeight: {
      type: Number,
      required: true,
      min: 0.001,
    },
    availableWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    weightUnit: {
      type: String,
      default: 'kg',
    },
    blendGramsPerFinishedUnit: {
      type: Number,
      required: true,
      default: 40,
      min: 0.1,
    },
    predictedProductCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    initialProductCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['In Stock', 'Partially Consumed', 'Depleted'],
      default: 'In Stock',
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

export const BlendStock = mongoose.model<IBlendStock>('BlendStock', BlendStockSchema);
