import mongoose, { Document, Schema, Types } from 'mongoose';

export type ItemType = 'FinishedGood' | 'RawMaterial' | 'PackingMaterial';
export type TransactionType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
export type MovementReason =
  | 'Production'
  | 'Purchase'
  | 'Sales'
  | 'Floor_Transfer'
  | 'Adjustment'
  | 'Return'
  | 'Wastage'
  | 'QA_Sampling';

export type StockLocation =
  | 'Production Floor'
  | 'Finished Store'
  | 'RM Warehouse'
  | 'PM Warehouse'
  | 'External / Supplier'
  | 'Customer Dispatch';

export interface IStockTransaction extends Document {
  transactionNumber: string;
  division?: 'Fadna Tea' | 'Fadna Life Science';
  channel?: string; // e.g. Cargills, Super K, Pharmacy, City Pack, Export, Free Issue, Loading
  itemType: ItemType;
  itemRef: Types.ObjectId;
  itemName: string;
  itemSku: string;
  itemShortCode?: string;
  transactionType: TransactionType;
  reason: MovementReason;
  fromLocation?: StockLocation | string;
  toLocation?: StockLocation | string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
  referenceNumber?: string;
  productionOrderId?: Types.ObjectId;
  notes?: string;
  performedBy: Types.ObjectId;
  performedByName: string;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StockTransactionSchema = new Schema<IStockTransaction>(
  {
    transactionNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    division: {
      type: String,
      enum: ['Fadna Tea', 'Fadna Life Science'],
      default: 'Fadna Tea',
    },
    channel: { type: String, default: 'General' },
    itemType: {
      type: String,
      required: true,
      enum: ['FinishedGood', 'RawMaterial', 'PackingMaterial'],
    },
    itemRef: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'itemType',
    },
    itemName: { type: String, required: true },
    itemSku: { type: String, required: true },
    itemShortCode: { type: String, default: '' },
    transactionType: {
      type: String,
      required: true,
      enum: ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'],
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'Production',
        'Purchase',
        'Sales',
        'Floor_Transfer',
        'Adjustment',
        'Return',
        'Wastage',
        'QA_Sampling',
      ],
    },
    fromLocation: { type: String, default: '' },
    toLocation: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 0.0001 },
    unit: { type: String, required: true },
    unitCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    referenceNumber: { type: String, default: '' },
    productionOrderId: { type: Schema.Types.ObjectId, ref: 'ProductionOrder' },
    notes: { type: String, default: '' },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, required: true },
    transactionDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

StockTransactionSchema.index({ transactionDate: -1 });
StockTransactionSchema.index({ division: 1 });
StockTransactionSchema.index({ itemType: 1, itemRef: 1 });
StockTransactionSchema.index({ reason: 1 });
StockTransactionSchema.index({ channel: 1 });

export const StockTransaction = mongoose.model<IStockTransaction>(
  'StockTransaction',
  StockTransactionSchema
);
