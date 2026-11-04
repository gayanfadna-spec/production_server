import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { BOM } from '../models/BOM.js';
import { FinishedGood } from '../models/FinishedGood.js';
import { RawMaterial } from '../models/RawMaterial.js';
import { PackingMaterial } from '../models/PackingMaterial.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { AuditService } from '../services/auditService.js';

export const getBOMs = async (req: Request, res: Response): Promise<any> => {
  try {
    const boms = await BOM.find({ isActive: true })
      .populate('finishedGood')
      .populate('rawMaterials.rawMaterial')
      .populate('packingMaterials.packingMaterial')
      .populate('stages.ingredients.rawMaterial')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: boms.length, data: boms });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBOMByFinishedGood = async (req: Request, res: Response): Promise<any> => {
  try {
    const bom = await BOM.findOne({ finishedGood: req.params.finishedGoodId, isActive: true })
      .populate('finishedGood')
      .populate('rawMaterials.rawMaterial')
      .populate('packingMaterials.packingMaterial')
      .populate('stages.ingredients.rawMaterial');

    if (!bom) {
      return res.status(404).json({ success: false, message: 'BOM not found for this finished good' });
    }

    return res.json({ success: true, data: bom });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createOrUpdateBOM = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const {
      finishedGood,
      formulaName,
      division,
      blendGramsPerUnit,
      batchSize,
      unit,
      version,
      rawMaterials,
      packingMaterials,
      isMultiStage,
      stages,
      notes,
    } = req.body;

    let fg: any = null;
    if (finishedGood && mongoose.Types.ObjectId.isValid(String(finishedGood))) {
      fg = await FinishedGood.findById(finishedGood);
    }
    if (!fg && finishedGood) {
      const searchStr = String(finishedGood).trim();
      fg = await FinishedGood.findOne({
        $or: [
          { sku: { $regex: new RegExp(`^${searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { name: { $regex: new RegExp(`^${searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { name: { $regex: new RegExp(searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
        ],
      });
      if (!fg) {
        const div = division || 'Fadna Life Science';
        const prefix = div === 'Fadna Tea' ? 'TEA' : 'LS';
        const count = await FinishedGood.countDocuments();
        const sku = `FG-${prefix}-${(count + 1).toString().padStart(3, '0')}`;
        fg = await FinishedGood.create({
          sku,
          name: searchStr,
          division: div,
          category: div === 'Fadna Tea' ? 'Wellness Tea' : 'Ayurvedic Supplement',
          netWeight: Number(blendGramsPerUnit) || (div === 'Fadna Life Science' ? 100 : 40),
          unit: unit || 'Packs',
          currentStock: 0,
          minStockLevel: 50,
          shelfLifeMonths: 24,
          sellingPrice: 1500,
          isActive: true,
        });
      }
    }
    if (!fg) return res.status(404).json({ success: false, message: 'Finished good not found or invalid' });

    const editorName = req.user?.name || 'Administrator';

    // Effective batch size and grams per unit for nominal calculation
    const effectiveBatchSize = Number(batchSize) || 100;
    const effectiveGramsPerUnit = Number(blendGramsPerUnit) || (fg.division === 'Fadna Life Science' ? 100 : 40);
    const nominalBatchKg = (effectiveBatchSize * effectiveGramsPerUnit) / 1000;

    // Calculate percentages for raw materials if not provided, or ensure positive nominal quantity
    const totalRawQty = (rawMaterials || []).reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
    const processedRaw: any[] = [];

    for (const r of (rawMaterials || [])) {
      let rawMaterialId = r.rawMaterial;
      if (rawMaterialId && typeof rawMaterialId === 'object' && rawMaterialId._id) {
        rawMaterialId = rawMaterialId._id;
      }

      // If not a valid ObjectId, search or create a new Raw Material record
      if (!rawMaterialId || !mongoose.Types.ObjectId.isValid(String(rawMaterialId))) {
        const matName = String(r.newMaterialName || r.name || r.rawMaterial || '').trim();
        if (matName) {
          let rm = await RawMaterial.findOne({ name: { $regex: new RegExp(`^${matName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          if (!rm) {
            const prefix = fg.division === 'Fadna Tea' ? 'TEA' : 'LS';
            const count = await RawMaterial.countDocuments();
            const sku = `RM-${prefix}-${(count + 1).toString().padStart(3, '0')}`;
            rm = await RawMaterial.create({
              sku,
              name: matName,
              botanicalName: r.botanicalName || '',
              category: r.category || (fg.division === 'Fadna Tea' ? 'Tea' : 'Lifescience'),
              unit: r.unit || 'kg',
              costPerUnit: Number(r.costPerUnit) || 1200,
              minReorderLevel: 50,
              currentStock: 100,
              supplier: r.supplier || 'Herbal Ingredient Supplier',
              storageLocation: r.storageLocation || 'Central RM Stores',
              lastEditedBy: {
                userId: req.user?._id,
                userName: editorName,
                userEmail: req.user?.email || '',
                userRole: req.user?.role || 'admin',
                editedAt: new Date(),
                summary: `Created via Product Formula: ${fg.name}`,
              },
            });
          }
          rawMaterialId = rm._id;
        }
      }

      if (rawMaterialId) {
        let pct = Number(r.percentage) || 0;
        if (pct <= 0 && totalRawQty > 0) {
          pct = Number(((Number(r.quantity || 0) / totalRawQty) * 100).toFixed(3));
        }
        let qty = Number(r.quantity) || 0;
        if (qty <= 0 && pct > 0) {
          qty = Number(((nominalBatchKg * pct) / 100).toFixed(4));
        }
        if (qty <= 0) qty = 0.001;

        processedRaw.push({
          rawMaterial: rawMaterialId,
          percentage: pct,
          quantity: qty,
          unit: r.unit || 'kg',
          wastagePercent: r.wastagePercent !== undefined ? Number(r.wastagePercent) : 2.0,
        });
      }
    }

    const processedPacking: any[] = [];
    for (const p of (packingMaterials || [])) {
      let packingMaterialId = p.packingMaterial;
      if (packingMaterialId && typeof packingMaterialId === 'object' && packingMaterialId._id) {
        packingMaterialId = packingMaterialId._id;
      }

      if (!packingMaterialId || !mongoose.Types.ObjectId.isValid(String(packingMaterialId))) {
        const pmName = String(p.newMaterialName || p.name || p.packingMaterial || '').trim();
        if (pmName) {
          let pm = await PackingMaterial.findOne({ name: { $regex: new RegExp(`^${pmName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          if (!pm) {
            const count = await PackingMaterial.countDocuments();
            const sku = `PM-PKG-${(count + 1).toString().padStart(3, '0')}`;
            pm = await PackingMaterial.create({
              sku,
              name: pmName,
              category: p.category || 'General',
              unit: p.unit || 'Pcs',
              costPerUnit: Number(p.costPerUnit) || 25,
              minReorderLevel: 500,
              currentStock: 2000,
              supplier: 'General Packaging Supplies',
              storageLocation: 'PM Store',
              isActive: true,
              lastEditedBy: {
                userId: req.user?._id,
                userName: editorName,
                userEmail: req.user?.email || '',
                userRole: req.user?.role || 'admin',
                editedAt: new Date(),
                summary: `Created via Product Formula: ${fg.name}`,
              },
            });
          }
          packingMaterialId = pm._id;
        }
      }

      if (packingMaterialId) {
        let qty = Number(p.quantity) || 0;
        if (qty <= 0) qty = effectiveBatchSize;

        processedPacking.push({
          packingMaterial: packingMaterialId,
          quantity: qty,
          unit: p.unit || 'Pcs',
          wastagePercent: p.wastagePercent !== undefined ? Number(p.wastagePercent) : 1.0,
        });
      }
    }

    // Process stages ingredients if present
    const processedStages: any[] = [];
    if (stages && Array.isArray(stages)) {
      for (const s of stages) {
        const stageIngredients: any[] = [];
        for (const ing of (s.ingredients || [])) {
          let rmId = ing.rawMaterial;
          if (rmId && typeof rmId === 'object' && rmId._id) {
            rmId = rmId._id;
          }
          if (!rmId || !mongoose.Types.ObjectId.isValid(String(rmId))) {
            const ingName = String(ing.rawMaterialName || ing.name || ing.rawMaterial || '').trim();
            if (ingName) {
              let rm = await RawMaterial.findOne({ name: { $regex: new RegExp(`^${ingName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
              if (!rm) {
                const count = await RawMaterial.countDocuments();
                const prefix = fg.division === 'Fadna Tea' ? 'TEA' : 'LS';
                const sku = `RM-${prefix}-${(count + 1).toString().padStart(3, '0')}`;
                rm = await RawMaterial.create({
                  sku,
                  name: ingName,
                  botanicalName: ing.botanicalName || '',
                  category: ing.category || (fg.division === 'Fadna Tea' ? 'Tea' : 'Lifescience'),
                  unit: ing.unit || 'kg',
                  costPerUnit: Number(ing.costPerUnit) || 1200,
                  minReorderLevel: 50,
                  currentStock: 100,
                  supplier: 'Herbal Ingredient Supplier',
                  storageLocation: 'Central RM Stores',
                  isActive: true,
                  lastEditedBy: {
                    userId: req.user?._id,
                    userName: editorName,
                    userEmail: req.user?.email || '',
                    userRole: req.user?.role || 'admin',
                    editedAt: new Date(),
                    summary: `Created via Formula Stage (${s.stageName || 'Sub-Stage'}): ${fg.name}`,
                  },
                });
              }
              rmId = rm._id;
            }
          }
          if (rmId) {
            stageIngredients.push({
              rawMaterial: rmId,
              rawMaterialName: ing.rawMaterialName || '',
              percentage: Number(ing.percentage) || 0,
              quantity: Number(ing.quantity) || 0,
              unit: ing.unit || '%',
              wastagePercent: Number(ing.wastagePercent) || 2.0,
              notes: ing.notes || '',
            });
          }
        }
        processedStages.push({
          ...s,
          ingredients: stageIngredients,
        });
      }
    }

    let bom = await BOM.findOne({ finishedGood: fg._id });
    const isNew = !bom;
    const actionType = isNew ? 'CREATE' : 'UPDATE';

    if (bom) {
      bom.formulaName = formulaName || bom.formulaName || `${fg.name} Formulation`;
      bom.division = division || bom.division || fg.division || 'Fadna Tea';
      bom.blendGramsPerUnit = blendGramsPerUnit !== undefined ? Number(blendGramsPerUnit) : bom.blendGramsPerUnit;
      bom.batchSize = batchSize || bom.batchSize || effectiveBatchSize;
      bom.unit = unit || bom.unit || fg.unit;
      bom.version = version || bom.version;
      bom.rawMaterials = processedRaw.length > 0 ? processedRaw : bom.rawMaterials;
      bom.packingMaterials = processedPacking;
      if (isMultiStage !== undefined) bom.isMultiStage = Boolean(isMultiStage);
      if (stages !== undefined) bom.stages = processedStages;
      bom.notes = notes !== undefined ? notes : bom.notes;
      bom.isActive = true;
      bom.lastEditedBy = {
        userId: req.user?._id,
        userName: editorName,
        userEmail: req.user?.email || '',
        userRole: req.user?.role || 'admin',
        editedAt: new Date(),
        summary: `Updated Product Formula (${bom.formulaName}, Ver: ${bom.version})`,
      };
      await bom.save();
    } else {
      bom = new BOM({
        finishedGood: fg._id,
        formulaName: formulaName || `${fg.name} Formulation`,
        division: division || fg.division || 'Fadna Tea',
        blendGramsPerUnit: blendGramsPerUnit !== undefined ? Number(blendGramsPerUnit) : effectiveGramsPerUnit,
        batchSize: batchSize || effectiveBatchSize,
        unit: unit || fg.unit,
        version: version || 'v1.0',
        rawMaterials: processedRaw,
        packingMaterials: processedPacking,
        isMultiStage: Boolean(isMultiStage),
        stages: processedStages,
        notes: notes || '',
        isActive: true,
        lastEditedBy: {
          userId: req.user?._id,
          userName: editorName,
          userEmail: req.user?.email || '',
          userRole: req.user?.role || 'admin',
          editedAt: new Date(),
          summary: `Created Product Formula for ${fg.name}`,
        },
      });
      await bom.save();
    }

    await AuditService.record({
      user: req.user,
      action: actionType,
      entityType: 'BOM',
      entityId: bom._id.toString(),
      entityName: `BOM: ${fg.name} (${fg.sku})`,
      summary: `${isNew ? 'Created' : 'Updated'} BOM for ${fg.name} (Batch: ${bom.batchSize} ${bom.unit}, Version: ${bom.version})`,
    });

    const populated = await BOM.findById(bom._id)
      .populate('finishedGood')
      .populate('rawMaterials.rawMaterial')
      .populate('packingMaterials.packingMaterial')
      .populate('stages.ingredients.rawMaterial');

    return res.status(200).json({ success: true, message: 'BOM saved successfully', data: populated });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteBOM = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const bom = await BOM.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!bom) return res.status(404).json({ success: false, message: 'BOM not found' });

    await AuditService.record({
      user: req.user,
      action: 'DELETE',
      entityType: 'BOM',
      entityId: bom._id.toString(),
      entityName: `BOM ID: ${bom._id}`,
      summary: 'Deactivated BOM recipe',
    });

    return res.json({ success: true, message: 'BOM deactivated' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
