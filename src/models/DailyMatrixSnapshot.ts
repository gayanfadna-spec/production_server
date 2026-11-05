import mongoose, { Document, Schema } from 'mongoose';

export interface IDailyMatrixSnapshot extends Document {
  date: string; // YYYY-MM-DD
  division: 'Fadna Tea' | 'Fadna Life Science';
  // Stores the closing/end-of-day store stock per product shortCode for this date
  closingStoreStocks: { [shortCode: string]: number };
  // Stores opening stock if explicitly recorded
  openingStoreStocks?: { [shortCode: string]: number };
  actualCounts?: { [shortCode: string]: number | null };
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DailyMatrixSnapshotSchema = new Schema<IDailyMatrixSnapshot>(
  {
    date: { type: String, required: true },
    division: {
      type: String,
      enum: ['Fadna Tea', 'Fadna Life Science'],
      default: 'Fadna Tea',
    },
    closingStoreStocks: { type: Map, of: Number, default: {} },
    openingStoreStocks: { type: Map, of: Number, default: {} },
    actualCounts: { type: Map, of: Schema.Types.Mixed, default: {} },
    updatedBy: { type: String, default: 'Factory Dispatcher' },
  },
  { timestamps: true }
);

DailyMatrixSnapshotSchema.index({ date: 1, division: 1 }, { unique: true });

export const DailyMatrixSnapshot = mongoose.model<IDailyMatrixSnapshot>(
  'DailyMatrixSnapshot',
  DailyMatrixSnapshotSchema
);
