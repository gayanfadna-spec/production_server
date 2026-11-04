import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { BOMRun, IBOMPackingItemUsed } from '../models/BOMRun.js';
import { BlendStock } from '../models/BlendStock.js';
import { PackingMaterial } from '../models/PackingMaterial.js';
import { FinishedGood } from '../models/FinishedGood.js';
import { BOM } from '../models/BOM.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { StockService } from '../services/stockService.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';

export const createBOMRun = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const {
      bomName,
      blendStockId,
      blendWeightConsumed, // in kg
      packingMaterials, // Array of { packingMaterialId, quantity, unit }
      bomProductCount, // target WIP units produced
      notes,
    } = req.body;

    if (!bomName || !bomName.trim()) {
      return res.status(400).json({ success: false, message: 'BOM Run Name is required' });
    }

    if (!blendStockId) {
      return res.status(400).json({ success: false, message: 'Source Blend from Blend Stock is required' });
    }

    const blend = await BlendStock.findById(blendStockId);
    if (!blend) {
      return res.status(404).json({ success: false, message: 'Selected Blend not found in Blend Stock' });
    }

    const blendWeightToConsume = Number(blendWeightConsumed);
    if (blendWeightToConsume <= 0) {
      return res.status(400).json({ success: false, message: 'Blend weight to consume must be greater than zero' });
    }

    if (blend.availableWeight < blendWeightToConsume) {
      return res.status(400).json({
        success: false,
        message: `Insufficient Blend Stock. Available: ${blend.availableWeight} kg, Requested: ${blendWeightToConsume} kg`,
      });
    }

    const fg = await FinishedGood.findById(blend.targetFinishedGood);
    if (!fg) {
      return res.status(404).json({ success: false, message: 'Target Finished Good not found' });
    }

    // Auto-calculate BOM product count if not explicitly given
    let calculatedProductCount = Number(bomProductCount);
    if (!calculatedProductCount || calculatedProductCount <= 0) {
      const gramsPerUnit = blend.blendGramsPerFinishedUnit || 40;
      calculatedProductCount = Math.floor((blendWeightToConsume * 1000) / gramsPerUnit);
    }

    if (calculatedProductCount <= 0) {
      return res.status(400).json({ success: false, message: 'BOM Product count must be at least 1 unit' });
    }

    // Validate packing materials stock availability
    const resolvedPMs: IBOMPackingItemUsed[] = [];
    const pmUpdates: Array<{ pm: any; deductQty: number }> = [];

    if (packingMaterials && Array.isArray(packingMaterials) && packingMaterials.length > 0) {
      for (const item of packingMaterials) {
        const pm = await PackingMaterial.findById(item.packingMaterialId);
        if (!pm) {
          return res.status(404).json({ success: false, message: `Packing Material with ID ${item.packingMaterialId} not found` });
        }

        const qty = Number(item.quantity);
        if (qty > 0) {
          if (pm.currentStock < qty) {
            return res.status(400).json({
              success: false,
              message: `Insufficient Packing Material: ${pm.name}. Available: ${pm.currentStock} ${pm.unit}, Needed: ${qty} ${pm.unit}`,
            });
          }

          resolvedPMs.push({
            packingMaterial: pm._id,
            name: pm.name,
            sku: pm.sku,
            quantity: qty,
            unit: item.unit || pm.unit || 'Pcs',
          });

          pmUpdates.push({ pm, deductQty: qty });
        }
      }
    } else {
      // If no explicit PMs provided, attempt to auto-pull from BOM definition
      const bom = await BOM.findOne({ finishedGood: fg._id, isActive: true }).populate('packingMaterials.packingMaterial');
      if (bom && bom.packingMaterials.length > 0) {
        const batchRatio = calculatedProductCount / (bom.batchSize || 1);
        for (const pItem of bom.packingMaterials) {
          const pm = pItem.packingMaterial as any;
          if (!pm) continue;
          const wastage = 1 + (pItem.wastagePercent || 0) / 100;
          const requiredQty = Math.ceil(pItem.quantity * batchRatio * wastage);

          if (pm.currentStock < requiredQty) {
            return res.status(400).json({
              success: false,
              message: `Insufficient Packing Material: ${pm.name}. Available: ${pm.currentStock} ${pm.unit}, Required: ${requiredQty} ${pm.unit}`,
            });
          }

          resolvedPMs.push({
            packingMaterial: pm._id,
            name: pm.name,
            sku: pm.sku,
            quantity: requiredQty,
            unit: pm.unit,
          });

          pmUpdates.push({ pm, deductQty: requiredQty });
        }
      }
    }

    const userId = req.user ? req.user._id : new Types.ObjectId();
    const userName = req.user ? req.user.name : 'Production Manager';

    // 1. Deduct Blend available weight
    blend.availableWeight = Math.max(0, blend.availableWeight - blendWeightToConsume);
    blend.predictedProductCount = Math.floor(
      ((blend.availableWeight || 0) * 1000) / (blend.blendGramsPerFinishedUnit || 40)
    );
    blend.status = blend.availableWeight <= 0.001 ? 'Depleted' : 'Partially Consumed';
    await blend.save();

    // 2. Deduct Packing Materials & log Stock OUT transactions
    for (const update of pmUpdates) {
      update.pm.currentStock -= update.deductQty;
      await update.pm.save();

      const txnNum = await StockService.generateTxnNumber();
      await StockTransaction.create({
        transactionNumber: txnNum,
        division: blend.division || fg.division || 'Fadna Tea',
        channel: 'Packaging Line',
        itemType: 'PackingMaterial',
        itemRef: update.pm._id,
        itemName: update.pm.name,
        itemSku: update.pm.sku,
        transactionType: 'OUT',
        reason: 'Production',
        fromLocation: 'PM Warehouse',
        toLocation: 'BOM WIP Stage',
        quantity: update.deductQty,
        unit: update.pm.unit,
        unitCost: update.pm.costPerUnit,
        totalCost: (update.pm.costPerUnit || 0) * update.deductQty,
        referenceNumber: `BOM-${bomName.trim().slice(0, 15)}`,
        notes: `Packing material consumed for BOM Run: ${bomName.trim()}`,
        performedBy: userId,
        performedByName: userName,
        transactionDate: new Date(),
      });
    }

    // 3. Generate sequential BOM Run Number
    const count = await BOMRun.countDocuments();
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const bomRunNumber = `BOM-${todayStr}-${(count + 1).toString().padStart(4, '0')}`;

    const bomRun = new BOMRun({
      bomRunNumber,
      bomName: bomName.trim(),
      division: blend.division || fg.division || 'Fadna Tea',
      finishedGood: fg._id,
      finishedGoodName: fg.name,
      finishedGoodSku: fg.sku,
      blendStock: blend._id,
      blendCode: blend.blendCode,
      blendName: blend.blendName,
      blendWeightConsumed: blendWeightToConsume,
      blendWeightUnit: 'kg',
      packingMaterialsUsed: resolvedPMs,
      bomProductCount: calculatedProductCount,
      availableBOMCount: calculatedProductCount,
      transferredToFGCount: 0,
      status: 'In BOM Stage',
      notes: notes || '',
      createdBy: userId,
      createdByName: userName,
    });

    await bomRun.save();

    return res.status(201).json({
      success: true,
      message: `BOM Run "${bomRun.bomName}" created successfully with ${calculatedProductCount} packaged WIP units in BOM Stage`,
      data: bomRun,
    });
  } catch (error: any) {
    console.error('[createBOMRun Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const transferBOMToFinishedGoods = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const {
      transferQuantity,
      targetLocation = 'Production Floor', // 'Production Floor' | 'Finished Store'
      notes,
    } = req.body;

    const qty = Number(transferQuantity);
    if (!qty || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Transfer quantity must be greater than zero' });
    }

    const bomRun = await BOMRun.findById(id);
    if (!bomRun) {
      return res.status(404).json({ success: false, message: 'BOM Run not found' });
    }

    if (bomRun.availableBOMCount < qty) {
      return res.status(400).json({
        success: false,
        message: `Cannot transfer ${qty} units. Only ${bomRun.availableBOMCount} units available in BOM Stage.`,
      });
    }

    const fg = await FinishedGood.findById(bomRun.finishedGood);
    if (!fg) {
      return res.status(404).json({ success: false, message: 'Target Finished Good not found' });
    }

    // 1. REDUCE BOM COUNT
    bomRun.availableBOMCount -= qty;
    bomRun.transferredToFGCount = (bomRun.transferredToFGCount || 0) + qty;
    bomRun.status = bomRun.availableBOMCount <= 0 ? 'Completed' : 'Partially Transferred';
    await bomRun.save();

    // 2. INCREASE FINISHED GOODS STOCK
    if (targetLocation === 'Finished Store') {
      fg.finishedStoreStock += qty;
    } else {
      fg.productionFloorStock += qty;
    }
    await fg.save();

    // 3. Log Stock IN transaction for Finished Goods
    const userId = req.user ? req.user._id : new Types.ObjectId();
    const userName = req.user ? req.user.name : 'Production Manager';

    const txnNum = await StockService.generateTxnNumber();
    const txn = await StockTransaction.create({
      transactionNumber: txnNum,
      division: fg.division || bomRun.division || 'Fadna Tea',
      channel: 'Production Floor',
      itemType: 'FinishedGood',
      itemRef: fg._id,
      itemName: fg.name,
      itemSku: fg.sku,
      itemShortCode: fg.shortCode,
      transactionType: 'IN',
      reason: 'Production',
      fromLocation: 'BOM WIP Stage',
      toLocation: targetLocation,
      quantity: qty,
      unit: fg.unit,
      unitCost: fg.costPerUnit,
      totalCost: (fg.costPerUnit || 0) * qty,
      referenceNumber: bomRun.bomRunNumber,
      notes: `Transferred ${qty} ${fg.unit} from BOM Run ${bomRun.bomRunNumber} (${bomRun.bomName}) to ${targetLocation}. ${notes || ''}`.trim(),
      performedBy: userId,
      performedByName: userName,
      transactionDate: new Date(),
    });

    return res.json({
      success: true,
      message: `Successfully transferred ${qty} units to Finished Goods (${targetLocation}). Remaining in BOM stage: ${bomRun.availableBOMCount}`,
      data: {
        bomRun,
        finishedGood: fg,
        transaction: txn,
      },
    });
  } catch (error: any) {
    console.error('[transferBOMToFinishedGoods Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBOMRuns = async (req: Request, res: Response): Promise<any> => {
  try {
    const { division, status, search } = req.query;
    const filter: any = {};

    if (division && division !== 'All') {
      filter.division = division;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { bomRunNumber: { $regex: String(search), $options: 'i' } },
        { bomName: { $regex: String(search), $options: 'i' } },
        { finishedGoodName: { $regex: String(search), $options: 'i' } },
        { blendName: { $regex: String(search), $options: 'i' } },
      ];
    }

    const runs = await BOMRun.find(filter)
      .populate('finishedGood')
      .populate('blendStock')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: runs.length, data: runs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveBOMRuns = async (req: Request, res: Response): Promise<any> => {
  try {
    const { division, finishedGoodId } = req.query;
    const filter: any = {
      availableBOMCount: { $gt: 0 },
      status: { $in: ['In BOM Stage', 'Partially Transferred'] },
    };

    if (division && division !== 'All') {
      filter.division = division;
    }

    if (finishedGoodId) {
      filter.finishedGood = finishedGoodId;
    }

    const runs = await BOMRun.find(filter)
      .populate('finishedGood')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: runs.length, data: runs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
