import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { BlendStock, IBlendIngredient } from '../models/BlendStock.js';
import { RawMaterial } from '../models/RawMaterial.js';
import { FinishedGood } from '../models/FinishedGood.js';
import { BOM } from '../models/BOM.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { StockService } from '../services/stockService.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';

export const createBlend = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const {
      blendName,
      division,
      blendType,
      stageName,
      targetFinishedGoodId,
      ingredients, // Array of { rawMaterialId, quantity, unit }
      totalWeight, // in kg
      blendGramsPerFinishedUnit, // optional, default 40
      notes,
    } = req.body;

    if (!blendName || !blendName.trim()) {
      return res.status(400).json({ success: false, message: 'Blend Name is required' });
    }

    if (!targetFinishedGoodId) {
      return res.status(400).json({ success: false, message: 'Target Finished Good is required' });
    }

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one raw material ingredient is required' });
    }

    const fg = await FinishedGood.findById(targetFinishedGoodId);
    if (!fg) {
      return res.status(404).json({ success: false, message: 'Target Finished Good not found' });
    }

    // Determine blend grams per finished unit from request, or BOM, or default to 40g
    let gramsPerUnit = Number(blendGramsPerFinishedUnit);
    if (!gramsPerUnit || gramsPerUnit <= 0) {
      const bom = await BOM.findOne({ finishedGood: fg._id, isActive: true });
      if (bom && bom.blendGramsPerUnit) {
        gramsPerUnit = bom.blendGramsPerUnit;
      } else {
        gramsPerUnit = 40; // standard 40g per 20s pack
      }
    }

    // Determine final total weight first
    let finalTotalWeight = totalWeight && Number(totalWeight) > 0 ? Number(totalWeight) : 0;
    if (finalTotalWeight <= 0) {
      finalTotalWeight = ingredients.reduce((sum: number, item: any) => {
        const q = Number(item.quantity) || 0;
        return sum + (item.unit === 'g' ? q / 1000 : q);
      }, 0);
    }

    if (finalTotalWeight <= 0) {
      return res.status(400).json({ success: false, message: 'Total Blend Weight must be greater than zero' });
    }

    // Validate raw material stock availability
    const resolvedIngredients: IBlendIngredient[] = [];
    const rmUpdates: Array<{ rm: any; deductQty: number }> = [];

    for (const item of ingredients) {
      const rm = await RawMaterial.findById(item.rawMaterialId);
      if (!rm) {
        return res.status(404).json({ success: false, message: `Raw Material with ID ${item.rawMaterialId} not found` });
      }

      let qty = Number(item.quantity);
      let pct = Number(item.percentage) || 0;

      // If quantity not explicitly provided but percentage is, compute from totalWeight
      if ((!qty || qty <= 0) && pct > 0) {
        qty = Number(((finalTotalWeight * pct) / 100).toFixed(3));
      }

      // If percentage not provided but quantity is, compute from totalWeight
      if (pct <= 0 && qty > 0 && finalTotalWeight > 0) {
        pct = Number(((qty / finalTotalWeight) * 100).toFixed(1));
      }

      if (qty <= 0) {
        return res.status(400).json({ success: false, message: `Invalid quantity or percentage for raw material: ${rm.name}` });
      }

      if (rm.currentStock < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${rm.name}. Current stock: ${rm.currentStock} ${rm.unit}, requested for blend: ${qty} ${rm.unit}`,
        });
      }

      resolvedIngredients.push({
        rawMaterial: rm._id,
        rawMaterialName: rm.name,
        sku: rm.sku,
        percentage: pct,
        quantity: qty,
        unit: item.unit || rm.unit || 'kg',
      });

      rmUpdates.push({ rm, deductQty: qty });
    }

    const predictedProductCount = Math.floor((finalTotalWeight * 1000) / gramsPerUnit);

    // Deduct raw materials from stock and record transactions
    const userId = req.user ? req.user._id : new Types.ObjectId();
    const userName = req.user ? req.user.name : 'Production Manager';

    for (const update of rmUpdates) {
      update.rm.currentStock -= update.deductQty;
      await update.rm.save();

      const txnNum = await StockService.generateTxnNumber();
      await StockTransaction.create({
        transactionNumber: txnNum,
        division: division || fg.division || 'Fadna Tea',
        channel: 'Production Floor',
        itemType: 'RawMaterial',
        itemRef: update.rm._id,
        itemName: update.rm.name,
        itemSku: update.rm.sku,
        transactionType: 'OUT',
        reason: 'Production',
        fromLocation: 'RM Warehouse',
        toLocation: 'Blend Stock',
        quantity: update.deductQty,
        unit: update.rm.unit,
        unitCost: update.rm.costPerUnit,
        totalCost: (update.rm.costPerUnit || 0) * update.deductQty,
        referenceNumber: `BLEND-${blendName.trim().slice(0, 15)}`,
        notes: `Raw material issued and transferred to Blend Stock: ${blendName.trim()}`,
        performedBy: userId,
        performedByName: userName,
        transactionDate: new Date(),
      });
    }

    // Use user-provided blendCode or generate sequential Blend Code
    let blendCode = req.body.blendCode?.trim().toUpperCase();
    if (blendCode) {
      const existing = await BlendStock.findOne({ blendCode });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Blend Unique ID / Code '${blendCode}' already exists for '${existing.blendName}'. Please choose a unique Blend Code.`,
        });
      }
    } else {
      const count = await BlendStock.countDocuments();
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      blendCode = `BLD-${todayStr}-${(count + 1).toString().padStart(4, '0')}`;
    }

    const blend = new BlendStock({
      blendCode,
      blendName: blendName.trim(),
      division: division || fg.division || 'Fadna Tea',
      blendType: blendType || 'Master Blend',
      stageName: stageName || '',
      targetFinishedGood: fg._id,
      targetFinishedGoodName: fg.name,
      targetFinishedGoodSku: fg.sku,
      ingredients: resolvedIngredients,
      totalWeight: finalTotalWeight,
      availableWeight: finalTotalWeight,
      weightUnit: 'kg',
      blendGramsPerFinishedUnit: gramsPerUnit,
      predictedProductCount,
      initialProductCount: predictedProductCount,
      status: 'In Stock',
      notes: notes || '',
      createdBy: userId,
      createdByName: userName,
    });

    await blend.save();

    return res.status(201).json({
      success: true,
      message: `Blend "${blend.blendName}" created successfully with predicted yield of ${predictedProductCount} units`,
      data: blend,
    });
  } catch (error: any) {
    console.error('[createBlend Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBlends = async (req: Request, res: Response): Promise<any> => {
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
        { blendCode: { $regex: String(search), $options: 'i' } },
        { blendName: { $regex: String(search), $options: 'i' } },
        { targetFinishedGoodName: { $regex: String(search), $options: 'i' } },
      ];
    }

    const blends = await BlendStock.find(filter)
      .populate('targetFinishedGood')
      .populate('ingredients.rawMaterial')
      .sort({ createdAt: -1 });

    // Recalculate dynamic predictedProductCount based on current availableWeight
    const enriched = blends.map((b) => {
      const doc = b.toObject();
      doc.predictedProductCount = Math.floor(
        ((b.availableWeight || 0) * 1000) / (b.blendGramsPerFinishedUnit || 40)
      );
      return doc;
    });

    return res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveBlends = async (req: Request, res: Response): Promise<any> => {
  try {
    const { division, finishedGoodId } = req.query;
    const filter: any = {
      availableWeight: { $gt: 0 },
      status: { $in: ['In Stock', 'Partially Consumed'] },
    };

    if (division && division !== 'All') {
      filter.division = division;
    }

    if (finishedGoodId) {
      filter.targetFinishedGood = finishedGoodId;
    }

    const blends = await BlendStock.find(filter)
      .populate('targetFinishedGood')
      .sort({ createdAt: -1 });

    const enriched = blends.map((b) => {
      const doc = b.toObject();
      doc.predictedProductCount = Math.floor(
        ((b.availableWeight || 0) * 1000) / (b.blendGramsPerFinishedUnit || 40)
      );
      return doc;
    });

    return res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBlend = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const blend = await BlendStock.findById(req.params.id);
    if (!blend) return res.status(404).json({ success: false, message: 'Blend not found' });

    const { blendCode, blendName, status, notes, availableWeight } = req.body;

    if (blendCode && blendCode.trim().toUpperCase() !== blend.blendCode.toUpperCase()) {
      const newCode = blendCode.trim().toUpperCase();
      const existing = await BlendStock.findOne({ blendCode: newCode, _id: { $ne: blend._id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Blend Unique ID / Code '${newCode}' is already taken by '${existing.blendName}'. Please choose a unique Blend Code.`,
        });
      }
      blend.blendCode = newCode;
    }

    if (blendName && blendName.trim()) {
      blend.blendName = blendName.trim();
    }

    if (status && ['In Stock', 'Partially Consumed', 'Depleted'].includes(status)) {
      blend.status = status;
    }

    if (notes !== undefined) {
      blend.notes = notes;
    }

    if (availableWeight !== undefined && !isNaN(Number(availableWeight))) {
      blend.availableWeight = Math.max(0, Number(availableWeight));
      blend.predictedProductCount = Math.floor(
        ((blend.availableWeight || 0) * 1000) / (blend.blendGramsPerFinishedUnit || 40)
      );
    }

    const editorName = req.user?.name || 'Administrator';
    blend.lastEditedBy = {
      userId: req.user?._id,
      userName: editorName,
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'admin',
      editedAt: new Date(),
      summary: `Updated blend code '${blend.blendCode}' details by ${editorName}`,
    };

    await blend.save();

    return res.json({ success: true, message: 'Blend updated successfully', data: blend });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
