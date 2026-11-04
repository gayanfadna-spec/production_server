import mongoose, { Document, Schema, Types } from 'mongoose';

export type ProductionStatus = 'Draft' | 'Planned' | 'In_Progress' | 'Completed' | 'Cancelled';

export interface IAllocatedMaterial {
  materialType: 'RawMaterial' | 'PackingMaterial';
  materialId: Types.ObjectId;
  materialName: string;
  sku: string;
  requiredQty: number;
  allocatedQty: number;
  unit: string;
  isDeducted: boolean;
}

export interface IProductionOrder extends Document {
  orderNumber: string;
  finishedGood: Types.ObjectId;
  finishedGoodName: string;
  finishedGoodSku: string;
  targetQuantity: number;
  completedQuantity: number;
  unit: string;
  status: ProductionStatus;
  batchNumber: string;
  targetLocation: 'Production Floor' | 'Finished Store';
  startDate: Date;
  targetCompletionDate?: Date;
  actualCompletionDate?: Date;
  allocatedMaterials: IAllocatedMaterial[];
  notes?: string;
  createdBy: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const AllocatedMaterialSchema = new Schema<IAllocatedMaterial>(
  {
    materialType: {
      type: String,
      required: true,
      enum: ['RawMaterial', 'PackingMaterial'],
    },
    materialId: { type: Schema.Types.ObjectId, required: true },
    materialName: { type: String, required: true },
    sku: { type: String, required: true },
    requiredQty: { type: Number, required: true },
    allocatedQty: { type: Number, default: 0 },
    unit: { type: String, required: true },
    isDeducted: { type: Boolean, default: false },
  },
  { _id: false }
);

const ProductionOrderSchema = new Schema<IProductionOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    finishedGood: { type: Schema.Types.ObjectId, ref: 'FinishedGood', required: true },
    finishedGoodName: { type: String, required: true },
    finishedGoodSku: { type: String, required: true },
    targetQuantity: { type: Number, required: true, min: 1 },
    completedQuantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'Packs' },
    status: {
      type: String,
      enum: ['Draft', 'Planned', 'In_Progress', 'Completed', 'Cancelled'],
      default: 'Planned',
    },
    batchNumber: { type: String, required: true },
    targetLocation: {
      type: String,
      enum: ['Production Floor', 'Finished Store'],
      default: 'Production Floor',
    },
    startDate: { type: Date, default: Date.now },
    targetCompletionDate: { type: Date },
    actualCompletionDate: { type: Date },
    allocatedMaterials: [AllocatedMaterialSchema],
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

export const ProductionOrder = mongoose.model<IProductionOrder>(
  'ProductionOrder',
  ProductionOrderSchema
);
