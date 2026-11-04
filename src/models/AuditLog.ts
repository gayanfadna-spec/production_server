import mongoose, { Document, Schema, Types } from 'mongoose';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'PRODUCTION_RUN'
  | 'LOGIN';

export type AuditEntityType =
  | 'User'
  | 'FinishedGood'
  | 'RawMaterial'
  | 'PackingMaterial'
  | 'BOM'
  | 'StockTransaction'
  | 'SalesTarget'
  | 'DailyMatrix'
  | 'System';

export interface IFieldChange {
  field: string;
  label?: string;
  oldValue: any;
  newValue: any;
}

export interface IAuditLog extends Document {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityName: string;
  performedBy?: Types.ObjectId;
  performedByName: string;
  performedByEmail?: string;
  performedByRole?: string;
  summary: string;
  changes?: IFieldChange[];
  metadata?: Record<string, any>;
  createdAt: Date;
}

const FieldChangeSchema = new Schema(
  {
    field: { type: String, required: true },
    label: { type: String, default: '' },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE',
        'UPDATE',
        'DELETE',
        'STOCK_IN',
        'STOCK_OUT',
        'TRANSFER',
        'ADJUSTMENT',
        'PRODUCTION_RUN',
        'LOGIN',
      ],
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        'User',
        'FinishedGood',
        'RawMaterial',
        'PackingMaterial',
        'BOM',
        'StockTransaction',
        'SalesTarget',
        'DailyMatrix',
        'System',
      ],
    },
    entityId: { type: String, default: '' },
    entityName: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    performedByName: { type: String, required: true },
    performedByEmail: { type: String, default: '' },
    performedByRole: { type: String, default: '' },
    summary: { type: String, required: true },
    changes: [FieldChangeSchema],
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ performedBy: 1 });
AuditLogSchema.index({ action: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
