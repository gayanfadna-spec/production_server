import { Request, Response } from 'express';
import { StockTransaction } from '../models/StockTransaction.js';
import { StockService } from '../services/stockService.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { AuditService } from '../services/auditService.js';

export const getTransactions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { startDate, endDate, itemType, reason, transactionType, search, limit = 50, page = 1 } = req.query;
    const filter: any = {};

    if (itemType && itemType !== 'all') {
      filter.itemType = itemType;
    }

    if (reason && reason !== 'all') {
      filter.reason = reason;
    }

    if (transactionType && transactionType !== 'all') {
      filter.transactionType = transactionType;
    }

    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) {
        const start = new Date(String(startDate));
        start.setHours(0, 0, 0, 0);
        filter.transactionDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        filter.transactionDate.$lte = end;
      }
    }

    if (search) {
      filter.$or = [
        { transactionNumber: { $regex: String(search), $options: 'i' } },
        { itemName: { $regex: String(search), $options: 'i' } },
        { itemSku: { $regex: String(search), $options: 'i' } },
        { referenceNumber: { $regex: String(search), $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await StockTransaction.countDocuments(filter);
    const transactions = await StockTransaction.find(filter)
      .sort({ transactionDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      count: transactions.length,
      data: transactions,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTransaction = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const {
      itemType,
      itemId,
      transactionType,
      reason,
      quantity,
      location,
      fromLocation,
      toLocation,
      referenceNumber,
      notes,
      unitCost,
    } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const txn = await StockService.recordMovement({
      itemType,
      itemId,
      transactionType,
      reason,
      quantity: Number(quantity),
      location,
      fromLocation,
      toLocation,
      referenceNumber,
      notes,
      unitCost: unitCost ? Number(unitCost) : undefined,
      userId: req.user._id.toString(),
      userName: req.user.name,
    });

    const actionMap: Record<string, any> = {
      IN: 'STOCK_IN',
      OUT: 'STOCK_OUT',
      TRANSFER: 'TRANSFER',
      ADJUSTMENT: 'ADJUSTMENT',
    };

    await AuditService.record({
      user: req.user,
      action: actionMap[transactionType] || 'UPDATE',
      entityType: itemType as any,
      entityId: itemId,
      entityName: `${txn.itemName} (${txn.itemSku})`,
      summary: `${transactionType} ${quantity} ${txn.unit} [${reason}] (Ref: ${txn.transactionNumber})`,
      changes: [
        {
          field: 'movement',
          label: 'Stock Movement',
          oldValue: null,
          newValue: `${transactionType} ${quantity} ${txn.unit}`,
        },
      ],
      metadata: {
        transactionNumber: txn.transactionNumber,
        referenceNumber,
        fromLocation: txn.fromLocation,
        toLocation: txn.toLocation,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Stock movement recorded successfully',
      data: txn,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const executeProductionRun = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { finishedGoodId, quantityToProduce, destinationLocation, batchNumber, notes } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!finishedGoodId || !quantityToProduce || !batchNumber) {
      return res.status(400).json({
        success: false,
        message: 'finishedGoodId, quantityToProduce, and batchNumber are required',
      });
    }

    const result = await StockService.executeProductionRun({
      finishedGoodId,
      quantityToProduce: Number(quantityToProduce),
      destinationLocation: destinationLocation || 'Production Floor',
      batchNumber,
      notes,
      userId: req.user._id.toString(),
      userName: req.user.name,
    });

    await AuditService.record({
      user: req.user,
      action: 'PRODUCTION_RUN',
      entityType: 'FinishedGood',
      entityId: finishedGoodId,
      entityName: `Production Run: Batch ${batchNumber}`,
      summary: `Completed production run: Produced ${quantityToProduce} units (Batch: ${batchNumber}) to ${destinationLocation || 'Production Floor'}`,
      metadata: { batchNumber, quantityToProduce },
    });

    return res.status(201).json({
      success: true,
      message: `Production run completed successfully for ${quantityToProduce} units`,
      data: result,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
