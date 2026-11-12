import { Request, Response } from 'express';
import { StockTransaction } from '../models/StockTransaction.js';
import { FinishedGood } from '../models/FinishedGood.js';
import { RawMaterial } from '../models/RawMaterial.js';
import { PackingMaterial } from '../models/PackingMaterial.js';
import { ExcelReportService } from '../services/excelReportService.js';
import { PDFReportService } from '../services/pdfReportService.js';
import { AuditService } from '../services/auditService.js';

export const getDailyInOutReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const { startDate, endDate, itemType, format = 'json' } = req.query;
    const filter: any = {};

    if (itemType && itemType !== 'all') {
      filter.itemType = itemType;
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

    const transactions = await StockTransaction.find(filter).sort({ transactionDate: -1 });

    if (format === 'excel') {
      const buffer = await ExcelReportService.generateDailyInOutExcel(
        transactions,
        startDate ? String(startDate) : undefined,
        endDate ? String(endDate) : undefined
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Fadna_Daily_InOut_Report_${Date.now()}.xlsx`);
      return res.send(buffer);
    }

    if (format === 'pdf') {
      const buffer = await PDFReportService.generateDailyInOutPDF(
        transactions,
        startDate ? String(startDate) : undefined,
        endDate ? String(endDate) : undefined
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Fadna_Daily_InOut_Report_${Date.now()}.pdf`);
      return res.send(buffer);
    }

    return res.json({ success: true, count: transactions.length, data: transactions });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDailyStockReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const { format = 'json' } = req.query;

    const finishedGoods = await FinishedGood.find({ isActive: true }).sort({ name: 1 });
    const rawMaterials = await RawMaterial.find({ isActive: true }).sort({ name: 1 });
    const packingMaterials = await PackingMaterial.find({ isActive: true }).sort({ name: 1 });

    if (format === 'excel') {
      const buffer = await ExcelReportService.generateDailyStockExcel(
        finishedGoods,
        rawMaterials,
        packingMaterials
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Fadna_Daily_Stock_Report_${Date.now()}.xlsx`);
      return res.send(buffer);
    }

    if (format === 'pdf') {
      const buffer = await PDFReportService.generateDailyStockPDF(
        finishedGoods,
        rawMaterials,
        packingMaterials
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Fadna_Daily_Stock_Report_${Date.now()}.pdf`);
      return res.send(buffer);
    }

    return res.json({
      success: true,
      timestamp: new Date(),
      data: {
        finishedGoods,
        rawMaterials,
        packingMaterials,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Daily In-Out Matrix Cross-Tabulated Report (Matching user's operational Excel sheets)
export const getDailyMatrixReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const { date, division = 'Fadna Tea', format = 'json', sheetType = 'all' } = req.query;
    const selectedDivision = String(division);

    // Parse date (default to 2026-10-07 or today)
    const dateStr = date ? String(date) : new Date().toISOString().slice(0, 10);
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);

    // 1. Fetch Finished Goods for this division
    const finishedGoods = await FinishedGood.find({
      division: selectedDivision,
      isActive: true,
    }).sort({ sku: 1 });

    // Defined product sequence to match factory sheet columns exactly
    const teaSequence = [
      'S(SPN)', 'DSN', 'GPN2', 'H', 'CN3', 'T(SPN)', 'BN3', 'IN4', 'RN3',
      'KN2', 'ETN', 'MMN', 'MCN', 'MGN', 'SSN', 'FAN', 'NRN', 'IMN',
      'HMM', 'HIR', 'HRA', 'HBE', 'HCI', 'HGR'
    ];
    const lsSequence = [
      'OR.ACT', 'SA', 'VER', 'BIO', 'ZCR', 'ZCA', 'CLE', 'GLO', 'EYE',
      'MOI', 'MOI.M', 'MOI.FE', 'DER', 'EPID', 'EPIK', 'ACQ.N', 'ORT', 'S(SHP)', 'SAT'
    ];

    const activeSequence = selectedDivision === 'Fadna Tea' ? teaSequence : lsSequence;

    // Sort products according to the sequence
    const orderedProducts = [...finishedGoods].sort((a, b) => {
      const idxA = activeSequence.indexOf(a.shortCode);
      const idxB = activeSequence.indexOf(b.shortCode);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.shortCode.localeCompare(b.shortCode);
    });

    // 2. Fetch Transactions for the day
    const transactions = await StockTransaction.find({
      division: selectedDivision,
      transactionDate: { $gte: dayStart, $lte: dayEnd },
    });

    // Group transactions by channel (only channels with actual recorded transactions)
    const outChannelsMap: { [channel: string]: { [shortCode: string]: number } } = {};
    const inChannelsMap: { [channel: string]: { [shortCode: string]: number } } = {};

    transactions.forEach((txn) => {
      const code = txn.itemShortCode;
      if (!code) return;

      const ch = txn.channel || txn.referenceNumber || 'GENERAL';
      if (txn.transactionType === 'OUT') {
        if (!outChannelsMap[ch]) outChannelsMap[ch] = {};
        outChannelsMap[ch][code] = (outChannelsMap[ch][code] || 0) + txn.quantity;
      } else if (txn.transactionType === 'IN') {
        if (!inChannelsMap[ch]) inChannelsMap[ch] = {};
        inChannelsMap[ch][code] = (inChannelsMap[ch][code] || 0) + txn.quantity;
      }
    });

    // Format OUT rows
    const outTotals: { [code: string]: number } = {};
    activeSequence.forEach((c) => {
      outTotals[c] = 0;
    });

    const outRows = Object.keys(outChannelsMap).map((channel) => {
      const items = outChannelsMap[channel];
      let rowTotal = 0;
      Object.entries(items).forEach(([code, qty]) => {
        rowTotal += qty;
        outTotals[code] = (outTotals[code] || 0) + qty;
      });
      return { channel, items, total: rowTotal };
    });

    // Format IN rows
    const inTotals: { [code: string]: number } = {};
    activeSequence.forEach((c) => {
      inTotals[c] = 0;
    });

    const inRows = Object.keys(inChannelsMap).map((channel) => {
      const items = inChannelsMap[channel];
      let rowTotal = 0;
      Object.entries(items).forEach(([code, qty]) => {
        rowTotal += qty;
        inTotals[code] = (inTotals[code] || 0) + qty;
      });
      return { channel, items, total: rowTotal };
    });

    // 3. Packaging WIP status
    let packagingWIP = await (await import('../models/DailyPackagingWIP.js')).DailyPackagingWIP.findOne({
      date: dateStr,
      division: selectedDivision,
    });

    if (!packagingWIP) {
      packagingWIP = {
        boxStock: 0,
        pasted: 0,
        pasting: 0,
        box: 0,
        pouch: 0,
        pouchStock: 0,
      } as any;
    }

    // 4. Calculate date-specific Finished Store Stock:
    // Any transactions that occurred strictly after dayEnd are unwound so that viewing a previous
    // day reflects that day's closing store stock balance (Opening of day + IN of day - OUT of day).
    const futureTxns = await StockTransaction.find({
      division: selectedDivision,
      transactionDate: { $gt: dayEnd },
    });

    const futureNetByCode: { [code: string]: number } = {};
    futureTxns.forEach((t) => {
      const code = t.itemShortCode;
      if (!code) return;
      const delta = t.transactionType === 'IN' ? t.quantity : -t.quantity;
      futureNetByCode[code] = (futureNetByCode[code] || 0) + delta;
    });

    const matrixData = {
      division: selectedDivision,
      dateStr,
      products: orderedProducts.map((p) => {
        const netAfterDate = futureNetByCode[p.shortCode] || 0;
        const historicalStoreStock = Math.max(0, p.finishedStoreStock - netAfterDate);
        return {
          _id: p._id,
          sku: p.sku,
          shortCode: p.shortCode,
          name: p.name,
          productionFloorStock: p.productionFloorStock,
          finishedStoreStock: historicalStoreStock,
          totalStock: (p.productionFloorStock || 0) + historicalStoreStock,
          physicalActualStock: p.physicalActualStock ?? null,
          variance:
            p.physicalActualStock !== null && p.physicalActualStock !== undefined
              ? p.physicalActualStock - historicalStoreStock
              : null,
        };
      }),
      outRows,
      outTotals,
      inRows,
      inTotals,
      packagingWIP,
    };

    if (format === 'excel') {
      const selectedSheetType = (['all', 'in-out', 'stock'].includes(String(sheetType))
        ? String(sheetType)
        : 'all') as 'all' | 'in-out' | 'stock';

      const buffer = await ExcelReportService.generateDailyMatrixExcel(
        {
          division: selectedDivision,
          dateStr,
          products: matrixData.products,
          outRows: matrixData.outRows,
          outTotals: matrixData.outTotals,
          inRows: matrixData.inRows,
          inTotals: matrixData.inTotals,
          reconciliation: matrixData.products,
          packagingWIP,
        },
        selectedSheetType
      );

      const typeLabel =
        selectedSheetType === 'in-out' ? 'IN_OUT' : selectedSheetType === 'stock' ? 'Stock' : 'Full_Sheets';

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Fadna_${selectedDivision.replace(/\s+/g, '_')}_${typeLabel}_${dateStr}.xlsx`
      );
      return res.send(buffer);
    }

    if (format === 'pdf') {
      const selectedSheetType = (['all', 'in-out', 'stock'].includes(String(sheetType))
        ? String(sheetType)
        : 'all') as 'all' | 'in-out' | 'stock';

      const buffer = await PDFReportService.generateDailyMatrixPDF(
        {
          division: selectedDivision,
          dateStr,
          products: matrixData.products,
          outRows: matrixData.outRows,
          outTotals: matrixData.outTotals,
          inRows: matrixData.inRows,
          inTotals: matrixData.inTotals,
          packagingWIP,
        },
        selectedSheetType
      );

      const typeLabel =
        selectedSheetType === 'in-out' ? 'IN_OUT' : selectedSheetType === 'stock' ? 'Stock' : 'Full_Sheets';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Fadna_${selectedDivision.replace(/\s+/g, '_')}_${typeLabel}_${dateStr}.pdf`
      );
      return res.send(buffer);
    }

    return res.json({ success: true, data: matrixData });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Log a batch matrix dispatch row (e.g. CARGILS ORDERS: 120 Shape Up, 48 Diabe)
export const postDailyMatrixDispatch = async (req: any, res: Response): Promise<any> => {
  try {
    const { date, division = 'Fadna Tea', channel, type = 'OUT', items, notes } = req.body;
    if (!channel || !items || typeof items !== 'object') {
      return res.status(400).json({ success: false, message: 'Channel and items mapping are required.' });
    }

    const userId = req.user?._id;
    const userName = req.user?.name || 'Factory Dispatcher';
    const txnDate = date ? new Date(date) : new Date();

    const createdTxns: any[] = [];

    for (const [shortCode, qtyRaw] of Object.entries(items)) {
      const qty = Number(qtyRaw);
      if (qty <= 0) continue;

      const fg = await FinishedGood.findOne({ shortCode, division });
      if (!fg) continue;

      // Update FinishedGood stock
      if (type === 'OUT') {
        if (fg.finishedStoreStock >= qty) {
          fg.finishedStoreStock -= qty;
        } else {
          const rem = qty - fg.finishedStoreStock;
          fg.finishedStoreStock = 0;
          fg.productionFloorStock = Math.max(0, fg.productionFloorStock - rem);
        }
      } else {
        // Stock IN from production
        fg.finishedStoreStock += qty;
      }
      await fg.save();

      // Create Stock Transaction
      const txnNumber = `TXN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const txn = await StockTransaction.create({
        transactionNumber: txnNumber,
        division,
        channel,
        itemType: 'FinishedGood',
        itemRef: fg._id,
        itemName: fg.name,
        itemSku: fg.sku,
        itemShortCode: fg.shortCode,
        transactionType: type,
        reason: type === 'OUT' ? (channel.includes('FREE ISSUE') ? 'Return' : 'Sales') : 'Production',
        fromLocation: type === 'OUT' ? 'Finished Store' : 'Production Floor',
        toLocation: type === 'OUT' ? 'Customer Dispatch' : 'Finished Store',
        quantity: qty,
        unit: fg.unit,
        unitCost: fg.costPerUnit,
        totalCost: fg.costPerUnit * qty,
        referenceNumber: channel,
        notes: notes || `Matrix ledger entry for ${channel}`,
        performedBy: userId,
        performedByName: userName,
        transactionDate: txnDate,
      });

      createdTxns.push(txn);
    }

    return res.status(201).json({
      success: true,
      message: `Successfully logged ${createdTxns.length} matrix transactions for channel: ${channel}`,
      data: createdTxns,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Save physical audit counts and packaging WIP status
export const savePhysicalAudit = async (req: any, res: Response): Promise<any> => {
  try {
    const { division = 'Fadna Tea', date, actualCounts, packagingWIP, storeStocks } = req.body;
    const dateStr = date ? String(date) : new Date().toISOString().slice(0, 10);

    // Update actualCounts for each FinishedGood
    if (actualCounts && typeof actualCounts === 'object') {
      for (const [shortCode, actualQty] of Object.entries(actualCounts)) {
        const val =
          actualQty === '' || actualQty === null || actualQty === undefined
            ? null
            : Number(actualQty);
        await FinishedGood.updateOne(
          { shortCode, division },
          { physicalActualStock: val }
        );
      }
    }

    // Update finishedStoreStock for each FinishedGood if edited
    if (storeStocks && typeof storeStocks === 'object') {
      for (const [shortCode, storeQty] of Object.entries(storeStocks)) {
        if (storeQty !== '' && storeQty !== null && storeQty !== undefined) {
          await FinishedGood.updateOne(
            { shortCode, division },
            { finishedStoreStock: Math.max(0, Number(storeQty)) }
          );
        }
      }
    }

    // Save or update Packaging WIP
    let savedWIP = null;
    if (packagingWIP) {
      const { DailyPackagingWIP } = await import('../models/DailyPackagingWIP.js');
      savedWIP = await DailyPackagingWIP.findOneAndUpdate(
        { date: dateStr, division },
        {
          date: dateStr,
          division,
          boxStock: Number(packagingWIP.boxStock) || 0,
          pasted: Number(packagingWIP.pasted) || 0,
          pasting: Number(packagingWIP.pasting) || 0,
          box: Number(packagingWIP.box) || 0,
          pouch: Number(packagingWIP.pouch) || 0,
          pouchStock: Number(packagingWIP.pouchStock) || 0,
          updatedBy: req.user?.name || 'Store Auditor',
        },
        { upsert: true, new: true }
      );
    }

    await AuditService.record({
      user: req.user,
      action: 'ADJUSTMENT',
      entityType: 'DailyMatrix',
      entityId: dateStr,
      entityName: `Physical Stock Audit (${division}) - ${dateStr}`,
      summary: `Recorded physical stock counts and packaging buffer for ${division} on ${dateStr}`,
      metadata: { division, date: dateStr },
    });

    return res.json({
      success: true,
      message: 'Physical stock counts and packaging WIP audit successfully recorded.',
      data: { packagingWIP: savedWIP },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Batch update/save of the entire In/Out Daily Matrix Grid
export const saveDailyMatrixGrid = async (req: any, res: Response): Promise<any> => {
  try {
    const { date, division = 'Fadna Tea', outRows, inRows, storeStocks, actualCounts, packagingWIP } = req.body;
    const dateStr = date ? String(date) : new Date().toISOString().slice(0, 10);
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);

    const userId = req.user?._id;
    const userName = req.user?.name || 'Factory Dispatcher';

    // 1. Fetch products for this division
    const finishedGoods = await FinishedGood.find({ division, isActive: true });
    const fgMap: { [code: string]: any } = {};
    finishedGoods.forEach((fg) => {
      fgMap[fg.shortCode] = fg;
    });

    // 2. Fetch existing stock transactions created from the daily sheet on this day and division
    const existingTxns = await StockTransaction.find({
      division,
      transactionDate: { $gte: dayStart, $lte: dayEnd },
    });

    // Always revert previous transactions effect on stock to avoid duplication
    for (const txn of existingTxns) {
      const fg = fgMap[txn.itemShortCode || ''];
      if (fg) {
        if (txn.transactionType === 'OUT') {
          fg.finishedStoreStock += txn.quantity;
        } else if (txn.transactionType === 'IN') {
          fg.finishedStoreStock = Math.max(0, fg.finishedStoreStock - txn.quantity);
        }
      }
    }

    // If user explicitly edited specific store stock values, apply those overrides
    if (storeStocks && typeof storeStocks === 'object') {
      for (const [code, storeQty] of Object.entries(storeStocks)) {
        if (storeQty !== '' && storeQty !== null && storeQty !== undefined && fgMap[code]) {
          fgMap[code].finishedStoreStock = Math.max(0, Number(storeQty));
        }
      }
    }

    // Apply actual physical counts if provided
    if (actualCounts && typeof actualCounts === 'object') {
      for (const [code, actualQty] of Object.entries(actualCounts)) {
        if (fgMap[code]) {
          fgMap[code].physicalActualStock =
            actualQty === '' || actualQty === null || actualQty === undefined
              ? null
              : Number(actualQty);
        }
      }
    }

    // Save or update Packaging WIP if provided
    if (packagingWIP) {
      const { DailyPackagingWIP } = await import('../models/DailyPackagingWIP.js');
      await DailyPackagingWIP.findOneAndUpdate(
        { date: dateStr, division },
        {
          date: dateStr,
          division,
          boxStock: Number(packagingWIP.boxStock) || 0,
          pasted: Number(packagingWIP.pasted) || 0,
          pasting: Number(packagingWIP.pasting) || 0,
          box: Number(packagingWIP.box) || 0,
          pouch: Number(packagingWIP.pouch) || 0,
          pouchStock: Number(packagingWIP.pouchStock) || 0,
          updatedBy: req.user?.name || 'Factory Dispatcher',
        },
        { upsert: true, new: true }
      );
    }

    await StockTransaction.deleteMany({
      division,
      transactionDate: { $gte: dayStart, $lte: dayEnd },
    });

    const newTxns: any[] = [];

    // 3. Process OUT rows
    if (Array.isArray(outRows)) {
      for (const row of outRows) {
        const channel = (row.channel || row.remark || '').trim();
        if (!channel) continue;

        for (const [code, qtyRaw] of Object.entries(row.items || {})) {
          const qty = Number(qtyRaw);
          if (qty > 0 && fgMap[code]) {
            const fg = fgMap[code];
            // Deduct stock
            if (fg.finishedStoreStock >= qty) {
              fg.finishedStoreStock -= qty;
            } else {
              const rem = qty - fg.finishedStoreStock;
              fg.finishedStoreStock = 0;
              fg.productionFloorStock = Math.max(0, fg.productionFloorStock - rem);
            }

            const txnNumber = `TXN-OUT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
            newTxns.push({
              transactionNumber: txnNumber,
              division,
              channel,
              itemType: 'FinishedGood',
              itemRef: fg._id,
              itemName: fg.name,
              itemSku: fg.sku,
              itemShortCode: fg.shortCode,
              transactionType: 'OUT',
              reason: channel.includes('FREE ISSUE') ? 'Return' : 'Sales',
              fromLocation: 'Finished Store',
              toLocation: 'Customer Dispatch',
              quantity: qty,
              unit: fg.unit,
              unitCost: fg.costPerUnit,
              totalCost: fg.costPerUnit * qty,
              referenceNumber: channel,
              notes: `Daily Matrix Dispatch: ${channel}`,
              performedBy: userId,
              performedByName: userName,
              transactionDate: dayStart,
            });
          }
        }
      }
    }

    // 4. Process IN rows
    if (Array.isArray(inRows)) {
      for (const row of inRows) {
        const channel = (row.channel || row.remark || '').trim();
        if (!channel) continue;

        for (const [code, qtyRaw] of Object.entries(row.items || {})) {
          const qty = Number(qtyRaw);
          if (qty > 0 && fgMap[code]) {
            const fg = fgMap[code];
            // Add to finished store
            fg.finishedStoreStock += qty;

            const txnNumber = `TXN-IN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
            newTxns.push({
              transactionNumber: txnNumber,
              division,
              channel,
              itemType: 'FinishedGood',
              itemRef: fg._id,
              itemName: fg.name,
              itemSku: fg.sku,
              itemShortCode: fg.shortCode,
              transactionType: 'IN',
              reason: 'Production',
              fromLocation: 'Production Floor',
              toLocation: 'Finished Store',
              quantity: qty,
              unit: fg.unit,
              unitCost: fg.costPerUnit,
              totalCost: fg.costPerUnit * qty,
              referenceNumber: channel,
              notes: `Daily Matrix Production Receipt: ${channel}`,
              performedBy: userId,
              performedByName: userName,
              transactionDate: dayStart,
            });
          }
        }
      }
    }

    // Save updated FinishedGoods
    for (const fg of Object.values(fgMap)) {
      await fg.save();
    }

    // Insert new transactions
    if (newTxns.length > 0) {
      await StockTransaction.insertMany(newTxns);
    }

    await AuditService.record({
      user: req.user,
      action: 'UPDATE',
      entityType: 'DailyMatrix',
      entityId: dateStr,
      entityName: `Daily Matrix Sheet (${division}) - ${dateStr}`,
      summary: `Saved daily matrix ledger for ${division} on ${dateStr} (${newTxns.length} stock transactions recorded)`,
      metadata: { division, date: dateStr, transactionsCount: newTxns.length },
    });

    return res.json({
      success: true,
      message: `Successfully updated stock movements (${newTxns.length} transactions recorded) for ${division} on ${dateStr}.`,
      transactionsCount: newTxns.length,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Retrieve distinct dates having matrix activity or stock transactions for quick selection
export const getDailyMatrixDates = async (req: Request, res: Response): Promise<any> => {
  try {
    const { division = 'Fadna Tea' } = req.query;
    const selectedDivision = String(division);
    const transactions = await StockTransaction.find(
      { division: selectedDivision },
      { transactionDate: 1 }
    ).sort({ transactionDate: -1 });

    const dateSet = new Set<string>();
    transactions.forEach((t: any) => {
      if (t.transactionDate) {
        const d = new Date(t.transactionDate);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dateSet.add(`${y}-${m}-${day}`);
      }
    });

    const { DailyPackagingWIP } = await import('../models/DailyPackagingWIP.js');
    const wips = await DailyPackagingWIP.find({ division: selectedDivision }, { date: 1 });
    wips.forEach((w: any) => {
      if (w.date) dateSet.add(w.date);
    });

    const dates = Array.from(dateSet).sort().reverse();
    return res.json({
      success: true,
      data: dates,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


