import mongoose, { Document, Schema } from 'mongoose';

export interface IDailyPackagingWIP extends Document {
  date: string; // YYYY-MM-DD
  division: 'Fadna Tea' | 'Fadna Life Science';
  boxStock: number;
  pasted: number;
  pasting: number;
  box: number;
  pouch: number;
  pouchStock: number;
  updatedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DailyPackagingWIPSchema = new Schema<IDailyPackagingWIP>(
  {
    date: { type: String, required: true },
    division: {
      type: String,
      enum: ['Fadna Tea', 'Fadna Life Science'],
      default: 'Fadna Tea',
    },
    boxStock: { type: Number, default: 0 },
    pasted: { type: Number, default: 0 },
    pasting: { type: Number, default: 0 },
    box: { type: Number, default: 0 },
    pouch: { type: Number, default: 0 },
    pouchStock: { type: Number, default: 0 },
    updatedBy: { type: String, default: 'Store Keeper' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

DailyPackagingWIPSchema.index({ date: 1, division: 1 }, { unique: true });

export const DailyPackagingWIP = mongoose.model<IDailyPackagingWIP>(
  'DailyPackagingWIP',
  DailyPackagingWIPSchema
);
