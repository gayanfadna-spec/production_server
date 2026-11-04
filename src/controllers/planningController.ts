import { Request, Response } from 'express';
import { StockService } from '../services/stockService.js';
import { SalesTarget } from '../models/SalesTarget.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';

export const getProductionCapacity = async (req: Request, res: Response): Promise<any> => {
  try {
    const { finishedGoodId } = req.query;
    const capacity = await StockService.calculateCapacity(
      finishedGoodId ? String(finishedGoodId) : undefined
    );

    return res.json({ success: true, count: capacity.length, data: capacity });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const calculateSalesPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array with finishedGoodId and targetQuantity is required',
      });
    }

    const plan = await StockService.calculateSalesPlanRequirements(items);
    return res.json({ success: true, data: plan });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveSalesTarget = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { title, period, items, notes } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const salesTarget = new SalesTarget({
      title,
      period,
      items,
      notes,
      createdBy: req.user._id,
      createdByName: req.user.name,
      status: 'Approved',
    });

    await salesTarget.save();
    return res.status(201).json({
      success: true,
      message: 'Sales Target plan saved successfully',
      data: salesTarget,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getSalesTargets = async (req: Request, res: Response): Promise<any> => {
  try {
    const targets = await SalesTarget.find()
      .populate('items.finishedGood')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: targets.length, data: targets });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const calculateThreeMonthMRP = async (req: Request, res: Response): Promise<any> => {
  try {
    const { division, months, demands } = req.body;

    if (!demands || !Array.isArray(demands) || demands.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Demands array with finishedGoodId, month1, month2, and month3 is required',
      });
    }

    const mrpResult = await StockService.calculateThreeMonthMRP({
      division,
      months,
      demands,
    });

    return res.json({ success: true, data: mrpResult });
  } catch (error: any) {
    console.error('[calculateThreeMonthMRP Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

