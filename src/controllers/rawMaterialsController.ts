import { Request, Response } from 'express';
import { RawMaterial } from '../models/RawMaterial.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { AuditService } from '../services/auditService.js';

export const getRawMaterials = async (req: Request, res: Response): Promise<any> => {
  try {
    const { search, category, lowStock } = req.query;
    const filter: any = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: String(search), $options: 'i' } },
        { sku: { $regex: String(search), $options: 'i' } },
        { botanicalName: { $regex: String(search), $options: 'i' } },
      ];
    }

    if (category && category !== 'all') {
      filter.category = { $regex: new RegExp(`^${String(category).trim()}$`, 'i') };
    }

    const items = await RawMaterial.find(filter).sort({ name: 1 });

    const formatted = items.map((item) => ({
      ...item.toObject(),
      isLowStock: item.currentStock <= item.minReorderLevel,
    }));

    const result = lowStock === 'true' ? formatted.filter((item) => item.isLowStock) : formatted;

    return res.json({ success: true, count: result.length, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getRawMaterialById = async (req: Request, res: Response): Promise<any> => {
  try {
    const item = await RawMaterial.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Raw material not found' });
    return res.json({ success: true, data: item });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createRawMaterial = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const editorName = req.user?.name || 'Administrator';
    let sku = req.body.sku?.trim().toUpperCase();
    if (sku) {
      const existing = await RawMaterial.findOne({ sku });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Raw Material Unique ID / SKU '${sku}' already exists for '${existing.name}'. Please choose a unique SKU.`,
        });
      }
    } else {
      const category = req.body.category || 'Tea';
      const prefix = category === 'Lifescience' ? 'LS' : category === 'QofL' ? 'QOF' : 'TEA';
      const count = await RawMaterial.countDocuments();
      sku = `RM-${prefix}-${(count + 1).toString().padStart(3, '0')}`;
    }

    const item = new RawMaterial({
      ...req.body,
      sku,
      lastEditedBy: {
        userId: req.user?._id,
        userName: editorName,
        userEmail: req.user?.email || '',
        userRole: req.user?.role || 'admin',
        editedAt: new Date(),
        summary: req.body.summary || `Created raw material SKU '${sku}' by ${editorName}`,
      },
    });

    await item.save();

    await AuditService.record({
      user: req.user,
      action: 'CREATE',
      entityType: 'RawMaterial',
      entityId: item._id.toString(),
      entityName: `${item.name} (${item.sku})`,
      summary: `Created Raw Material SKU '${item.sku}' with cost LKR ${item.costPerUnit}/${item.unit}`,
    });

    return res.status(201).json({ success: true, message: 'Raw material created', data: item });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateRawMaterial = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const item = await RawMaterial.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Raw material not found' });

    if (req.body.sku && req.body.sku.trim().toUpperCase() !== item.sku.toUpperCase()) {
      const newSku = req.body.sku.trim().toUpperCase();
      const existing = await RawMaterial.findOne({ sku: newSku, _id: { $ne: item._id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Raw Material Unique ID / SKU '${newSku}' already exists for '${existing.name}'. Please choose a unique SKU.`,
        });
      }
      req.body.sku = newSku;
    }

    const { changes, summary } = AuditService.diff(item.toObject(), req.body);
    const editorName = req.user?.name || 'Administrator';

    Object.assign(item, req.body);
    item.lastEditedBy = {
      userId: req.user?._id,
      userName: editorName,
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'admin',
      editedAt: new Date(),
      summary: changes.length > 0 ? summary : 'Updated details',
    };

    await item.save();

    if (changes.length > 0) {
      await AuditService.record({
        user: req.user,
        action: 'UPDATE',
        entityType: 'RawMaterial',
        entityId: item._id.toString(),
        entityName: `${item.name} (${item.sku})`,
        summary,
        changes,
      });
    }

    return res.json({ success: true, message: 'Raw material updated', data: item });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteRawMaterial = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const item = await RawMaterial.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Raw material not found' });

    item.isActive = false;
    const editorName = req.user?.name || 'Administrator';
    item.lastEditedBy = {
      userId: req.user?._id,
      userName: editorName,
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'admin',
      editedAt: new Date(),
      summary: `Archived raw material SKU '${item.sku}' by ${editorName}`,
    };
    await item.save();

    await AuditService.record({
      user: req.user,
      action: 'DELETE',
      entityType: 'RawMaterial',
      entityId: item._id.toString(),
      entityName: `${item.name} (${item.sku})`,
      summary: `Archived Raw Material SKU '${item.sku}'`,
    });

    return res.json({ success: true, message: 'Raw material archived' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
