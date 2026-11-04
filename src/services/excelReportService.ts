import ExcelJS from 'exceljs';

export class ExcelReportService {
  // Generate professional Excel for Daily In/Out Stock Movement
  public static async generateDailyInOutExcel(transactions: any[], startDate?: string, endDate?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Fadna Production System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Daily Stock Movements', {
      views: [{ showGridLines: true }],
    });

    // Brand Header
    sheet.mergeCells('A1:I1');
    const headerRow = sheet.getCell('A1');
    headerRow.value = 'FADNA PRODUCTION STOCK & PLANNING SYSTEM';
    headerRow.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 36;

    // Subheader
    sheet.mergeCells('A2:I2');
    const subHeader = sheet.getCell('A2');
    subHeader.value = `Daily In-Out Stock Movement Report | Period: ${startDate || 'All Time'} to ${endDate || 'Present'}`;
    subHeader.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FFFFFFFF' } };
    subHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF115E59' } };
    subHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 24;

    sheet.addRow([]); // Blank line

    // Table Columns
    const columns = [
      { header: 'Txn No', key: 'transactionNumber', width: 22 },
      { header: 'Date & Time', key: 'date', width: 20 },
      { header: 'Category', key: 'itemType', width: 18 },
      { header: 'SKU', key: 'itemSku', width: 16 },
      { header: 'Item Description', key: 'itemName', width: 34 },
      { header: 'Type', key: 'transactionType', width: 12 },
      { header: 'Reason', key: 'reason', width: 18 },
      { header: 'Quantity', key: 'quantity', width: 14 },
      { header: 'Location / Flow', key: 'location', width: 26 },
      { header: 'Operator', key: 'performedByName', width: 20 },
    ];

    const tableHeaderRow = sheet.addRow(columns.map((c) => c.header));
    tableHeaderRow.height = 26;
    tableHeaderRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Populate data rows
    transactions.forEach((txn, index) => {
      const locFlow = txn.reason === 'Floor_Transfer' || txn.transactionType === 'TRANSFER'
        ? `${txn.fromLocation || 'Floor'} -> ${txn.toLocation || 'Store'}`
        : txn.toLocation || txn.fromLocation || 'Main';

      const row = sheet.addRow([
        txn.transactionNumber,
        new Date(txn.transactionDate).toLocaleString('en-GB'),
        txn.itemType,
        txn.itemSku,
        txn.itemName,
        txn.transactionType,
        txn.reason.replace('_', ' '),
        `${txn.quantity} ${txn.unit}`,
        locFlow,
        txn.performedByName,
      ]);

      const isEven = index % 2 === 0;
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (colNumber === 6) {
          // Color code transaction type
          if (txn.transactionType === 'IN') {
            cell.font = { color: { argb: 'FF059669' }, bold: true };
          } else if (txn.transactionType === 'OUT') {
            cell.font = { color: { argb: 'FFE11D48' }, bold: true };
          } else {
            cell.font = { color: { argb: 'FF2563EB' }, bold: true };
          }
        }
      });
    });

    columns.forEach((col, i) => {
      sheet.getColumn(i + 1).width = col.width;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Generate professional Excel for Daily Stock Status & Valuation
  public static async generateDailyStockExcel(
    finishedGoods: any[],
    rawMaterials: any[],
    packingMaterials: any[]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Fadna Production System';

    // 1. Finished Goods Sheet
    const fgSheet = workbook.addWorksheet('Finished Goods Stock');
    fgSheet.mergeCells('A1:H1');
    const fgH1 = fgSheet.getCell('A1');
    fgH1.value = 'FADNA - FINISHED GOODS INVENTORY & LOCATION STATUS';
    fgH1.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    fgH1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    fgH1.alignment = { horizontal: 'center', vertical: 'middle' };
    fgSheet.getRow(1).height = 32;

    const fgCols = [
      'SKU',
      'Product Name',
      'Category',
      'Prod Floor Stock',
      'Finished Store Stock',
      'Total Stock',
      'Unit',
      'Min Reorder Level',
      'Cost / Unit (LKR)',
      'Total Value (LKR)',
    ];
    const fgHeaderRow = fgSheet.addRow(fgCols);
    fgHeaderRow.height = 24;
    fgHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    });

    finishedGoods.forEach((fg) => {
      const floor = fg.productionFloorStock || 0;
      const store = fg.finishedStoreStock || 0;
      const total = floor + store;
      const value = total * (fg.costPerUnit || 0);

      fgSheet.addRow([
        fg.sku,
        fg.name,
        fg.category,
        floor,
        store,
        total,
        fg.unit,
        fg.minReorderLevel,
        fg.costPerUnit || 0,
        value,
      ]);
    });

    // 2. Raw Materials Sheet
    const rmSheet = workbook.addWorksheet('Raw Materials Stock');
    rmSheet.mergeCells('A1:G1');
    const rmH1 = rmSheet.getCell('A1');
    rmH1.value = 'FADNA - RAW MATERIALS INVENTORY';
    rmH1.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    rmH1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    rmH1.alignment = { horizontal: 'center', vertical: 'middle' };
    rmSheet.getRow(1).height = 32;

    const rmCols = ['SKU', 'Material Name', 'Botanical Name', 'Category', 'Current Stock', 'Unit', 'Reorder Level'];
    const rmHRow = rmSheet.addRow(rmCols);
    rmHRow.height = 24;
    rmHRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    });

    rawMaterials.forEach((rm) => {
      rmSheet.addRow([
        rm.sku,
        rm.name,
        rm.botanicalName || '',
        rm.category,
        rm.currentStock,
        rm.unit,
        rm.minReorderLevel,
      ]);
    });

    // 3. Packing Materials Sheet
    const pmSheet = workbook.addWorksheet('Packing Materials Stock');
    pmSheet.mergeCells('A1:F1');
    const pmH1 = pmSheet.getCell('A1');
    pmH1.value = 'FADNA - PACKING MATERIALS INVENTORY';
    pmH1.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    pmH1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    pmH1.alignment = { horizontal: 'center', vertical: 'middle' };
    pmSheet.getRow(1).height = 32;

    const pmCols = ['SKU', 'Packing Item', 'Category', 'Current Stock', 'Unit', 'Reorder Level'];
    const pmHRow = pmSheet.addRow(pmCols);
    pmHRow.height = 24;
    pmHRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    });

    packingMaterials.forEach((pm) => {
      pmSheet.addRow([
        pm.sku,
        pm.name,
        pm.category,
        pm.currentStock,
        pm.unit,
        pm.minReorderLevel,
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Generate factory operational Excel sheet: Separate IN/OUT Sheet and Stock Sheet, all fixed to A4 Landscape
  public static async generateDailyMatrixExcel(
    matrixData: {
      division: string;
      dateStr: string;
      products: any[];
      outRows: { channel: string; items: { [code: string]: number }; total: number }[];
      outTotals: { [code: string]: number };
      inRows: { channel: string; items: { [code: string]: number }; total: number }[];
      inTotals: { [code: string]: number };
      reconciliation: any[];
      packagingWIP?: any;
    },
    sheetType: 'all' | 'in-out' | 'stock' = 'all'
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Fadna Production System';
    workbook.created = new Date();

    const getColLetter = (colIdx: number) => {
      let temp = '';
      let letter = '';
      while (colIdx > 0) {
        temp = String.fromCharCode(((colIdx - 1) % 26) + 65);
        letter = temp + letter;
        colIdx = Math.floor((colIdx - 1) / 26);
      }
      return letter;
    };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    const headerBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };

    const applyA4LandscapeSetup = (sheet: ExcelJS.Worksheet) => {
      sheet.pageSetup = {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.35,
          bottom: 0.35,
          header: 0.15,
          footer: 0.15,
        },
        horizontalCentered: true,
        verticalCentered: false,
      };
      (sheet.properties as any).pageSetUpProperties = {
        fitToPage: true,
      };
      sheet.views = [{ showGridLines: true }];
    };

    const prefix = matrixData.division.toUpperCase().replace(/\s+/g, '_');
    const numProducts = matrixData.products.length;

    // ==========================================
    // 1. BUILD IN / OUT SHEET
    // ==========================================
    if (sheetType === 'all' || sheetType === 'in-out') {
      const inOutSheet = workbook.addWorksheet(`${prefix}_IN_OUT`);
      applyA4LandscapeSetup(inOutSheet);

      const lastColIndex = numProducts + 2; // +1 Remark, +1 Total
      const lastColLetter = getColLetter(lastColIndex);
      const splitPoint = Math.max(1, Math.floor(lastColIndex * 0.75));
      const splitColLetter = getColLetter(splitPoint);
      const dateStartColLetter = getColLetter(splitPoint + 1);

      // Title Banner
      inOutSheet.mergeCells(`A1:${splitColLetter}1`);
      const tCell = inOutSheet.getCell('A1');
      tCell.value = `${matrixData.division.toUpperCase()} - DAILY IN / OUT OPERATION SHEET`;
      tCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      tCell.alignment = { horizontal: 'center', vertical: 'middle' };

      inOutSheet.mergeCells(`${dateStartColLetter}1:${lastColLetter}1`);
      const dCell = inOutSheet.getCell(`${dateStartColLetter}1`);
      dCell.value = `DATE: ${matrixData.dateStr}`;
      dCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF34D399' } };
      dCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      dCell.alignment = { horizontal: 'center', vertical: 'middle' };
      inOutSheet.getRow(1).height = 28;

      // Section: OUT Banner
      inOutSheet.mergeCells(`A2:${lastColLetter}2`);
      const outBanner = inOutSheet.getCell('A2');
      outBanner.value = 'OUT - DAILY DISPATCH & SALES ORDERS';
      outBanner.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      outBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE123C' } }; // Rose-700
      outBanner.alignment = { horizontal: 'center', vertical: 'middle' };
      inOutSheet.getRow(2).height = 20;

      // OUT Table Headers
      const headers = matrixData.products.map((p) => p.shortCode);
      headers.push('REMARK');
      headers.push('TOTAL');

      const outHRow = inOutSheet.addRow(headers);
      outHRow.height = 22;
      outHRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = headerBorder;
      });

      // OUT Rows
      matrixData.outRows.forEach((row) => {
        const rowData: (string | number)[] = matrixData.products.map((p) => {
          const val = row.items[p.shortCode];
          return val ? val : '-';
        });
        rowData.push(row.channel);
        rowData.push(row.total > 0 ? row.total : '-');

        const dataRow = inOutSheet.addRow(rowData);
        dataRow.height = 18;
        dataRow.eachCell((cell, colNum) => {
          cell.font = { name: 'Arial', size: 8.5 };
          cell.alignment = {
            horizontal: colNum === numProducts + 1 ? 'left' : 'center',
            vertical: 'middle',
          };
          cell.border = thinBorder;
          if (colNum === numProducts + 2 && typeof cell.value === 'number') {
            cell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFBE123C' } };
          }
        });
      });

      // Pad blank rows for factory notes
      const minOut = 6;
      for (let i = matrixData.outRows.length; i < minOut; i++) {
        const blankRow = inOutSheet.addRow(matrixData.products.map(() => '').concat(['', '']));
        blankRow.height = 17;
        blankRow.eachCell((cell) => { cell.border = thinBorder; });
      }

      // TOTAL OUT Row
      const outTotalValues = matrixData.products.map((p) => matrixData.outTotals[p.shortCode] || 0);
      const grandOut = Object.values(matrixData.outTotals).reduce((a, b) => a + b, 0);
      outTotalValues.push('TOTAL OUT' as any);
      outTotalValues.push(grandOut as any);

      const outTotRow = inOutSheet.addRow(outTotalValues);
      outTotRow.height = 22;
      outTotRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF9F1239' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FFBE123C' } },
          bottom: { style: 'double', color: { argb: 'FFBE123C' } },
          left: { style: 'thin', color: { argb: 'FFBE123C' } },
          right: { style: 'thin', color: { argb: 'FFBE123C' } },
        };
      });

      // Blank line
      inOutSheet.addRow([]);

      // Section: IN Banner
      const inBannerRowIdx = inOutSheet.lastRow!.number + 1;
      inOutSheet.mergeCells(`A${inBannerRowIdx}:${lastColLetter}${inBannerRowIdx}`);
      const inBanner = inOutSheet.getCell(`A${inBannerRowIdx}`);
      inBanner.value = 'IN - PRODUCTION RECEIPTS / STOCK IN';
      inBanner.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      inBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }; // Emerald-700
      inBanner.alignment = { horizontal: 'center', vertical: 'middle' };
      inOutSheet.getRow(inBannerRowIdx).height = 20;

      // IN Table Headers
      const inHRow = inOutSheet.addRow(headers);
      inHRow.height = 22;
      inHRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = headerBorder;
      });

      // IN Rows
      if (matrixData.inRows.length > 0) {
        matrixData.inRows.forEach((row) => {
          const rowData: (string | number)[] = matrixData.products.map((p) => {
            const val = row.items[p.shortCode];
            return val ? val : '-';
          });
          rowData.push(row.channel);
          rowData.push(row.total > 0 ? row.total : '-');

          const dataRow = inOutSheet.addRow(rowData);
          dataRow.height = 18;
          dataRow.eachCell((cell, colNum) => {
            cell.font = { name: 'Arial', size: 8.5 };
            cell.alignment = {
              horizontal: colNum === numProducts + 1 ? 'left' : 'center',
              vertical: 'middle',
            };
            cell.border = thinBorder;
            if (colNum === numProducts + 2 && typeof cell.value === 'number') {
              cell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF047857' } };
            }
          });
        });
      }

      // Pad blank rows for IN
      const minIn = 3;
      for (let i = matrixData.inRows.length; i < minIn; i++) {
        const blankRow = inOutSheet.addRow(matrixData.products.map(() => '').concat(['', '']));
        blankRow.height = 17;
        blankRow.eachCell((cell) => { cell.border = thinBorder; });
      }

      // TOTAL IN Row
      const inTotalValues = matrixData.products.map((p) => matrixData.inTotals[p.shortCode] || 0);
      const grandIn = Object.values(matrixData.inTotals).reduce((a, b) => a + b, 0);
      inTotalValues.push('TOTAL IN' as any);
      inTotalValues.push(grandIn as any);

      const inTotRow = inOutSheet.addRow(inTotalValues);
      inTotRow.height = 22;
      inTotRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF047857' } },
          bottom: { style: 'double', color: { argb: 'FF047857' } },
          left: { style: 'thin', color: { argb: 'FF047857' } },
          right: { style: 'thin', color: { argb: 'FF047857' } },
        };
      });

      // NET DAILY MOVEMENT ROW (IN - OUT)
      const netValues = matrixData.products.map((p) => {
        return (matrixData.inTotals[p.shortCode] || 0) - (matrixData.outTotals[p.shortCode] || 0);
      });
      netValues.push('NET BALANCE (IN - OUT)' as any);
      netValues.push((grandIn - grandOut) as any);

      const netRow = inOutSheet.addRow(netValues);
      netRow.height = 20;
      netRow.eachCell((cell) => {
        const val = cell.value;
        cell.font = { name: 'Arial', size: 8.5, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = thinBorder;
        if (typeof val === 'number') {
          if (val > 0) cell.font = { color: { argb: 'FF047857' }, bold: true };
          else if (val < 0) cell.font = { color: { argb: 'FFBE123C' }, bold: true };
        }
      });

      // Packaging WIP summary at bottom of IN/OUT sheet
      const wip = matrixData.packagingWIP || {};
      const wipHeaders = ['BOX STOCK', 'PASTED', 'PASTING', 'BOX', 'POUCH', 'POUCH STOCK'];
      const wipValues = [
        wip.boxStock ?? 0,
        wip.pasted ?? 0,
        wip.pasting ?? 0,
        wip.box ?? 0,
        wip.pouch ?? 0,
        wip.pouchStock ?? 0,
      ];

      inOutSheet.addRow([]);
      const wipH = inOutSheet.addRow(wipHeaders);
      wipH.height = 18;
      wipH.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF475569' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = thinBorder;
      });

      const wipV = inOutSheet.addRow(wipValues);
      wipV.height = 18;
      wipV.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });

      // Signatures
      inOutSheet.addRow([]);
      const sigRow = inOutSheet.addRow([
        'Prepared By: _________________',
        '',
        'Production Supervisor: _________________',
        '',
        'Store Keeper: _________________',
      ]);
      sigRow.height = 18;
      sigRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 8.5, italic: true };
      });

      // Column widths
      inOutSheet.columns.forEach((col, index) => {
        if (index === numProducts) {
          col.width = 24; // Remarks
        } else if (index === numProducts + 1) {
          col.width = 11; // Total
        } else {
          col.width = 7.5; // Product codes
        }
      });
    }

    // ==========================================
    // 2. BUILD STOCK & AUDIT RECONCILIATION SHEET
    // ==========================================
    if (sheetType === 'all' || sheetType === 'stock') {
      const stockSheet = workbook.addWorksheet(`${prefix}_STOCK`);
      applyA4LandscapeSetup(stockSheet);

      const lastColIndex = numProducts + 1;
      const lastColLetter = getColLetter(lastColIndex);
      const splitPoint = Math.max(1, Math.floor(lastColIndex * 0.75));
      const splitColLetter = getColLetter(splitPoint);
      const dateStartColLetter = getColLetter(splitPoint + 1);

      // Title Banner
      stockSheet.mergeCells(`A1:${splitColLetter}1`);
      const tCell = stockSheet.getCell('A1');
      tCell.value = `${matrixData.division.toUpperCase()} - DAILY PHYSICAL STOCK & RECONCILIATION SHEET`;
      tCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } }; // Deep Indigo
      tCell.alignment = { horizontal: 'center', vertical: 'middle' };

      stockSheet.mergeCells(`${dateStartColLetter}1:${lastColLetter}1`);
      const dCell = stockSheet.getCell(`${dateStartColLetter}1`);
      dCell.value = `DATE: ${matrixData.dateStr}`;
      dCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF818CF8' } };
      dCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
      dCell.alignment = { horizontal: 'center', vertical: 'middle' };
      stockSheet.getRow(1).height = 28;

      // Section: Reconciliation Matrix Banner
      stockSheet.mergeCells(`A2:${lastColLetter}2`);
      const reconBanner = stockSheet.getCell('A2');
      reconBanner.value = 'PHYSICAL AUDIT & RECONCILIATION MATRIX (Actual Count vs System Inventory)';
      reconBanner.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      reconBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
      reconBanner.alignment = { horizontal: 'center', vertical: 'middle' };
      stockSheet.getRow(2).height = 20;

      // Product Headers Row
      const reconHeaders = ['METRIC', ...matrixData.products.map((p) => p.shortCode)];
      const reconHRow = stockSheet.addRow(reconHeaders);
      reconHRow.height = 22;
      reconHRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = headerBorder;
      });

      // 1. ACTUAL (Physical Count)
      const actualRowData = [
        'ACTUAL (PHYSICAL COUNT)',
        ...matrixData.products.map((p) =>
          p.physicalActualStock !== undefined && p.physicalActualStock !== null
            ? p.physicalActualStock
            : ''
        ),
      ];
      const actRow = stockSheet.addRow(actualRowData);
      actRow.height = 20;
      actRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF3730A3' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        cell.alignment = { horizontal: colNum === 1 ? 'left' : 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });

      // 2. FINISHED STORE STOCK
      const storeRowData = [
        'FINISHED STORE STOCK',
        ...matrixData.products.map((p) => p.finishedStoreStock ?? 0),
      ];
      const strRow = stockSheet.addRow(storeRowData);
      strRow.height = 18;
      strRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 8.5 };
        cell.alignment = { horizontal: colNum === 1 ? 'left' : 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });

      // 3. VARIANCE / DIFFERENCE
      const diffRowData = [
        'DIFFERENCE / VARIANCE',
        ...matrixData.products.map((p) => {
          if (
            p.physicalActualStock === undefined ||
            p.physicalActualStock === null ||
            (p.physicalActualStock as any) === ''
          ) {
            return '';
          }
          const storeStock = p.finishedStoreStock ?? 0;
          return Number(p.physicalActualStock) - storeStock;
        }),
      ];
      const dfRow = stockSheet.addRow(diffRowData);
      dfRow.height = 22;
      dfRow.eachCell((cell, colNum) => {
        const val = cell.value;
        cell.font = { name: 'Arial', size: 9, bold: true };
        cell.alignment = { horizontal: colNum === 1 ? 'left' : 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF475569' } },
          bottom: { style: 'double', color: { argb: 'FF475569' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        if (typeof val === 'number') {
          if (val === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            cell.font = { color: { argb: 'FF64748B' } };
          } else if (val > 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            cell.font = { color: { argb: 'FF15803D' }, bold: true };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
            cell.font = { color: { argb: 'FFBE123C' }, bold: true };
          }
        }
      });

      // Packaging WIP buffer breakdown
      const wip = matrixData.packagingWIP || {};
      stockSheet.addRow([]);
      const wipH2 = stockSheet.addRow(['BOX STOCK', 'PASTED', 'PASTING', 'BOX', 'POUCH', 'POUCH STOCK']);
      wipH2.height = 18;
      wipH2.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF475569' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = thinBorder;
      });

      const wipV2 = stockSheet.addRow([
        wip.boxStock ?? 0,
        wip.pasted ?? 0,
        wip.pasting ?? 0,
        wip.box ?? 0,
        wip.pouch ?? 0,
        wip.pouchStock ?? 0,
      ]);
      wipV2.height = 18;
      wipV2.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });

      // Signatures
      stockSheet.addRow([]);
      const sigRow = stockSheet.addRow([
        'Physical Count By: _________________',
        '',
        'Audited By: _________________',
        '',
        'Store Keeper: _________________',
        '',
        'Date / Time: ____________',
      ]);
      sigRow.height = 18;
      sigRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 8.5, italic: true };
      });

      // Column widths
      stockSheet.columns.forEach((col, index) => {
        if (index === 0) col.width = 26; // Metric label
        else col.width = 7.5; // Product short code columns
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
