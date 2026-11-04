import mongoose, { Types } from 'mongoose';
import { FinishedGood, IFinishedGood } from '../models/FinishedGood.js';
import { RawMaterial, IRawMaterial } from '../models/RawMaterial.js';
import { PackingMaterial, IPackingMaterial } from '../models/PackingMaterial.js';
import { BOM, IBOM } from '../models/BOM.js';
import { BlendStock } from '../models/BlendStock.js';
import { BOMRun } from '../models/BOMRun.js';
import { StockTransaction, IStockTransaction, MovementReason, TransactionType, ItemType } from '../models/StockTransaction.js';

export interface RecordMovementParams {
  itemType: ItemType;
  itemId: string;
  transactionType: TransactionType;
  reason: MovementReason;
  quantity: number;
  location?: 'Production Floor' | 'Finished Store' | 'RM Warehouse' | 'PM Warehouse';
  fromLocation?: string;
  toLocation?: string;
  referenceNumber?: string;
  notes?: string;
  unitCost?: number;
  userId: string;
  userName: string;
}

export class StockService {
  // Generate a formatted sequential transaction code
  public static async generateTxnNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await StockTransaction.countDocuments();
    return `TXN-${today}-${(count + 1).toString().padStart(5, '0')}`;
  }

  // Record a basic movement (IN, OUT, TRANSFER, ADJUSTMENT)
  public static async recordMovement(params: RecordMovementParams): Promise<IStockTransaction> {
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
      userId,
      userName,
    } = params;

    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    const txnNumber = await this.generateTxnNumber();
    let itemName = '';
    let itemSku = '';
    let unit = '';
    let cost = unitCost || 0;

    // Handle Finished Goods
    if (itemType === 'FinishedGood') {
      const fg = await FinishedGood.findById(itemId);
      if (!fg) throw new Error(`Finished Good with ID ${itemId} not found`);

      itemName = fg.name;
      itemSku = fg.sku;
      unit = fg.unit;
      cost = cost || fg.costPerUnit;

      if (reason === 'Floor_Transfer' || transactionType === 'TRANSFER') {
        const sourceLoc = fromLocation || 'Production Floor';
        const destLoc = toLocation || 'Finished Store';

        if (sourceLoc === 'Production Floor' && destLoc === 'Finished Store') {
          if (fg.productionFloorStock < quantity) {
            throw new Error(
              `Insufficient Production Floor Stock. Available: ${fg.productionFloorStock} ${unit}, Requested: ${quantity} ${unit}`
            );
          }
          fg.productionFloorStock -= quantity;
          fg.finishedStoreStock += quantity;
        } else if (sourceLoc === 'Finished Store' && destLoc === 'Production Floor') {
          if (fg.finishedStoreStock < quantity) {
            throw new Error(
              `Insufficient Finished Store Stock. Available: ${fg.finishedStoreStock} ${unit}, Requested: ${quantity} ${unit}`
            );
          }
          fg.finishedStoreStock -= quantity;
          fg.productionFloorStock += quantity;
        } else {
          throw new Error('Invalid transfer locations. Must transfer between Production Floor and Finished Store.');
        }
      } else if (transactionType === 'IN') {
        if (location === 'Finished Store') {
          fg.finishedStoreStock += quantity;
        } else {
          fg.productionFloorStock += quantity;
        }
      } else if (transactionType === 'OUT') {
        if (location === 'Finished Store') {
          if (fg.finishedStoreStock < quantity) {
            throw new Error(
              `Insufficient Finished Store Stock. Available: ${fg.finishedStoreStock} ${unit}, Requested: ${quantity} ${unit}`
            );
          }
          fg.finishedStoreStock -= quantity;
        } else {
          if (fg.productionFloorStock < quantity) {
            throw new Error(
              `Insufficient Production Floor Stock. Available: ${fg.productionFloorStock} ${unit}, Requested: ${quantity} ${unit}`
            );
          }
          fg.productionFloorStock -= quantity;
        }
      } else if (transactionType === 'ADJUSTMENT') {
        if (location === 'Finished Store') {
          fg.finishedStoreStock = quantity;
        } else {
          fg.productionFloorStock = quantity;
        }
      }

      await fg.save();
    }
    // Handle Raw Materials
    else if (itemType === 'RawMaterial') {
      const rm = await RawMaterial.findById(itemId);
      if (!rm) throw new Error(`Raw Material with ID ${itemId} not found`);

      itemName = rm.name;
      itemSku = rm.sku;
      unit = rm.unit;
      cost = cost || rm.costPerUnit;

      if (transactionType === 'IN') {
        rm.currentStock += quantity;
      } else if (transactionType === 'OUT') {
        if (rm.currentStock < quantity) {
          throw new Error(`Insufficient stock for ${rm.name}. Current stock: ${rm.currentStock} ${rm.unit}, requested: ${quantity} ${rm.unit}`);
        }
        rm.currentStock -= quantity;
      } else if (transactionType === 'ADJUSTMENT') {
        rm.currentStock = quantity;
      }

      await rm.save();
    }
    // Handle Packing Materials
    else if (itemType === 'PackingMaterial') {
      const pm = await PackingMaterial.findById(itemId);
      if (!pm) throw new Error(`Packing Material with ID ${itemId} not found`);

      itemName = pm.name;
      itemSku = pm.sku;
      unit = pm.unit;
      cost = cost || pm.costPerUnit;

      if (transactionType === 'IN') {
        pm.currentStock += quantity;
      } else if (transactionType === 'OUT') {
        if (pm.currentStock < quantity) {
          throw new Error(`Insufficient stock for ${pm.name}. Current stock: ${pm.currentStock} ${pm.unit}, requested: ${quantity} ${pm.unit}`);
        }
        pm.currentStock -= quantity;
      } else if (transactionType === 'ADJUSTMENT') {
        pm.currentStock = quantity;
      }

      await pm.save();
    }

    const transaction = new StockTransaction({
      transactionNumber: txnNumber,
      itemType,
      itemRef: new Types.ObjectId(itemId),
      itemName,
      itemSku,
      transactionType,
      reason,
      fromLocation: fromLocation || location || '',
      toLocation: toLocation || location || '',
      quantity,
      unit,
      unitCost: cost,
      totalCost: cost * quantity,
      referenceNumber: referenceNumber || '',
      notes: notes || '',
      performedBy: new Types.ObjectId(userId),
      performedByName: userName,
      transactionDate: new Date(),
    });

    await transaction.save();
    return transaction;
  }

  // Execute a Production Run: Deduct RM + PM based on BOM and increase FG Stock
  public static async executeProductionRun(params: {
    finishedGoodId: string;
    quantityToProduce: number;
    destinationLocation: 'Production Floor' | 'Finished Store';
    batchNumber: string;
    notes?: string;
    userId: string;
    userName: string;
  }) {
    const { finishedGoodId, quantityToProduce, destinationLocation, batchNumber, notes, userId, userName } = params;

    const fg = await FinishedGood.findById(finishedGoodId);
    if (!fg) throw new Error('Finished Good not found');

    const bom = await BOM.findOne({ finishedGood: finishedGoodId, isActive: true })
      .populate('rawMaterials.rawMaterial')
      .populate('packingMaterials.packingMaterial');

    if (!bom) {
      throw new Error(`No active BOM found for ${fg.name}. Please configure a BOM before recording production.`);
    }

    const batchRatio = quantityToProduce / (bom.batchSize || 1);

    // 1. Check material availability first (dry-run check)
    const requiredRMs: Array<{ rm: any; requiredQty: number }> = [];
    for (const item of bom.rawMaterials) {
      const rm = item.rawMaterial as any;
      if (!rm) continue;
      const wastage = 1 + (item.wastagePercent || 0) / 100;
      const totalRequired = item.quantity * batchRatio * wastage;
      if (rm.currentStock < totalRequired) {
        throw new Error(
          `Insufficient Raw Material: ${rm.name}. Required: ${totalRequired.toFixed(2)} ${rm.unit}, Available: ${rm.currentStock.toFixed(2)} ${rm.unit}`
        );
      }
      requiredRMs.push({ rm, requiredQty: totalRequired });
    }

    const requiredPMs: Array<{ pm: any; requiredQty: number }> = [];
    for (const item of bom.packingMaterials) {
      const pm = item.packingMaterial as any;
      if (!pm) continue;
      const wastage = 1 + (item.wastagePercent || 0) / 100;
      const totalRequired = item.quantity * batchRatio * wastage;
      if (pm.currentStock < totalRequired) {
        throw new Error(
          `Insufficient Packing Material: ${pm.name}. Required: ${totalRequired.toFixed(2)} ${pm.unit}, Available: ${pm.currentStock.toFixed(2)} ${pm.unit}`
        );
      }
      requiredPMs.push({ pm, requiredQty: totalRequired });
    }

    // 2. Deduct Raw Materials
    for (const { rm, requiredQty } of requiredRMs) {
      await this.recordMovement({
        itemType: 'RawMaterial',
        itemId: rm._id.toString(),
        transactionType: 'OUT',
        reason: 'Production',
        quantity: requiredQty,
        location: 'RM Warehouse',
        referenceNumber: `BATCH-${batchNumber}`,
        notes: `Production deduction for ${quantityToProduce} ${fg.unit} of ${fg.name}`,
        userId,
        userName,
      });
    }

    // 3. Deduct Packing Materials
    for (const { pm, requiredQty } of requiredPMs) {
      await this.recordMovement({
        itemType: 'PackingMaterial',
        itemId: pm._id.toString(),
        transactionType: 'OUT',
        reason: 'Production',
        quantity: requiredQty,
        location: 'PM Warehouse',
        referenceNumber: `BATCH-${batchNumber}`,
        notes: `Production deduction for ${quantityToProduce} ${fg.unit} of ${fg.name}`,
        userId,
        userName,
      });
    }

    // 4. Increase Finished Good stock in destination
    const fgTxn = await this.recordMovement({
      itemType: 'FinishedGood',
      itemId: fg._id.toString(),
      transactionType: 'IN',
      reason: 'Production',
      quantity: quantityToProduce,
      location: destinationLocation,
      referenceNumber: `BATCH-${batchNumber}`,
      notes: notes || `Batch production completed for ${quantityToProduce} ${fg.unit}`,
      userId,
      userName,
    });

    return {
      success: true,
      batchNumber,
      producedQuantity: quantityToProduce,
      destinationLocation,
      finishedGood: fg.name,
      materialsDeducted: {
        rawMaterialsCount: requiredRMs.length,
        packingMaterialsCount: requiredPMs.length,
      },
      transaction: fgTxn,
    };
  }

  // Calculate maximum production capacity for Finished Goods based on available RM and PM
  public static async calculateCapacity(finishedGoodId?: string) {
    const query = finishedGoodId ? { _id: finishedGoodId, isActive: true } : { isActive: true };
    const finishedGoods = await FinishedGood.find(query);

    const capacityResults = [];

    for (const fg of finishedGoods) {
      const bom = await BOM.findOne({ finishedGood: fg._id, isActive: true })
        .populate('rawMaterials.rawMaterial')
        .populate('packingMaterials.packingMaterial');

      if (!bom || (!bom.rawMaterials.length && !bom.packingMaterials.length)) {
        capacityResults.push({
          finishedGood: {
            id: fg._id,
            name: fg.name,
            sku: fg.sku,
            unit: fg.unit,
            productionFloorStock: fg.productionFloorStock,
            finishedStoreStock: fg.finishedStoreStock,
            totalStock: fg.productionFloorStock + fg.finishedStoreStock,
          },
          hasBOM: false,
          maxCapacity: 0,
          limitingMaterial: 'No active BOM defined',
          limitingMaterialType: 'None',
          materials: [],
        });
        continue;
      }

      let minCapacity = Infinity;
      let bottleneckName = 'None';
      let bottleneckType = 'None';
      const materialBreakdown: any[] = [];

      // Check Raw Materials
      for (const item of bom.rawMaterials) {
        const rm = item.rawMaterial as any;
        if (!rm) continue;
        const wastage = 1 + (item.wastagePercent || 0) / 100;
        const perUnitReq = (item.quantity * wastage) / bom.batchSize;
        const capacityUnits = perUnitReq > 0 ? Math.floor(rm.currentStock / perUnitReq) : Infinity;

        materialBreakdown.push({
          type: 'RawMaterial',
          id: rm._id,
          name: rm.name,
          sku: rm.sku,
          currentStock: rm.currentStock,
          unit: rm.unit,
          perUnitRequired: perUnitReq,
          supportedUnits: capacityUnits,
        });

        if (capacityUnits < minCapacity) {
          minCapacity = capacityUnits;
          bottleneckName = rm.name;
          bottleneckType = 'RawMaterial';
        }
      }

      // Check Packing Materials
      for (const item of bom.packingMaterials) {
        const pm = item.packingMaterial as any;
        if (!pm) continue;
        const wastage = 1 + (item.wastagePercent || 0) / 100;
        const perUnitReq = (item.quantity * wastage) / bom.batchSize;
        const capacityUnits = perUnitReq > 0 ? Math.floor(pm.currentStock / perUnitReq) : Infinity;

        materialBreakdown.push({
          type: 'PackingMaterial',
          id: pm._id,
          name: pm.name,
          sku: pm.sku,
          currentStock: pm.currentStock,
          unit: pm.unit,
          perUnitRequired: perUnitReq,
          supportedUnits: capacityUnits,
        });

        if (capacityUnits < minCapacity) {
          minCapacity = capacityUnits;
          bottleneckName = pm.name;
          bottleneckType = 'PackingMaterial';
        }
      }

      const finalCapacity = minCapacity === Infinity ? 0 : minCapacity;

      capacityResults.push({
        finishedGood: {
          id: fg._id,
          name: fg.name,
          sku: fg.sku,
          unit: fg.unit,
          productionFloorStock: fg.productionFloorStock,
          finishedStoreStock: fg.finishedStoreStock,
          totalStock: fg.productionFloorStock + fg.finishedStoreStock,
        },
        hasBOM: true,
        maxCapacity: finalCapacity,
        limitingMaterial: bottleneckName,
        limitingMaterialType: bottleneckType,
        materials: materialBreakdown,
      });
    }

    return capacityResults;
  }

  // Sales Planning / MRP calculation: Target vs Current FG stock -> Shortfall -> Required RM & PM
  public static async calculateSalesPlanRequirements(
    items: Array<{ finishedGoodId: string; targetQuantity: number }>
  ) {
    const results = [];
    const aggregatedRMRequirements: { [key: string]: any } = {};
    const aggregatedPMRequirements: { [key: string]: any } = {};

    for (const item of items) {
      const fg = await FinishedGood.findById(item.finishedGoodId);
      if (!fg) continue;

      const currentTotalStock = fg.productionFloorStock + fg.finishedStoreStock;
      const coverage = Math.min(currentTotalStock, item.targetQuantity);
      const shortfall = Math.max(0, item.targetQuantity - currentTotalStock);
      const coveragePercentage = item.targetQuantity > 0 ? Math.round((coverage / item.targetQuantity) * 100) : 100;

      const bom = await BOM.findOne({ finishedGood: fg._id, isActive: true })
        .populate('rawMaterials.rawMaterial')
        .populate('packingMaterials.packingMaterial');

      const requiredMaterialsForShortfall: any[] = [];

      if (bom && shortfall > 0) {
        const batchRatio = shortfall / (bom.batchSize || 1);

        for (const rItem of bom.rawMaterials) {
          const rm = rItem.rawMaterial as any;
          if (!rm) continue;
          const wastage = 1 + (rItem.wastagePercent || 0) / 100;
          const neededQty = rItem.quantity * batchRatio * wastage;
          const rmShortfall = Math.max(0, neededQty - rm.currentStock);

          requiredMaterialsForShortfall.push({
            type: 'RawMaterial',
            name: rm.name,
            sku: rm.sku,
            neededQty: Number(neededQty.toFixed(2)),
            currentStock: rm.currentStock,
            unit: rm.unit,
            materialShortfall: Number(rmShortfall.toFixed(2)),
          });

          const key = rm._id.toString();
          if (!aggregatedRMRequirements[key]) {
            aggregatedRMRequirements[key] = {
              id: rm._id,
              name: rm.name,
              sku: rm.sku,
              unit: rm.unit,
              currentStock: rm.currentStock,
              totalNeeded: 0,
            };
          }
          aggregatedRMRequirements[key].totalNeeded += neededQty;
        }

        for (const pItem of bom.packingMaterials) {
          const pm = pItem.packingMaterial as any;
          if (!pm) continue;
          const wastage = 1 + (pItem.wastagePercent || 0) / 100;
          const neededQty = pItem.quantity * batchRatio * wastage;
          const pmShortfall = Math.max(0, neededQty - pm.currentStock);

          requiredMaterialsForShortfall.push({
            type: 'PackingMaterial',
            name: pm.name,
            sku: pm.sku,
            neededQty: Number(neededQty.toFixed(2)),
            currentStock: pm.currentStock,
            unit: pm.unit,
            materialShortfall: Number(pmShortfall.toFixed(2)),
          });

          const key = pm._id.toString();
          if (!aggregatedPMRequirements[key]) {
            aggregatedPMRequirements[key] = {
              id: pm._id,
              name: pm.name,
              sku: pm.sku,
              unit: pm.unit,
              currentStock: pm.currentStock,
              totalNeeded: 0,
            };
          }
          aggregatedPMRequirements[key].totalNeeded += neededQty;
        }
      }

      results.push({
        finishedGood: {
          id: fg._id,
          name: fg.name,
          sku: fg.sku,
          unit: fg.unit,
          productionFloorStock: fg.productionFloorStock,
          finishedStoreStock: fg.finishedStoreStock,
          totalStock: currentTotalStock,
        },
        targetQuantity: item.targetQuantity,
        coverage,
        shortfall,
        coveragePercentage,
        hasBOM: !!bom,
        materialsToProduceShortfall: requiredMaterialsForShortfall,
      });
    }

    // Process aggregated materials for purchase requisition planning
    const procurementPlan = [
      ...Object.values(aggregatedRMRequirements).map((item) => ({
        ...item,
        type: 'RawMaterial',
        totalNeeded: Number(item.totalNeeded.toFixed(2)),
        shortfallToOrder: Math.max(0, Number((item.totalNeeded - item.currentStock).toFixed(2))),
      })),
      ...Object.values(aggregatedPMRequirements).map((item) => ({
        ...item,
        type: 'PackingMaterial',
        totalNeeded: Number(item.totalNeeded.toFixed(2)),
        shortfallToOrder: Math.max(0, Number((item.totalNeeded - item.currentStock).toFixed(2))),
      })),
    ];

    return {
      planSummary: results,
      procurementPlan,
    };
  }

  // 3-Month Demand & MRP Planning Engine
  public static async calculateThreeMonthMRP(params: {
    division?: string;
    months?: [string, string, string];
    demands: Array<{ finishedGoodId: string; month1: number; month2: number; month3: number }>;
  }) {
    const { division, months = ['Month 1', 'Month 2', 'Month 3'], demands } = params;

    const results = [];
    const aggregatedRMRequirements: { [key: string]: any } = {};
    const aggregatedPMRequirements: { [key: string]: any } = {};

    let total3MonthDemandAll = 0;
    let totalFGStockAll = 0;
    let totalBOMWIPAll = 0;
    let totalBlendProductCountAll = 0;
    let totalNetProductionNeededAll = 0;
    let totalPredictableBOMNeededAll = 0;

    for (const d of demands) {
      const fg = await FinishedGood.findById(d.finishedGoodId);
      if (!fg) continue;

      if (division && division !== 'All' && fg.division !== division) {
        continue;
      }

      const m1 = Math.max(0, Number(d.month1) || 0);
      const m2 = Math.max(0, Number(d.month2) || 0);
      const m3 = Math.max(0, Number(d.month3) || 0);
      const totalDemand = m1 + m2 + m3;

      // Current FG Stock
      const fgFloor = fg.productionFloorStock || 0;
      const fgStore = fg.finishedStoreStock || 0;
      const currentFGStock = fgFloor + fgStore;

      // Current BOM WIP Stock for this FG
      const activeBOMRuns = await BOMRun.find({
        finishedGood: fg._id,
        availableBOMCount: { $gt: 0 },
      });
      const currentBOMWIPCount = activeBOMRuns.reduce((sum, run) => sum + (run.availableBOMCount || 0), 0);

      // Current Blend Stock for this FG
      const activeBlends = await BlendStock.find({
        targetFinishedGood: fg._id,
        availableWeight: { $gt: 0 },
      });
      const currentBlendWeightKg = activeBlends.reduce((sum, b) => sum + (b.availableWeight || 0), 0);

      // Fetch Product Formula / BOM
      const bom = await BOM.findOne({ finishedGood: fg._id, isActive: true })
        .populate('rawMaterials.rawMaterial')
        .populate('packingMaterials.packingMaterial');

      const blendGramsPerUnit = bom?.blendGramsPerUnit || (fg.division === 'Fadna Life Science' ? 30 : 40);
      const predictableProductCountFromBlend = Math.floor((currentBlendWeightKg * 1000) / blendGramsPerUnit);

      // Total Available in Pipeline = FG + BOM WIP + Blend Yield
      const totalCoverage = currentFGStock + currentBOMWIPCount + predictableProductCountFromBlend;

      // Net Production Quantity needed
      const netProductNeeded = Math.max(0, totalDemand - totalCoverage);

      // Predictable BOM Quantity Needed (units to pack through BOM)
      const predictableBOMNeeded = Math.max(0, totalDemand - currentFGStock);

      // Calculate material requirements for the net production needed
      const materialsForProduct: any[] = [];

      if (netProductNeeded > 0 && bom) {
        const batchRatio = netProductNeeded / (bom.batchSize || 1);

        // Raw materials
        for (const rItem of bom.rawMaterials) {
          const rm = rItem.rawMaterial as any;
          if (!rm) continue;
          const wastage = 1 + (rItem.wastagePercent || 0) / 100;
          const neededQty = rItem.quantity * batchRatio * wastage;
          const rmShortfall = Math.max(0, neededQty - rm.currentStock);

          materialsForProduct.push({
            type: 'RawMaterial',
            id: rm._id,
            name: rm.name,
            sku: rm.sku,
            unit: rm.unit,
            percentage: rItem.percentage || 0,
            neededQty: Number(neededQty.toFixed(2)),
            currentStock: rm.currentStock,
            shortfallToOrder: Number(rmShortfall.toFixed(2)),
            costPerUnit: rm.costPerUnit || 0,
            estimatedCost: Number((rmShortfall * (rm.costPerUnit || 0)).toFixed(2)),
          });

          const key = rm._id.toString();
          if (!aggregatedRMRequirements[key]) {
            aggregatedRMRequirements[key] = {
              id: rm._id,
              name: rm.name,
              sku: rm.sku,
              unit: rm.unit,
              currentStock: rm.currentStock,
              costPerUnit: rm.costPerUnit || 0,
              totalNeeded: 0,
            };
          }
          aggregatedRMRequirements[key].totalNeeded += neededQty;
        }

        // Packing materials
        for (const pItem of bom.packingMaterials) {
          const pm = pItem.packingMaterial as any;
          if (!pm) continue;
          const wastage = 1 + (pItem.wastagePercent || 0) / 100;
          const neededQty = Math.ceil(pItem.quantity * batchRatio * wastage);
          const pmShortfall = Math.max(0, neededQty - pm.currentStock);

          materialsForProduct.push({
            type: 'PackingMaterial',
            id: pm._id,
            name: pm.name,
            sku: pm.sku,
            unit: pm.unit,
            neededQty,
            currentStock: pm.currentStock,
            shortfallToOrder: pmShortfall,
            costPerUnit: pm.costPerUnit || 0,
            estimatedCost: Number((pmShortfall * (pm.costPerUnit || 0)).toFixed(2)),
          });

          const key = pm._id.toString();
          if (!aggregatedPMRequirements[key]) {
            aggregatedPMRequirements[key] = {
              id: pm._id,
              name: pm.name,
              sku: pm.sku,
              unit: pm.unit,
              currentStock: pm.currentStock,
              costPerUnit: pm.costPerUnit || 0,
              totalNeeded: 0,
            };
          }
          aggregatedPMRequirements[key].totalNeeded += neededQty;
        }
      }

      total3MonthDemandAll += totalDemand;
      totalFGStockAll += currentFGStock;
      totalBOMWIPAll += currentBOMWIPCount;
      totalBlendProductCountAll += predictableProductCountFromBlend;
      totalNetProductionNeededAll += netProductNeeded;
      totalPredictableBOMNeededAll += predictableBOMNeeded;

      results.push({
        finishedGood: {
          id: fg._id,
          name: fg.name,
          sku: fg.sku,
          shortCode: fg.shortCode,
          division: fg.division,
          category: fg.category,
          unit: fg.unit,
          packSize: fg.packSize,
          productionFloorStock: fgFloor,
          finishedStoreStock: fgStore,
          totalStock: currentFGStock,
        },
        hasFormula: !!bom,
        demands: {
          month1: m1,
          month2: m2,
          month3: m3,
          total3Months: totalDemand,
        },
        currentStockPipeline: {
          finishedGoodsStock: currentFGStock,
          bomWIPCount: currentBOMWIPCount,
          blendWeightKg: Number(currentBlendWeightKg.toFixed(2)),
          blendProductCount: predictableProductCountFromBlend,
          totalAvailableAndWIP: totalCoverage,
        },
        planningOutput: {
          netProductionNeeded: netProductNeeded,
          predictableBOMNeeded,
          isCovered: netProductNeeded === 0,
          coveragePercent: totalDemand > 0 ? Math.min(100, Math.round((totalCoverage / totalDemand) * 100)) : 100,
        },
        materialsRequired: materialsForProduct,
      });
    }

    // Consolidated Procurement Plan
    const rawMaterialsToOrder = Object.values(aggregatedRMRequirements).map((item) => {
      const needed = Number(item.totalNeeded.toFixed(2));
      const shortfall = Math.max(0, Number((needed - item.currentStock).toFixed(2)));
      return {
        ...item,
        type: 'RawMaterial',
        totalNeeded: needed,
        shortfallToOrder: shortfall,
        estimatedTotalCost: Number((shortfall * item.costPerUnit).toFixed(2)),
      };
    });

    const packingMaterialsToOrder = Object.values(aggregatedPMRequirements).map((item) => {
      const needed = Math.ceil(item.totalNeeded);
      const shortfall = Math.max(0, needed - item.currentStock);
      return {
        ...item,
        type: 'PackingMaterial',
        totalNeeded: needed,
        shortfallToOrder: shortfall,
        estimatedTotalCost: Number((shortfall * item.costPerUnit).toFixed(2)),
      };
    });

    const totalRMCost = rawMaterialsToOrder.reduce((sum, r) => sum + r.estimatedTotalCost, 0);
    const totalPMCost = packingMaterialsToOrder.reduce((sum, p) => sum + p.estimatedTotalCost, 0);

    return {
      months,
      division: division || 'All',
      summary: {
        total3MonthDemand: total3MonthDemandAll,
        totalCurrentFGStock: totalFGStockAll,
        totalCurrentBOMWIP: totalBOMWIPAll,
        totalPredictableBlendCount: totalBlendProductCountAll,
        totalNetProductionNeeded: totalNetProductionNeededAll,
        totalPredictableBOMNeeded: totalPredictableBOMNeededAll,
        rmShortfallCount: rawMaterialsToOrder.filter((r) => r.shortfallToOrder > 0).length,
        pmShortfallCount: packingMaterialsToOrder.filter((p) => p.shortfallToOrder > 0).length,
        estimatedRMCost: Number(totalRMCost.toFixed(2)),
        estimatedPMCost: Number(totalPMCost.toFixed(2)),
        estimatedTotalRequisitionCost: Number((totalRMCost + totalPMCost).toFixed(2)),
      },
      plan: results,
      procurementPlan: {
        rawMaterials: rawMaterialsToOrder,
        packingMaterials: packingMaterialsToOrder,
      },
    };
  }
}
