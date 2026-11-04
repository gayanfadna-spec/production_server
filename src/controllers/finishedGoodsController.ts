import { Request, Response } from 'express';
import { FinishedGood } from '../models/FinishedGood.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { AuditService } from '../services/auditService.js';

export const getFinishedGoods = async (req: Request, res: Response): Promise<any> => {
  try {
    const { search, category, lowStock } = req.query;
    const filter: any = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: String(search), $options: 'i' } },
        { sku: { $regex: String(search), $options: 'i' } },
        { shortCode: { $regex: String(search), $options: 'i' } },
      ];
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    const items = await FinishedGood.find(filter).sort({ name: 1 });

    const formatted = items.map((item) => {
      const total = (item.productionFloorStock || 0) + (item.finishedStoreStock || 0);
      const isLowStock = total <= item.minReorderLevel;
      return {
        ...item.toObject(),
        totalStock: total,
        isLowStock,
      };
    });

    const result = lowStock === 'true' ? formatted.filter((item) => item.isLowStock) : formatted;

    return res.json({ success: true, count: result.length, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getFinishedGoodById = async (req: Request, res: Response): Promise<any> => {
  try {
    const item = await FinishedGood.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Finished good not found' });
    return res.json({ success: true, data: item });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createFinishedGood = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const editorName = req.user?.name || 'Administrator';
    const item = new FinishedGood({
      ...req.body,
      lastEditedBy: {
        userId: req.user?._id,
        userName: editorName,
        userEmail: req.user?.email || '',
        userRole: req.user?.role || 'admin',
        editedAt: new Date(),
        summary: `Created product SKU '${req.body.sku}' by ${editorName}`,
      },
    });

    await item.save();

    await AuditService.record({
      user: req.user,
      action: 'CREATE',
      entityType: 'FinishedGood',
      entityId: item._id.toString(),
      entityName: `${item.name} (${item.sku})`,
      summary: `Created Finished Good SKU '${item.sku}' with unit cost LKR ${item.costPerUnit}`,
    });

    return res.status(201).json({ success: true, message: 'Finished good created', data: item });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateFinishedGood = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const item = await FinishedGood.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Finished good not found' });

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
        entityType: 'FinishedGood',
        entityId: item._id.toString(),
        entityName: `${item.name} (${item.sku})`,
        summary,
        changes,
      });
    }

    return res.json({ success: true, message: 'Finished good updated', data: item });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteFinishedGood = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const item = await FinishedGood.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Finished good not found' });

    item.isActive = false;
    const editorName = req.user?.name || 'Administrator';
    item.lastEditedBy = {
      userId: req.user?._id,
      userName: editorName,
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'admin',
      editedAt: new Date(),
      summary: `Archived product SKU '${item.sku}' by ${editorName}`,
    };
    await item.save();

    await AuditService.record({
      user: req.user,
      action: 'DELETE',
      entityType: 'FinishedGood',
      entityId: item._id.toString(),
      entityName: `${item.name} (${item.sku})`,
      summary: `Archived Finished Good SKU '${item.sku}'`,
    });

    return res.json({ success: true, message: 'Finished good archived' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
