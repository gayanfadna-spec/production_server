import mongoose, { Document, Schema, Types } from 'mongoose';
import { ILastEditedBy, LastEditedBySchema } from './User.js';

export interface IBOMItemRaw {
  rawMaterial: Types.ObjectId;
  percentage?: number; // Raw material percentage in blend (e.g. 55%)
  quantity: number; // e.g. grams or kg per batch
  unit: string;
  wastagePercent: number;
}

export interface IBOMItemPacking {
  packingMaterial: Types.ObjectId;
  quantity: number; // e.g. pcs or meters per batch
  unit: string;
  wastagePercent: number;
}

export interface IBOMStageItem {
  rawMaterial: Types.ObjectId;
  rawMaterialName?: string;
  percentage?: number; // e.g. 30%
  quantity?: number; // e.g. grams or kg
  unit?: string;
  wastagePercent?: number;
  notes?: string;
}

export interface IBOMStage {
  stageNumber: number; // 1, 2, etc.
  stageName: string; // e.g. "Herbal Extraction Phase", "TBC Extract Phase"
  stageType: 'extraction' | 'pre-blend' | 'milling' | 'infusion' | 'sub-blend' | 'main-formulation';
  outputItemName: string; // e.g. "Vernolac Herbal Extract", "Satiny Extract", "Zeitgain Herbal Extract"
  outputContributionPercent?: number; // Contribution to main blend (e.g. 28.626%, 2%)
  outputQuantity?: number; // e.g. 0.90317881 kg
  outputUnit?: string; // 'kg', 'g', '%'
  ingredients: IBOMStageItem[];
  instructions?: string;
}

export interface IBOM extends Document {
  finishedGood: Types.ObjectId;
  formulaName?: string;
  division?: 'Fadna Tea' | 'Fadna Life Science';
  blendGramsPerUnit?: number; // Grams of blend needed per pack
  batchSize: number; // quantity of FG produced by this BOM recipe
  unit: string; // unit of FG, e.g. 'Packs'
  version: string;
  rawMaterials: IBOMItemRaw[];
  packingMaterials: IBOMItemPacking[];
  isMultiStage?: boolean; // Flag indicating multi-stage / sub-blend
  stages?: IBOMStage[]; // Detailed sub-blend / extraction stages
  notes?: string;
  isActive: boolean;
  lastEditedBy?: ILastEditedBy;
  createdAt: Date;
  updatedAt: Date;
}

const BOMItemRawSchema = new Schema<IBOMItemRaw>(
  {
    rawMaterial: { type: Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    quantity: { type: Number, required: true, min: 0.0001 },
    unit: { type: String, required: true, default: 'g' },
    wastagePercent: { type: Number, default: 2.0, min: 0 },
  },
  { _id: false }
);

const BOMItemPackingSchema = new Schema<IBOMItemPacking>(
  {
    packingMaterial: { type: Schema.Types.ObjectId, ref: 'PackingMaterial', required: true },
    quantity: { type: Number, required: true, min: 0.0001 },
    unit: { type: String, required: true, default: 'Pcs' },
    wastagePercent: { type: Number, default: 1.5, min: 0 },
  },
  { _id: false }
);

const BOMStageItemSchema = new Schema<IBOMStageItem>(
  {
    rawMaterial: { type: Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    rawMaterialName: { type: String, default: '' },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: '%' },
    wastagePercent: { type: Number, default: 2.0, min: 0 },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const BOMStageSchema = new Schema<IBOMStage>(
  {
    stageNumber: { type: Number, required: true, default: 1 },
    stageName: { type: String, required: true },
    stageType: {
      type: String,
      enum: ['extraction', 'pre-blend', 'milling', 'infusion', 'sub-blend', 'main-formulation'],
      default: 'extraction',
    },
    outputItemName: { type: String, default: '' },
    outputContributionPercent: { type: Number, default: 0 },
    outputQuantity: { type: Number, default: 0 },
    outputUnit: { type: String, default: '%' },
    ingredients: [BOMStageItemSchema],
    instructions: { type: String, default: '' },
  },
  { _id: false }
);

const BOMSchema = new Schema<IBOM>(
  {
    finishedGood: {
      type: Schema.Types.ObjectId,
      ref: 'FinishedGood',
      required: true,
      unique: true,
    },
    formulaName: { type: String, default: '' },
    division: {
      type: String,
      enum: ['Fadna Tea', 'Fadna Life Science'],
      default: 'Fadna Tea',
    },
    blendGramsPerUnit: { type: Number, default: 40, min: 0.1 },
    batchSize: { type: Number, required: true, default: 1, min: 1 },
    unit: { type: String, required: true, default: 'Packs' },
    version: { type: String, default: 'v1.0' },
    rawMaterials: [BOMItemRawSchema],
    packingMaterials: [BOMItemPackingSchema],
    isMultiStage: { type: Boolean, default: false },
    stages: [BOMStageSchema],
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastEditedBy: { type: LastEditedBySchema, default: null },
  },
  { timestamps: true }
);

export const BOM = mongoose.model<IBOM>('BOM', BOMSchema);
