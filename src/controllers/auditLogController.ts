import { Response } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      entityType,
      entityId,
      userId,
      search,
      startDate,
      endDate,
    } = req.query;

    const filter: any = {};

    if (action && action !== 'all') {
      filter.action = action;
    }

    if (entityType && entityType !== 'all') {
      filter.entityType = entityType;
    }

    if (entityId) {
      filter.entityId = entityId;
    }

    if (userId) {
      filter.performedBy = userId;
    }

    if (search) {
      filter.$or = [
        { entityName: { $regex: String(search), $options: 'i' } },
        { performedByName: { $regex: String(search), $options: 'i' } },
        { summary: { $regex: String(search), $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(String(startDate));
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      count: logs.length,
      data: logs,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getRecentAuditLogs = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const limit = Number(req.query.limit) || 20;
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getEntityAuditLogs = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { entityType, entityId } = req.params;
    const logs = await AuditLog.find({ entityType, entityId })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
