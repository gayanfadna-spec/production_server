import { Request, Response } from 'express';
import { FinishedGood } from '../models/FinishedGood.js';
import { RawMaterial } from '../models/RawMaterial.js';
import { PackingMaterial } from '../models/PackingMaterial.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { StockService } from '../services/stockService.js';

export const getDashboardSummary = async (req: Request, res: Response): Promise<any> => {
  try {
    const finishedGoods = await FinishedGood.find({ isActive: true });
    const rawMaterials = await RawMaterial.find({ isActive: true });
    const packingMaterials = await PackingMaterial.find({ isActive: true });

    // 1. Finished Goods aggregation
    let totalFloorUnits = 0;
    let totalStoreUnits = 0;
    let totalFGValue = 0;
    const lowStockFGs: any[] = [];

    finishedGoods.forEach((fg) => {
      const floor = fg.productionFloorStock || 0;
      const store = fg.finishedStoreStock || 0;
      const total = floor + store;
      totalFloorUnits += floor;
      totalStoreUnits += store;
      totalFGValue += total * (fg.costPerUnit || 0);

      if (total <= fg.minReorderLevel) {
        lowStockFGs.push({
          id: fg._id,
          sku: fg.sku,
          name: fg.name,
          category: fg.category,
          productionFloorStock: floor,
          finishedStoreStock: store,
          totalStock: total,
          minReorderLevel: fg.minReorderLevel,
          unit: fg.unit,
        });
      }
    });

    // 2. Raw Materials aggregation
    let totalRMStock = 0;
    let totalRMValue = 0;
    const lowStockRMs: any[] = [];

    rawMaterials.forEach((rm) => {
      totalRMStock += rm.currentStock || 0;
      totalRMValue += (rm.currentStock || 0) * (rm.costPerUnit || 0);

      if (rm.currentStock <= rm.minReorderLevel) {
        lowStockRMs.push({
          id: rm._id,
          sku: rm.sku,
          name: rm.name,
          category: rm.category,
          currentStock: rm.currentStock,
          minReorderLevel: rm.minReorderLevel,
          unit: rm.unit,
        });
      }
    });

    // 3. Packing Materials aggregation
    let totalPMStock = 0;
    let totalPMValue = 0;
    const lowStockPMs: any[] = [];

    packingMaterials.forEach((pm) => {
      totalPMStock += pm.currentStock || 0;
      totalPMValue += (pm.currentStock || 0) * (pm.costPerUnit || 0);

      if (pm.currentStock <= pm.minReorderLevel) {
        lowStockPMs.push({
          id: pm._id,
          sku: pm.sku,
          name: pm.name,
          category: pm.category,
          currentStock: pm.currentStock,
          minReorderLevel: pm.minReorderLevel,
          unit: pm.unit,
        });
      }
    });

    // 4. Today's movements
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTransactions = await StockTransaction.find({
      transactionDate: { $gte: todayStart },
    });

    let todayInCount = 0;
    let todayOutCount = 0;
    let todayTransferCount = 0;

    todayTransactions.forEach((txn) => {
      if (txn.transactionType === 'IN') todayInCount++;
      else if (txn.transactionType === 'OUT') todayOutCount++;
      else if (txn.transactionType === 'TRANSFER' || txn.reason === 'Floor_Transfer') todayTransferCount++;
    });

    // 5. Recent 8 transactions
    const recentMovements = await StockTransaction.find()
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(8);

    // 6. Capacity preview for top products
    const capacities = await StockService.calculateCapacity();
    const capacityPreview = capacities.slice(0, 5).map((cap) => ({
      name: cap.finishedGood.name,
      sku: cap.finishedGood.sku,
      unit: cap.finishedGood.unit,
      currentTotalStock: cap.finishedGood.totalStock,
      maxCapacity: cap.maxCapacity,
      bottleneck: cap.limitingMaterial,
      bottleneckType: cap.limitingMaterialType,
    }));

    return res.json({
      success: true,
      timestamp: new Date(),
      kpis: {
        finishedGoods: {
          totalProducts: finishedGoods.length,
          productionFloorUnits: totalFloorUnits,
          finishedStoreUnits: totalStoreUnits,
          totalUnits: totalFloorUnits + totalStoreUnits,
          valuation: Math.round(totalFGValue),
          lowStockCount: lowStockFGs.length,
        },
        rawMaterials: {
          totalItems: rawMaterials.length,
          totalStock: Math.round(totalRMStock * 100) / 100,
          valuation: Math.round(totalRMValue),
          lowStockCount: lowStockRMs.length,
        },
        packingMaterials: {
          totalItems: packingMaterials.length,
          totalStock: Math.round(totalPMStock),
          valuation: Math.round(totalPMValue),
          lowStockCount: lowStockPMs.length,
        },
        todayOperations: {
          inMovements: todayInCount,
          outMovements: todayOutCount,
          transfers: todayTransferCount,
          totalActivity: todayTransactions.length,
        },
        inventoryValuationTotal: Math.round(totalFGValue + totalRMValue + totalPMValue),
      },
      alerts: {
        totalAlerts: lowStockFGs.length + lowStockRMs.length + lowStockPMs.length,
        finishedGoods: lowStockFGs,
        rawMaterials: lowStockRMs,
        packingMaterials: lowStockPMs,
      },
      recentMovements,
      capacityPreview,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
