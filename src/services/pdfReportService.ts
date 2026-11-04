import PDFDocument from 'pdfkit';

export class PDFReportService {
  public static async generateDailyInOutPDF(transactions: any[], startDate?: string, endDate?: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Brand Banner
        doc.rect(0, 0, doc.page.width, 50).fill('#0d9488');
        doc.fillColor('#ffffff').fontSize(16).text('FADNA PRODUCTION STOCK & PLANNING SYSTEM', 30, 15, {
          align: 'left',
        });
        doc.fontSize(10).text(`DAILY STOCK MOVEMENTS REPORT (${startDate || 'ALL'} TO ${endDate || 'PRESENT'})`, 30, 32);

        doc.fillColor('#334155').fontSize(8).text(`Generated: ${new Date().toLocaleString()}`, 30, 58, { align: 'right' });

        let y = 75;

        // Table Header
        doc.rect(30, y, doc.page.width - 60, 20).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('TXN NUMBER', 35, y + 6);
        doc.text('DATE/TIME', 150, y + 6);
        doc.text('ITEM TYPE', 240, y + 6);
        doc.text('ITEM NAME', 320, y + 6);
        doc.text('TYPE', 480, y + 6);
        doc.text('REASON', 530, y + 6);
        doc.text('QUANTITY', 610, y + 6);
        doc.text('OPERATOR', 700, y + 6);

        y += 22;
        doc.font('Helvetica').fontSize(7);

        transactions.forEach((txn, i) => {
          if (y > doc.page.height - 40) {
            doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
            y = 40;
          }

          if (i % 2 === 0) {
            doc.rect(30, y - 2, doc.page.width - 60, 16).fill('#f8fafc');
          }

          doc.fillColor('#1e293b');
          doc.text(txn.transactionNumber || '', 35, y + 2, { width: 110, ellipsis: true });
          doc.text(new Date(txn.transactionDate).toLocaleDateString() || '', 150, y + 2);
          doc.text(txn.itemType || '', 240, y + 2);
          doc.text(txn.itemName || '', 320, y + 2, { width: 150, ellipsis: true });

          if (txn.transactionType === 'IN') doc.fillColor('#059669');
          else if (txn.transactionType === 'OUT') doc.fillColor('#e11d48');
          else doc.fillColor('#2563eb');
          doc.text(txn.transactionType || '', 480, y + 2);

          doc.fillColor('#475569');
          doc.text(txn.reason ? txn.reason.replace('_', ' ') : '', 530, y + 2);
          doc.text(`${txn.quantity} ${txn.unit}`, 610, y + 2);
          doc.text(txn.performedByName || '', 700, y + 2, { width: 80, ellipsis: true });

          y += 16;
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  public static async generateDailyStockPDF(finishedGoods: any[], rawMaterials: any[], packingMaterials: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        doc.rect(0, 0, doc.page.width, 50).fill('#0d9488');
        doc.fillColor('#ffffff').fontSize(16).text('FADNA PRODUCTION SYSTEM', 30, 15);
        doc.fontSize(10).text(`DAILY STOCK STATUS REPORT - ${new Date().toLocaleDateString()}`, 30, 32);

        let y = 70;

        // Section 1: Finished Goods
        doc.fillColor('#0f766e').fontSize(12).font('Helvetica-Bold').text('1. FINISHED GOODS (LOCATION BREAKDOWN)', 30, y);
        y += 18;

        doc.rect(30, y, doc.page.width - 60, 18).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('SKU', 35, y + 5);
        doc.text('PRODUCT NAME', 100, y + 5);
        doc.text('FLOOR STOCK', 260, y + 5);
        doc.text('STORE STOCK', 350, y + 5);
        doc.text('TOTAL', 440, y + 5);
        doc.text('UNIT', 500, y + 5);

        y += 20;
        doc.font('Helvetica').fontSize(8);

        finishedGoods.forEach((fg, idx) => {
          if (y > doc.page.height - 40) {
            doc.addPage({ margin: 30, size: 'A4' });
            y = 40;
          }
          if (idx % 2 === 0) doc.rect(30, y - 2, doc.page.width - 60, 15).fill('#f1f5f9');
          doc.fillColor('#0f172a');
          doc.text(fg.sku, 35, y + 2);
          doc.text(fg.name, 100, y + 2, { width: 150, ellipsis: true });
          doc.text(String(fg.productionFloorStock || 0), 260, y + 2);
          doc.text(String(fg.finishedStoreStock || 0), 350, y + 2);
          doc.text(String((fg.productionFloorStock || 0) + (fg.finishedStoreStock || 0)), 440, y + 2);
          doc.text(fg.unit, 500, y + 2);
          y += 16;
        });

        // Section 2: Raw Materials summary
        y += 20;
        if (y > doc.page.height - 100) {
          doc.addPage({ margin: 30, size: 'A4' });
          y = 40;
        }

        doc.fillColor('#059669').fontSize(12).font('Helvetica-Bold').text('2. RAW MATERIALS STOCK', 30, y);
        y += 18;

        doc.rect(30, y, doc.page.width - 60, 18).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('SKU', 35, y + 5);
        doc.text('MATERIAL NAME', 100, y + 5);
        doc.text('CURRENT STOCK', 320, y + 5);
        doc.text('MIN REORDER', 420, y + 5);
        doc.text('UNIT', 500, y + 5);

        y += 20;
        doc.font('Helvetica').fontSize(8);

        rawMaterials.forEach((rm, idx) => {
          if (y > doc.page.height - 40) {
            doc.addPage({ margin: 30, size: 'A4' });
            y = 40;
          }
          if (idx % 2 === 0) doc.rect(30, y - 2, doc.page.width - 60, 15).fill('#f1f5f9');
          doc.fillColor('#0f172a');
          doc.text(rm.sku, 35, y + 2);
          doc.text(rm.name, 100, y + 2, { width: 210, ellipsis: true });
          doc.text(String(rm.currentStock), 320, y + 2);
          doc.text(String(rm.minReorderLevel), 420, y + 2);
          doc.text(rm.unit, 500, y + 2);
          y += 16;
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // Generate Daily Matrix PDF report fixed to A4 Landscape sheets
  public static async generateDailyMatrixPDF(
    matrixData: {
      division: string;
      dateStr: string;
      products: any[];
      outRows: { channel: string; items: { [code: string]: number }; total: number }[];
      outTotals: { [code: string]: number };
      inRows: { channel: string; items: { [code: string]: number }; total: number }[];
      inTotals: { [code: string]: number };
      packagingWIP?: any;
    },
    sheetType: 'all' | 'in-out' | 'stock' = 'all'
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 25, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const leftMargin = 25;
        const usableWidth = pageWidth - leftMargin * 2;
        const numProducts = matrixData.products.length;
        const codeColWidth = Math.max(18, Math.min(28, (usableWidth - 140) / Math.max(numProducts, 1)));

        let hasFirstPage = false;

        // ==========================================
        // PAGE 1: IN / OUT SHEET
        // ==========================================
        if (sheetType === 'all' || sheetType === 'in-out') {
          hasFirstPage = true;

          // Header Banner
          doc.rect(leftMargin, 20, usableWidth, 26).fill('#0f172a');
          doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
          doc.text(`${matrixData.division.toUpperCase()} - DAILY IN / OUT OPERATION SHEET`, leftMargin + 10, 28, {
            continued: false,
          });
          doc.fillColor('#34d399').fontSize(10);
          doc.text(`DATE: ${matrixData.dateStr}`, leftMargin, 28, {
            align: 'right',
            width: usableWidth - 10,
          });

          let y = 52;

          // OUT Section Header
          doc.rect(leftMargin, y, usableWidth, 16).fill('#be123c');
          doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
          doc.text('OUT - DAILY DISPATCH & SALES ORDERS', leftMargin, y + 4, {
            align: 'center',
            width: usableWidth,
          });
          y += 18;

          // Table Header (Codes + Remark + Total)
          doc.rect(leftMargin, y, usableWidth, 16).fill('#1e293b');
          doc.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold');

          matrixData.products.forEach((p, idx) => {
            const x = leftMargin + idx * codeColWidth;
            doc.text(p.shortCode, x, y + 4, { width: codeColWidth, align: 'center' });
          });
          doc.text('REMARK / CHANNEL', leftMargin + numProducts * codeColWidth + 4, y + 4, { width: 100 });
          doc.text('TOTAL', leftMargin + usableWidth - 32, y + 4, { width: 30, align: 'right' });
          y += 17;

          // OUT Rows
          doc.font('Helvetica').fontSize(6.5);
          matrixData.outRows.slice(0, 8).forEach((row, rIdx) => {
            const bg = rIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
            doc.rect(leftMargin, y - 1, usableWidth, 13).fill(bg);
            doc.fillColor('#0f172a');

            matrixData.products.forEach((p, idx) => {
              const val = row.items[p.shortCode];
              const x = leftMargin + idx * codeColWidth;
              doc.text(val ? String(val) : '-', x, y + 2, { width: codeColWidth, align: 'center' });
            });
            doc.fillColor('#1e293b');
            doc.text(row.channel || '', leftMargin + numProducts * codeColWidth + 4, y + 2, {
              width: 100,
              ellipsis: true,
            });
            doc.fillColor('#be123c').font('Helvetica-Bold');
            doc.text(row.total > 0 ? String(row.total) : '-', leftMargin + usableWidth - 32, y + 2, {
              width: 30,
              align: 'right',
            });
            doc.font('Helvetica');
            y += 13;
          });

          // TOTAL OUT Row
          doc.rect(leftMargin, y, usableWidth, 15).fill('#ffe4e6');
          doc.fillColor('#9f1239').font('Helvetica-Bold').fontSize(7);
          matrixData.products.forEach((p, idx) => {
            const tot = matrixData.outTotals[p.shortCode] || 0;
            const x = leftMargin + idx * codeColWidth;
            doc.text(tot ? String(tot) : '0', x, y + 3, { width: codeColWidth, align: 'center' });
          });
          doc.text('TOTAL OUT', leftMargin + numProducts * codeColWidth + 4, y + 3);
          const grandOut = Object.values(matrixData.outTotals).reduce((a: any, b: any) => a + b, 0);
          doc.text(String(grandOut), leftMargin + usableWidth - 32, y + 3, { width: 30, align: 'right' });
          y += 19;

          // IN Section Header
          doc.rect(leftMargin, y, usableWidth, 16).fill('#047857');
          doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
          doc.text('IN - PRODUCTION RECEIPTS / STOCK IN', leftMargin, y + 4, {
            align: 'center',
            width: usableWidth,
          });
          y += 18;

          // IN Column Headers
          doc.rect(leftMargin, y, usableWidth, 16).fill('#1e293b');
          doc.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold');
          matrixData.products.forEach((p, idx) => {
            const x = leftMargin + idx * codeColWidth;
            doc.text(p.shortCode, x, y + 4, { width: codeColWidth, align: 'center' });
          });
          doc.text('REMARK / BATCH', leftMargin + numProducts * codeColWidth + 4, y + 4, { width: 100 });
          doc.text('TOTAL', leftMargin + usableWidth - 32, y + 4, { width: 30, align: 'right' });
          y += 17;

          // IN Rows
          doc.font('Helvetica').fontSize(6.5);
          (matrixData.inRows.length > 0 ? matrixData.inRows.slice(0, 4) : [{ channel: 'No production logged today', items: {}, total: 0 }]).forEach((row, rIdx) => {
            const bg = rIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
            doc.rect(leftMargin, y - 1, usableWidth, 13).fill(bg);
            doc.fillColor('#0f172a');

            matrixData.products.forEach((p, idx) => {
              const val = row.items[p.shortCode];
              const x = leftMargin + idx * codeColWidth;
              doc.text(val ? String(val) : '-', x, y + 2, { width: codeColWidth, align: 'center' });
            });
            doc.fillColor('#1e293b');
            doc.text(row.channel || '', leftMargin + numProducts * codeColWidth + 4, y + 2, {
              width: 100,
              ellipsis: true,
            });
            doc.fillColor('#047857').font('Helvetica-Bold');
            doc.text(row.total > 0 ? String(row.total) : '-', leftMargin + usableWidth - 32, y + 2, {
              width: 30,
              align: 'right',
            });
            doc.font('Helvetica');
            y += 13;
          });

          // TOTAL IN Row
          doc.rect(leftMargin, y, usableWidth, 15).fill('#d1fae5');
          doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(7);
          matrixData.products.forEach((p, idx) => {
            const tot = matrixData.inTotals[p.shortCode] || 0;
            const x = leftMargin + idx * codeColWidth;
            doc.text(tot ? String(tot) : '0', x, y + 3, { width: codeColWidth, align: 'center' });
          });
          doc.text('TOTAL IN', leftMargin + numProducts * codeColWidth + 4, y + 3);
          const grandIn = Object.values(matrixData.inTotals).reduce((a: any, b: any) => a + b, 0);
          doc.text(String(grandIn), leftMargin + usableWidth - 32, y + 3, { width: 30, align: 'right' });
          y += 19;

          // NET Row
          doc.rect(leftMargin, y, usableWidth, 15).fill('#f1f5f9');
          doc.fillColor('#334155').font('Helvetica-Bold').fontSize(7);
          matrixData.products.forEach((p, idx) => {
            const net = (matrixData.inTotals[p.shortCode] || 0) - (matrixData.outTotals[p.shortCode] || 0);
            const x = leftMargin + idx * codeColWidth;
            doc.fillColor(net > 0 ? '#047857' : net < 0 ? '#be123c' : '#64748b');
            doc.text(String(net), x, y + 3, { width: codeColWidth, align: 'center' });
          });
          doc.fillColor('#0f172a');
          doc.text('NET DAILY MOVEMENT', leftMargin + numProducts * codeColWidth + 4, y + 3);
          doc.text(String(grandIn - grandOut), leftMargin + usableWidth - 32, y + 3, { width: 30, align: 'right' });
          y += 20;

          // Packaging WIP bottom strip
          const wip = matrixData.packagingWIP || {};
          doc.rect(leftMargin, y, usableWidth, 18).fill('#e2e8f0');
          doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5);
          doc.text(
            `PACKAGING BUFFER: BOX STOCK: ${wip.boxStock || 0}  |  PASTED: ${wip.pasted || 0}  |  PASTING: ${wip.pasting || 0}  |  BOX: ${wip.box || 0}  |  POUCH: ${wip.pouch || 0}  |  POUCH STOCK: ${wip.pouchStock || 0}`,
            leftMargin + 10,
            y + 5
          );
        }

        // ==========================================
        // PAGE 2: STOCK & AUDIT SHEET
        // ==========================================
        if (sheetType === 'all' || sheetType === 'stock') {
          if (hasFirstPage) {
            doc.addPage({ margin: 25, size: 'A4', layout: 'landscape' });
          }

          // Header Banner
          doc.rect(leftMargin, 20, usableWidth, 26).fill('#1e1b4b');
          doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
          doc.text(`${matrixData.division.toUpperCase()} - DAILY PHYSICAL STOCK & RECONCILIATION SHEET`, leftMargin + 10, 28);
          doc.fillColor('#818cf8').fontSize(10);
          doc.text(`DATE: ${matrixData.dateStr}`, leftMargin, 28, {
            align: 'right',
            width: usableWidth - 10,
          });

          let y = 52;

          // Audit Matrix Banner
          doc.rect(leftMargin, y, usableWidth, 16).fill('#4338ca');
          doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
          doc.text('PHYSICAL AUDIT & RECONCILIATION MATRIX (Actual Count vs System Inventory)', leftMargin, y + 4, {
            align: 'center',
            width: usableWidth,
          });
          y += 18;

          // Matrix Column Headers
          doc.rect(leftMargin, y, usableWidth, 16).fill('#1e293b');
          doc.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold');
          doc.text('METRIC', leftMargin + 6, y + 4, { width: 110 });
          matrixData.products.forEach((p, idx) => {
            const x = leftMargin + 120 + idx * codeColWidth;
            doc.text(p.shortCode, x, y + 4, { width: codeColWidth, align: 'center' });
          });
          y += 17;

          // Matrix Rows
          const matrixRows = [
            {
              label: 'ACTUAL (PHYSICAL COUNT)',
              bg: '#e0e7ff',
              color: '#3730a3',
              bold: true,
              getVal: (p: any) => p.physicalActualStock ?? p.finishedStoreStock ?? 0,
            },
            {
              label: 'FINISHED STORE STOCK',
              bg: '#f8fafc',
              color: '#0f172a',
              bold: false,
              getVal: (p: any) => p.finishedStoreStock ?? 0,
            },
            {
              label: 'DIFFERENCE / VARIANCE',
              bg: '#fff1f2',
              color: '#be123c',
              bold: true,
              getVal: (p: any) => (p.physicalActualStock ?? p.finishedStoreStock ?? 0) - (p.finishedStoreStock ?? 0),
            },
          ];

          matrixRows.forEach((mRow) => {
            doc.rect(leftMargin, y - 1, usableWidth, 14).fill(mRow.bg);
            doc.fillColor(mRow.color).fontSize(6.5);
            if (mRow.bold) doc.font('Helvetica-Bold');
            else doc.font('Helvetica');

            doc.text(mRow.label, leftMargin + 6, y + 2, { width: 110 });
            matrixData.products.forEach((p, idx) => {
              const v = mRow.getVal(p);
              const x = leftMargin + 120 + idx * codeColWidth;
              doc.text(String(v), x, y + 2, { width: codeColWidth, align: 'center' });
            });
            y += 14;
          });

          y += 25;

          // Packaging WIP bottom strip
          const wip = matrixData.packagingWIP || {};
          doc.rect(leftMargin, y, usableWidth, 20).fill('#e2e8f0');
          doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
          doc.text(
            `PACKAGING BUFFER: BOX STOCK: ${wip.boxStock || 0}  |  PASTED: ${wip.pasted || 0}  |  PASTING: ${wip.pasting || 0}  |  BOX: ${wip.box || 0}  |  POUCH: ${wip.pouch || 0}  |  POUCH STOCK: ${wip.pouchStock || 0}`,
            leftMargin + 10,
            y + 6
          );
          y += 35;

          // Bottom Signatures
          doc.rect(leftMargin, y, usableWidth, 22).fill('#f1f5f9');
          doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5);
          doc.text(
            'Audited By: ___________________________       Verified By Factory Manager: ___________________________       Store Keeper: ___________________________',
            leftMargin + 10,
            y + 7
          );
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
