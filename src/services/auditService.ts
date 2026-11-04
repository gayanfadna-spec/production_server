import { Types } from 'mongoose';
import { AuditLog, AuditAction, AuditEntityType, IFieldChange } from '../models/AuditLog.js';
import { IUser } from '../models/User.js';

interface LogOptions {
  user?: IUser | { _id?: string | Types.ObjectId; name: string; email?: string; role?: string };
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityName: string;
  summary: string;
  changes?: IFieldChange[];
  metadata?: Record<string, any>;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  sku: 'SKU Code',
  shortCode: 'Short Code',
  category: 'Category',
  division: 'Division',
  unit: 'Unit',
  packSize: 'Pack Size',
  productionFloorStock: 'Production Floor Stock',
  finishedStoreStock: 'Finished Store Stock',
  currentStock: 'Current Stock',
  physicalActualStock: 'Physical Actual Stock',
  minReorderLevel: 'Min Reorder Level',
  standardBatchSize: 'Batch Size',
  costPerUnit: 'Cost Per Unit',
  sellingPrice: 'Selling Price',
  supplier: 'Supplier',
  storageLocation: 'Storage Location',
  description: 'Description',
  isActive: 'Active Status',
  role: 'User Role',
  department: 'Department',
  email: 'Email',
  batchSize: 'BOM Batch Size',
  version: 'BOM Version',
  notes: 'Notes',
};

export class AuditService {
  /**
   * Directly record an audit log entry
   */
  static async record(opts: LogOptions): Promise<void> {
    try {
      const performedByName = opts.user?.name || 'System Auto';
      const performedByEmail = opts.user?.email || '';
      const performedByRole = opts.user?.role || 'system';
      const performedById = opts.user?._id
        ? new Types.ObjectId(String(opts.user._id))
        : undefined;

      await AuditLog.create({
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId || '',
        entityName: opts.entityName,
        performedBy: performedById,
        performedByName,
        performedByEmail,
        performedByRole,
        summary: opts.summary,
        changes: opts.changes || [],
        metadata: opts.metadata || {},
      });
    } catch (err: any) {
      console.error('[AuditService] Failed to record audit log:', err.message);
    }
  }

  /**
   * Compare two plain objects or mongoose documents and extract diffs + human readable summary
   */
  static diff(
    oldDoc: Record<string, any>,
    newFields: Record<string, any>,
    ignoredKeys: string[] = ['_id', '__v', 'createdAt', 'updatedAt', 'lastEditedBy', 'password', 'id']
  ): { changes: IFieldChange[]; summary: string } {
    const changes: IFieldChange[] = [];
    const changeSummaries: string[] = [];

    const oldObj = typeof oldDoc.toObject === 'function' ? oldDoc.toObject() : oldDoc;

    for (const key of Object.keys(newFields)) {
      if (ignoredKeys.includes(key)) continue;

      const oldVal = oldObj[key];
      const newVal = newFields[key];

      // Deep/loose comparison
      const isDifferent =
        typeof newVal === 'object' && newVal !== null
          ? JSON.stringify(oldVal) !== JSON.stringify(newVal)
          : oldVal !== newVal && newVal !== undefined;

      if (isDifferent) {
        const label = FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
        changes.push({
          field: key,
          label,
          oldValue: oldVal === undefined ? null : oldVal,
          newValue: newVal,
        });

        // Human readable short snippet
        if (typeof oldVal === 'boolean' || typeof newVal === 'boolean') {
          changeSummaries.push(`${label}: ${oldVal ? 'Enabled' : 'Disabled'} → ${newVal ? 'Enabled' : 'Disabled'}`);
        } else if (typeof newVal === 'number' || typeof oldVal === 'number') {
          changeSummaries.push(`${label}: ${oldVal ?? 0} → ${newVal}`);
        } else if (typeof newVal === 'string') {
          changeSummaries.push(`${label}: "${oldVal || ''}" → "${newVal}"`);
        } else {
          changeSummaries.push(`Updated ${label}`);
        }
      }
    }

    const summary = changeSummaries.length > 0
      ? changeSummaries.join(', ')
      : 'Updated record details';

    return { changes, summary };
  }
}
