import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISalesTargetItem {
  finishedGood: Types.ObjectId;
  targetQuantity: number;
  unit: string;
  expectedDate?: Date;
  notes?: string;
}

export interface ISalesTarget extends Document {
  title: string;
  period: string; // e.g. "Q4 2026", "October 2026"
  status: 'Draft' | 'Approved' | 'Executed';
  items: ISalesTargetItem[];
  createdBy: Types.ObjectId;
  createdByName: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesTargetItemSchema = new Schema<ISalesTargetItem>(
  {
    finishedGood: { type: Schema.Types.ObjectId, ref: 'FinishedGood', required: true },
    targetQuantity: { type: Number, required: true, min: 1 },
    unit: { type: String, default: 'Packs' },
    expectedDate: { type: Date },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const SalesTargetSchema = new Schema<ISalesTarget>(
  {
    title: { type: String, required: true, trim: true },
    period: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['Draft', 'Approved', 'Executed'],
      default: 'Draft',
    },
    items: [SalesTargetItemSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const SalesTarget = mongoose.model<ISalesTarget>('SalesTarget', SalesTargetSchema);
