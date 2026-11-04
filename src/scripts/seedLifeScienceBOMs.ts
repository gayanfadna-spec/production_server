import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FinishedGood } from '../models/FinishedGood.js';
import { RawMaterial } from '../models/RawMaterial.js';
import { PackingMaterial } from '../models/PackingMaterial.js';
import { BOM } from '../models/BOM.js';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fadna_production';

export async function runLifeScienceSeed() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  }
  console.log('[LifeScienceSeed] Connected to MongoDB:', uri);

  // 1. Update/Ensure Finished Goods names match formulation sheets
  const fgUpdates = [
    { sku: 'FG-LS-001', shortCode: 'OR.ACT', name: 'ACTIVE PLUS', category: 'Life Science', unit: 'Bottles / Packs', packSize: '100ml / Pack' },
    { sku: 'FG-LS-003', shortCode: 'VER', name: 'VERNOLAC', category: 'Life Science', unit: 'Packs', packSize: '30 Capsules' },
    { sku: 'FG-LS-005', shortCode: 'ZCR', name: 'ZEITGAIN CREAM', category: 'Life Science', unit: 'Jars / Packs', packSize: '50g Jar' },
    { sku: 'FG-LS-006', shortCode: 'ZCA', name: 'ZEITGAIN CAPSULE', category: 'Life Science', unit: 'Packs', packSize: '60 Capsules' },
    { sku: 'FG-LS-011', shortCode: 'MOI.M', name: 'MOIST CURL MALE', category: 'Life Science', unit: 'Bottles / Packs', packSize: '150ml Bottle' },
    { sku: 'FG-LS-012', shortCode: 'MOI.FE', name: 'MOIST CURL FEMALE', category: 'Life Science', unit: 'Bottles / Packs', packSize: '150ml Bottle' },
  ];

  for (const item of fgUpdates) {
    await FinishedGood.findOneAndUpdate(
      { sku: item.sku },
      {
        $set: {
          name: item.name,
          shortCode: item.shortCode,
          category: item.category,
          unit: item.unit,
          packSize: item.packSize,
          division: 'Fadna Life Science',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`[LifeScienceSeed] Finished Good updated: ${item.sku} -> ${item.name}`);
  }

  // Also ensure Satiny exists as FG-LS-019
  let satinyFG = await FinishedGood.findOne({ sku: 'FG-LS-019' });
  if (!satinyFG) {
    satinyFG = await FinishedGood.create({
      sku: 'FG-LS-019',
      shortCode: 'SAT',
      name: 'SATINY HAIR OIL',
      division: 'Fadna Life Science',
      category: 'Life Science',
      unit: 'Bottles / Packs',
      packSize: '100ml Bottle',
      productionFloorStock: 45,
      finishedStoreStock: 220,
      physicalActualStock: 265,
      costPerUnit: 580,
      sellingPrice: 950,
      minReorderLevel: 80,
      standardBatchSize: 1000,
      description: 'Fadna Satiny Herbal Hair Oil Ayurvedic infusion formula.',
      isActive: true,
    });
    console.log('[LifeScienceSeed] Created Finished Good FG-LS-019 (SATINY HAIR OIL)');
  } else {
    satinyFG.name = 'SATINY HAIR OIL';
    satinyFG.shortCode = 'SAT';
    satinyFG.division = 'Fadna Life Science';
    await satinyFG.save();
    console.log('[LifeScienceSeed] Updated Satiny FG-LS-019');
  }

  // Fetch all finished goods needed
  const fgActivePlus = await FinishedGood.findOne({ sku: 'FG-LS-001' });
  const fgVernolac = await FinishedGood.findOne({ sku: 'FG-LS-003' });
  const fgZeitgainCream = await FinishedGood.findOne({ sku: 'FG-LS-005' });
  const fgZeitgainCapsule = await FinishedGood.findOne({ sku: 'FG-LS-006' });
  const fgMoistCurlMale = await FinishedGood.findOne({ sku: 'FG-LS-011' });
  const fgMoistCurlFemale = await FinishedGood.findOne({ sku: 'FG-LS-012' });

  // 2. Define and Upsert All Raw Materials from Formulations
  const rawMaterialDefs = [
    // Water & Bases
    { sku: 'RM-RO-001', name: 'RO Water (Reverse Osmosis Purified)', category: 'Lifescience', unit: 'kg', cost: 15, supplier: 'Central Water Purification Plant', loc: 'Liquid Bay 1' },
    { sku: 'RM-AQU-001', name: 'Aqua (Deionized Purified Water)', category: 'Lifescience', unit: 'kg', cost: 18, supplier: 'Central Water Purification Plant', loc: 'Liquid Bay 1' },
    { sku: 'RM-VCO-001', name: 'Virgin Coconut Oil (VCO)', category: 'Lifescience', unit: 'kg', cost: 850, supplier: 'Coconut Cultivation Board Mills', loc: 'Oils Warehouse Section A' },
    { sku: 'RM-RBD-001', name: 'RBD Oil (Refined Bleached Deodorized)', category: 'Lifescience', unit: 'kg', cost: 620, supplier: 'Southern Oils Refinery', loc: 'Oils Warehouse Section A' },
    { sku: 'RM-MEE-001', name: 'Mee Oil (Madhuca longifolia Seed Oil)', category: 'Lifescience', unit: 'kg', cost: 1450, supplier: 'Uva Herbal Collectors Co-op', loc: 'Oils Warehouse Section B' },

    // Polymers, Emulsifiers, Thickeners
    { sku: 'RM-CAR-001', name: 'Carbomer U21', category: 'Lifescience', unit: 'kg', cost: 4200, supplier: 'Lubrizol Specialty Chemicals', loc: 'Chemical Stores Rack 1' },
    { sku: 'RM-CBP-001', name: 'Carbopol U21 Polymer', category: 'Lifescience', unit: 'kg', cost: 4300, supplier: 'Lubrizol Specialty Chemicals', loc: 'Chemical Stores Rack 1' },
    { sku: 'RM-ULT-001', name: 'Ultrez 21 Polymer', category: 'Lifescience', unit: 'kg', cost: 4400, supplier: 'Lubrizol Specialty Chemicals', loc: 'Chemical Stores Rack 1' },
    { sku: 'RM-PVP-001', name: 'PVP (Polyvinylpyrrolidone)', category: 'Lifescience', unit: 'kg', cost: 3800, supplier: 'BASF Lanka Chemicals', loc: 'Chemical Stores Rack 2' },
    { sku: 'RM-GMS-040', name: 'GMS 40 (Glycerol Monostearate 40)', category: 'Lifescience', unit: 'kg', cost: 950, supplier: 'Croda International', loc: 'Chemical Stores Rack 2' },
    { sku: 'RM-GMS-001', name: 'GMS (Glycerol Monostearate)', category: 'Lifescience', unit: 'kg', cost: 920, supplier: 'Croda International', loc: 'Chemical Stores Rack 2' },
    { sku: 'RM-EGM-001', name: 'EGMS (Ethylene Glycol Monostearate)', category: 'Lifescience', unit: 'kg', cost: 1100, supplier: 'Croda International', loc: 'Chemical Stores Rack 2' },
    { sku: 'RM-CET-001', name: 'Cetyl Alcohol Flakes', category: 'Lifescience', unit: 'kg', cost: 890, supplier: 'Kao Chemicals Global', loc: 'Chemical Stores Rack 3' },
    { sku: 'RM-STE-001', name: 'Stearic Acid Triple Pressed', category: 'Lifescience', unit: 'kg', cost: 780, supplier: 'Oleon Bio-Chemicals', loc: 'Chemical Stores Rack 3' },
    { sku: 'RM-POL-020', name: 'Polysorbate 20 (Tween 20)', category: 'Lifescience', unit: 'kg', cost: 1250, supplier: 'Croda Specialty Chem', loc: 'Chemical Stores Rack 4' },

    // Actives, Extracts & Cosmeceuticals
    { sku: 'RM-KER-001', name: 'Hydrolyzed Keratin Protein', category: 'Lifescience', unit: 'kg', cost: 6500, supplier: 'Cosmetic Bioactive Solutions', loc: 'Active Storage Room A' },
    { sku: 'RM-ALO-001', name: 'Aloe Vera Extract Liquid', category: 'Lifescience', unit: 'kg', cost: 1200, supplier: 'Lanka Bio-Botanicals', loc: 'Active Storage Room A' },
    { sku: 'RM-ALG-001', name: 'Aloe Vera Gel 100:1 Pure', category: 'Lifescience', unit: 'kg', cost: 1350, supplier: 'Lanka Bio-Botanicals', loc: 'Active Storage Room A' },
    { sku: 'RM-GLY-001', name: 'Glycerin 99.7% USP Grade', category: 'Lifescience', unit: 'kg', cost: 480, supplier: 'P&G Oleochemicals', loc: 'Liquid Bay 2' },
    { sku: 'RM-ONI-001', name: 'Onion Peel Extract Bioactive', category: 'Lifescience', unit: 'kg', cost: 5800, supplier: 'Herbal Extracts Ltd', loc: 'Active Storage Room B' },
    { sku: 'RM-SIL-001', name: 'Silicon Oil (Dimethicone 350cSt)', category: 'Lifescience', unit: 'kg', cost: 1650, supplier: 'Dow Silicones', loc: 'Chemical Stores Rack 4' },
    { sku: 'RM-VTE-001', name: 'Vitamin E (Tocopheryl Acetate 98%)', category: 'Lifescience', unit: 'kg', cost: 4200, supplier: 'DSM Nutritional Products', loc: 'Active Storage Room B' },
    { sku: 'RM-VTC-001', name: 'Vitamin C (Ascorbic Acid USP)', category: 'Lifescience', unit: 'kg', cost: 2400, supplier: 'DSM Nutritional Products', loc: 'Active Storage Room B' },
    { sku: 'RM-NIA-001', name: 'Niacinamide (Vitamin B3 USP)', category: 'Lifescience', unit: 'kg', cost: 3600, supplier: 'Lonza Lifescience', loc: 'Active Storage Room B' },
    { sku: 'RM-HYA-001', name: 'Hyaluronic Acid Powder', category: 'Lifescience', unit: 'kg', cost: 28000, supplier: 'Bloomage Biotech', loc: 'High Value Vault 1' },
    { sku: 'RM-POM-001', name: 'Pomegranate Fruit Extract 40% Ellagic', category: 'Lifescience', unit: 'kg', cost: 7200, supplier: 'Arjuna Natural Extracts', loc: 'Active Storage Room C' },
    { sku: 'RM-KOK-001', name: 'Kokum Butter Extract', category: 'Lifescience', unit: 'kg', cost: 3400, supplier: 'Indo-Ceylon Naturals', loc: 'Active Storage Room C' },
    { sku: 'RM-CUC-001', name: 'Cucumber Seed Oil Cold Pressed', category: 'Lifescience', unit: 'kg', cost: 3100, supplier: 'Aroma Botanics Lanka', loc: 'Oils Warehouse Section B' },
    { sku: 'RM-ZNC-001', name: 'Zinc PCA (Zinc L-Pyrrolidone Carboxylate)', category: 'Lifescience', unit: 'kg', cost: 11500, supplier: 'Ajinomoto Bio-Pharma', loc: 'Active Storage Room C' },

    // Preservatives, Solvents & Neutralizers
    { sku: 'RM-PHE-001', name: 'Phenoxyethanol USP (Phenoxy EtOH)', category: 'Lifescience', unit: 'kg', cost: 1450, supplier: 'Clariant Chemicals', loc: 'Preservative Stores Rack 1' },
    { sku: 'RM-MPB-001', name: 'Methyl Paraben Sodium USP', category: 'Lifescience', unit: 'kg', cost: 1850, supplier: 'Nipa Labs', loc: 'Preservative Stores Rack 1' },
    { sku: 'RM-PPB-001', name: 'Propyl Paraben Sodium USP', category: 'Lifescience', unit: 'kg', cost: 2100, supplier: 'Nipa Labs', loc: 'Preservative Stores Rack 1' },
    { sku: 'RM-MET-001', name: 'Methanol Analytical Grade', category: 'Lifescience', unit: 'kg', cost: 320, supplier: 'Ceylon Petrochemicals', loc: 'Flammable Solvents Store' },
    { sku: 'RM-TEA-AMN', name: 'Triethanolamine 99% (TEA Neutralizer)', category: 'Lifescience', unit: 'kg', cost: 1650, supplier: 'Dow Chemical', loc: 'Chemical Stores Rack 5' },

    // Fragrances & Essential Oils
    { sku: 'RM-PRF-203', name: 'Perfume Compound (203 Male Fragrance)', category: 'Lifescience', unit: 'kg', cost: 4800, supplier: 'Givaudan Lanka', loc: 'Fragrance Vault Rack 1' },
    { sku: 'RM-PRF-ORG', name: 'Perfume Orange Fresh Compound', category: 'Lifescience', unit: 'kg', cost: 4600, supplier: 'Firmenich Aromas', loc: 'Fragrance Vault Rack 1' },
    { sku: 'RM-PRF-CRM', name: 'Perfume Delicate Cream Fragrance', category: 'Lifescience', unit: 'kg', cost: 4900, supplier: 'Givaudan Lanka', loc: 'Fragrance Vault Rack 2' },
    { sku: 'RM-ORG-OIL', name: 'Orange Essential Oil (Cold Pressed Citrus)', category: 'Lifescience', unit: 'kg', cost: 3800, supplier: 'Southern Aroma Distillers', loc: 'Fragrance Vault Rack 2' },
    { sku: 'RM-LMG-001', name: 'Lemongrass Essential Oil (Cymbopogon)', category: 'Lifescience', unit: 'kg', cost: 4200, supplier: 'Matale Herbal Distilleries', loc: 'Fragrance Vault Rack 3' },
    { sku: 'RM-PEP-001', name: 'Peppermint Essential Oil (Mentha piperita)', category: 'Lifescience', unit: 'kg', cost: 5600, supplier: 'Highland Spices & Extracts', loc: 'Fragrance Vault Rack 3' },
    { sku: 'RM-WNT-001', name: 'Wintergreen Oil (Natural Methyl Salicylate)', category: 'Lifescience', unit: 'kg', cost: 3900, supplier: 'Eastern Essential Oils Ltd', loc: 'Fragrance Vault Rack 3' },
    { sku: 'RM-CAP-001', name: 'Capsicum Oleoresin 10% Capsaicin', category: 'Lifescience', unit: 'kg', cost: 7800, supplier: 'Kandy Spice Extracts', loc: 'Fragrance Vault Rack 4' },

    // Nutraceuticals & Zeitgain Capsule Materials
    { sku: 'RM-VTP-001', name: 'Vitamin Premix Fortification Blend', category: 'Lifescience', unit: 'kg', cost: 6800, supplier: 'DSM Nutritional Products', loc: 'Nutra Stores Bay 1' },
    { sku: 'RM-BTP-001', name: 'Black Tea Microfine Powder', category: 'Tea', unit: 'kg', cost: 1800, supplier: 'Bogawantalawa Tea Processing', loc: 'Tea RM Bay A' },
    { sku: 'RM-COL-001', name: 'Marine Collagen Peptides (Hydrolyzed)', category: 'Lifescience', unit: 'kg', cost: 9500, supplier: 'Nitta Gelatin India', loc: 'Nutra Stores Bay 2' },
    { sku: 'RM-TCP-001', name: 'TCP (Tricalcium Phosphate Food Grade)', category: 'Lifescience', unit: 'kg', cost: 850, supplier: 'Prayon Phosphates', loc: 'Chemical Stores Rack 5' },
    { sku: 'RM-GRP-001', name: 'Grape Seed Extract 95% Proanthocyanidins', category: 'Lifescience', unit: 'kg', cost: 8900, supplier: 'Indena Bioactive Extracts', loc: 'Nutra Stores Bay 2' },
    { sku: 'RM-EXT-ZTG', name: 'Zeitgain Herbal Extract Intermediate', category: 'Lifescience', unit: 'kg', cost: 4500, supplier: 'Internal Ayurvedic Extraction Lab', loc: 'Intermediate Extracts Bay' },
    { sku: 'RM-HEE-001', name: 'Heenbovitiya Leaf / Herb Cut', category: 'Lifescience', unit: 'kg', cost: 2400, supplier: 'Dambulla Ayurvedic Herbal Harvesters', loc: 'Raw Herbal Bay 1' },
    { sku: 'RM-RAS-001', name: 'Rasakinda Dried Stem Cut (Tinospora)', category: 'Lifescience', unit: 'kg', cost: 1950, supplier: 'Sabaragamuwa Herbal Growers', loc: 'Raw Herbal Bay 1' },
    { sku: 'RM-BLS-001', name: 'Blackseed Whole (Nigella sativa)', category: 'Lifescience', unit: 'kg', cost: 2800, supplier: 'North-Western Spice Network', loc: 'Raw Herbal Bay 2' },
    { sku: 'RM-CUR-001', name: 'Curry Leaves Dehydrated Cut', category: 'Lifescience', unit: 'kg', cost: 1400, supplier: 'Kurunegala Organic Agro', loc: 'Raw Herbal Bay 2' },

    // Satiny Extraction Materials
    { sku: 'RM-NIL-001', name: 'Nilawariya Dried Herb Cut', category: 'Lifescience', unit: 'kg', cost: 1650, supplier: 'Anuradhapura Ayurvedic Herbal Supply', loc: 'Raw Herbal Bay 3' },
    { sku: 'RM-KIK-001', name: 'Kikiridiya Herb Cut (Eclipta alba)', category: 'Lifescience', unit: 'kg', cost: 1850, supplier: 'Dambulla Herbal Harvesters', loc: 'Raw Herbal Bay 3' },
    { sku: 'RM-NEL-001', name: 'Nelli Dried Fruit Cut (Phyllanthus emblica)', category: 'Lifescience', unit: 'kg', cost: 1750, supplier: 'Monaragala Forest Harvesters', loc: 'Raw Herbal Bay 3' },
    { sku: 'RM-MUK-001', name: 'Mukunuwenna Dehydrated Herb Cut', category: 'Lifescience', unit: 'kg', cost: 1350, supplier: 'Gampaha Agro Collectives', loc: 'Raw Herbal Bay 4' },
    { sku: 'RM-GOT-001', name: 'Gotukola Dried Herb Cut (Centella asiatica)', category: 'Lifescience', unit: 'kg', cost: 2100, supplier: 'Gampaha Agro Collectives', loc: 'Raw Herbal Bay 4' },
    { sku: 'RM-DCO-001', name: 'Desiccated Coconut Oil / Shred Cut', category: 'Lifescience', unit: 'kg', cost: 720, supplier: 'Coconut Board Lanka', loc: 'Raw Herbal Bay 4' },
    { sku: 'RM-EXT-SAT', name: 'Satiny Botanical Extract Concentrated', category: 'Lifescience', unit: 'kg', cost: 6500, supplier: 'Internal Ayurvedic Extraction Lab', loc: 'Intermediate Extracts Bay' },

    // Vernolac TBC & Powders
    { sku: 'RM-PUP-TBC', name: 'Pupula TBC (Tea Bag Cut Herb)', category: 'Lifescience', unit: 'kg', cost: 2200, supplier: 'Kandy Forest Collectors', loc: 'TBC Cut Bay 1' },
    { sku: 'RM-KAL-TBC', name: 'Kaluduru TBC (Black Cumin Cut)', category: 'Lifescience', unit: 'kg', cost: 2600, supplier: 'North-Western Spice Network', loc: 'TBC Cut Bay 1' },
    { sku: 'RM-GET-TBC', name: 'Getathathumba TBC (Leucas zeylanica Cut)', category: 'Lifescience', unit: 'kg', cost: 2400, supplier: 'Matale Agro Supplies', loc: 'TBC Cut Bay 2' },
    { sku: 'RM-IRA-TBC', name: 'Iramusu TBC (Hemidesmus Root Cut)', category: 'Lifescience', unit: 'kg', cost: 2300, supplier: 'Sabaragamuwa Ayurvedic Supply', loc: 'TBC Cut Bay 2' },
    { sku: 'RM-PUP-PWD', name: 'Pupula Fine Botanical Powder', category: 'Lifescience', unit: 'kg', cost: 2600, supplier: 'Internal Milling Plant', loc: 'Milled Powders Bay 1' },
    { sku: 'RM-GET-PWD', name: 'Getathubma Fine Botanical Powder', category: 'Lifescience', unit: 'kg', cost: 2800, supplier: 'Internal Milling Plant', loc: 'Milled Powders Bay 1' },
    { sku: 'RM-KAL-PWD', name: 'Kaluduru Fine Botanical Powder', category: 'Lifescience', unit: 'kg', cost: 2900, supplier: 'Internal Milling Plant', loc: 'Milled Powders Bay 2' },
    { sku: 'RM-IRA-PWD', name: 'Iramusu Root Fine Powder', category: 'Lifescience', unit: 'kg', cost: 2700, supplier: 'Internal Milling Plant', loc: 'Milled Powders Bay 2' },
    { sku: 'RM-EXT-VER', name: 'Vernolac Concentrated Herbal Extract', category: 'Lifescience', unit: 'kg', cost: 5800, supplier: 'Internal Ayurvedic Extraction Lab', loc: 'Intermediate Extracts Bay' },
  ];

  const rmMap = new Map<string, any>();
  for (const def of rawMaterialDefs) {
    const existing = await RawMaterial.findOneAndUpdate(
      { sku: def.sku },
      {
        $set: {
          name: def.name,
          category: def.category,
          unit: def.unit,
          costPerUnit: def.cost,
          supplier: def.supplier,
          storageLocation: def.loc,
          currentStock: 250,
          minReorderLevel: 50,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    rmMap.set(def.sku, existing);
  }
  console.log(`[LifeScienceSeed] Upserted ${rmMap.size} raw materials.`);

  // 3. Ensure Default Packing Materials for Life Science
  let pmBottle = await PackingMaterial.findOne({ sku: 'PM-BOT-100' });
  if (!pmBottle) {
    pmBottle = await PackingMaterial.create({
      sku: 'PM-BOT-100',
      name: 'Cosmetic Amber HDPE Bottle 100/150ml with Pump Dispenser',
      category: 'Bottles',
      unit: 'Pcs',
      currentStock: 8000,
      minReorderLevel: 1500,
      costPerUnit: 42,
      supplier: 'PlastiPack Lanka PLC',
      storageLocation: 'PM Store Racks Section 3',
      isActive: true,
    });
  }

  let pmJar = await PackingMaterial.findOne({ sku: 'PM-JAR-050' });
  if (!pmJar) {
    pmJar = await PackingMaterial.create({
      sku: 'PM-JAR-050',
      name: 'Cosmetic Double-Wall Acrylic Jar 50g with Inner Lid',
      category: 'Jars',
      unit: 'Pcs',
      currentStock: 6500,
      minReorderLevel: 1200,
      costPerUnit: 58,
      supplier: 'Print & Pack Lanka Ltd',
      storageLocation: 'PM Store Racks Section 3',
      isActive: true,
    });
  }

  let pmCapsuleBlister = await PackingMaterial.findOne({ sku: 'PM-BLI-060' });
  if (!pmCapsuleBlister) {
    pmCapsuleBlister = await PackingMaterial.create({
      sku: 'PM-BLI-060',
      name: 'Alu-Alu Cold Form Blister Strip & Monocarton (60s)',
      category: 'Blisters',
      unit: 'Pcs',
      currentStock: 12000,
      minReorderLevel: 2500,
      costPerUnit: 35,
      supplier: 'Flexible Packaging Lanka',
      storageLocation: 'PM Store Racks Section 4',
      isActive: true,
    });
  }

  // 4. Create the 7 Product BOMs

  // Helper to get RM ObjectId
  const getRM = (sku: string) => {
    const rm = rmMap.get(sku);
    if (!rm) throw new Error(`Raw material sku ${sku} not found`);
    return rm._id;
  };

  // Helper to get PM ObjectId
  const pmDefaultBottle = pmBottle._id;
  const pmDefaultJar = pmJar._id;
  const pmDefaultBlister = pmCapsuleBlister._id;

  // --- FORMULA 1: MOIST CURL MALE (MOI.M) ---
  if (fgMoistCurlMale) {
    const maleRawItems = [
      { rawMaterial: getRM('RM-RO-001'), percentage: 47.842, quantity: 4.7842, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-KER-001'), percentage: 0.5, quantity: 0.05, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-CAR-001'), percentage: 0.008, quantity: 0.0008, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-PVP-001'), percentage: 0.2, quantity: 0.02, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-ALO-001'), percentage: 8.0, quantity: 0.8, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-GLY-001'), percentage: 10.0, quantity: 1.0, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-RBD-001'), percentage: 18.0, quantity: 1.8, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-GMS-040'), percentage: 2.0, quantity: 0.2, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-CET-001'), percentage: 3.82, quantity: 0.382, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-ONI-001'), percentage: 0.02, quantity: 0.002, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-SIL-001'), percentage: 7.0, quantity: 0.7, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-VTE-001'), percentage: 1.0, quantity: 0.1, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-PRF-203'), percentage: 0.3, quantity: 0.03, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-POL-020'), percentage: 0.33, quantity: 0.033, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-PHE-001'), percentage: 1.0, quantity: 0.1, unit: 'kg', wastagePercent: 1.5 },
    ];

    await BOM.findOneAndUpdate(
      { finishedGood: fgMoistCurlMale._id },
      {
        $set: {
          formulaName: 'Moist Curl Male Hair Styling & Nourishing Formula',
          division: 'Fadna Life Science',
          blendGramsPerUnit: 100, // 100g / 100ml net
          batchSize: 100,
          unit: 'Bottles / Packs',
          version: 'v1.0',
          isMultiStage: false,
          rawMaterials: maleRawItems,
          packingMaterials: [{ packingMaterial: pmDefaultBottle, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 }],
          notes: 'Moist Curl Male official formulation with Perfume 203 male fragrance.',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log('[LifeScienceSeed] BOM created: MOIST CURL MALE');
  }

  // --- FORMULA 2: MOIST CURL FEMALE (MOI.FE) ---
  if (fgMoistCurlFemale) {
    const femaleRawItems = [
      { rawMaterial: getRM('RM-RO-001'), percentage: 47.842, quantity: 4.7842, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-KER-001'), percentage: 0.5, quantity: 0.05, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-CAR-001'), percentage: 0.008, quantity: 0.0008, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-PVP-001'), percentage: 0.2, quantity: 0.02, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-ALO-001'), percentage: 8.0, quantity: 0.8, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-GLY-001'), percentage: 10.0, quantity: 1.0, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-RBD-001'), percentage: 18.0, quantity: 1.8, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-GMS-040'), percentage: 2.0, quantity: 0.2, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-CET-001'), percentage: 3.82, quantity: 0.382, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-ONI-001'), percentage: 0.02, quantity: 0.002, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-SIL-001'), percentage: 7.0, quantity: 0.7, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-VTE-001'), percentage: 1.0, quantity: 0.1, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-PRF-ORG'), percentage: 0.3, quantity: 0.03, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-POL-020'), percentage: 0.33, quantity: 0.033, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-PHE-001'), percentage: 1.0, quantity: 0.1, unit: 'kg', wastagePercent: 1.5 },
    ];

    await BOM.findOneAndUpdate(
      { finishedGood: fgMoistCurlFemale._id },
      {
        $set: {
          formulaName: 'Moist Curl Female Hair Care & Defining Formula',
          division: 'Fadna Life Science',
          blendGramsPerUnit: 100,
          batchSize: 100,
          unit: 'Bottles / Packs',
          version: 'v1.0',
          isMultiStage: false,
          rawMaterials: femaleRawItems,
          packingMaterials: [{ packingMaterial: pmDefaultBottle, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 }],
          notes: 'Moist Curl Female official formulation with Perfume Orange citrus fragrance.',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log('[LifeScienceSeed] BOM created: MOIST CURL FEMALE');
  }

  // --- FORMULA 3: ZEITGAIN CAPSULE (ZCA) - MULTI-STAGE ---
  if (fgZeitgainCapsule) {
    const zcaStages = [
      {
        stageNumber: 1,
        stageName: 'Herbal Extract Stage',
        stageType: 'extraction' as const,
        outputItemName: 'Zeitgain Herbal Extract (2% in Main Blend)',
        outputContributionPercent: 2.0,
        outputQuantity: 0.08,
        outputUnit: 'kg',
        ingredients: [
          { rawMaterial: getRM('RM-HEE-001'), rawMaterialName: 'Heenbovitiya Leaf Cut', percentage: 30, quantity: 0.024, unit: 'kg', wastagePercent: 2.0, notes: 'Liver & cellular detox bioactive' },
          { rawMaterial: getRM('RM-RAS-001'), rawMaterialName: 'Rasakinda Stem Cut', percentage: 30, quantity: 0.024, unit: 'kg', wastagePercent: 2.0, notes: 'Immuno-modulator botanical' },
          { rawMaterial: getRM('RM-BLS-001'), rawMaterialName: 'Blackseed Whole', percentage: 10, quantity: 0.008, unit: 'kg', wastagePercent: 2.0, notes: 'Nigella sativa thymoquinone extract' },
          { rawMaterial: getRM('RM-CUR-001'), rawMaterialName: 'Curry Leaves Cut', percentage: 30, quantity: 0.024, unit: 'kg', wastagePercent: 2.0, notes: 'Murraya koenigii antioxidant fraction' },
        ],
        instructions: 'Hydro-alcoholic extraction and concentration of 4 botanical herbs. Yield is formulated as 2% input into master capsule blend.',
      },
    ];

    const zcaRawItems = [
      { rawMaterial: getRM('RM-VTP-001'), percentage: 55.0, quantity: 2.2, unit: 'kg', wastagePercent: 1.0 },
      { rawMaterial: getRM('RM-GRP-001'), percentage: 28.0, quantity: 1.12, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-BTP-001'), percentage: 10.0, quantity: 0.4, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-COL-001'), percentage: 3.5, quantity: 0.14, unit: 'kg', wastagePercent: 1.0 },
      { rawMaterial: getRM('RM-TCP-001'), percentage: 1.5, quantity: 0.06, unit: 'kg', wastagePercent: 1.0 },
      { rawMaterial: getRM('RM-EXT-ZTG'), percentage: 2.0, quantity: 0.08, unit: 'kg', wastagePercent: 1.5 },
    ];

    await BOM.findOneAndUpdate(
      { finishedGood: fgZeitgainCapsule._id },
      {
        $set: {
          formulaName: 'Zeitgain Nutraceutical Anti-Aging Capsule Formula',
          division: 'Fadna Life Science',
          blendGramsPerUnit: 40,
          batchSize: 100,
          unit: 'Packs',
          version: 'v2.0',
          isMultiStage: true,
          stages: zcaStages,
          rawMaterials: zcaRawItems,
          packingMaterials: [{ packingMaterial: pmDefaultBlister, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 }],
          notes: 'Two-stage formulation: Stage 1 Herbal Extract (Heenbovitiya, Rasakinda, Blackseed, Curry leaves) contributing 2% to Stage 2 Master Blend.',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log('[LifeScienceSeed] BOM created: ZEITGAIN CAPSULE (Multi-Stage)');
  }

  // --- FORMULA 4: ZEITGAIN CREAM (ZCR) ---
  if (fgZeitgainCream) {
    const zcrRawItems = [
      { rawMaterial: getRM('RM-AQU-001'), percentage: 63.0, quantity: 6.3, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-VCO-001'), percentage: 6.5, quantity: 0.65, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-NIA-001'), percentage: 6.0, quantity: 0.6, unit: 'kg', wastagePercent: 1.0 },
      { rawMaterial: getRM('RM-GLY-001'), percentage: 5.0, quantity: 0.5, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-ALG-001'), percentage: 3.9, quantity: 0.39, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-GMS-001'), percentage: 2.25, quantity: 0.225, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-CET-001'), percentage: 2.25, quantity: 0.225, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-EGM-001'), percentage: 1.5, quantity: 0.15, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-HYA-001'), percentage: 1.0, quantity: 0.1, unit: 'kg', wastagePercent: 1.0 },
      { rawMaterial: getRM('RM-PHE-001'), percentage: 1.0, quantity: 0.1, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-VTC-001'), percentage: 1.0, quantity: 0.1, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-CUC-001'), percentage: 1.0, quantity: 0.1, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-STE-001'), percentage: 1.0, quantity: 0.1, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-VTE-001'), percentage: 1.0, quantity: 0.1, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-KOK-001'), percentage: 0.5, quantity: 0.05, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-CBP-001'), percentage: 0.35, quantity: 0.035, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-PRF-CRM'), percentage: 0.3, quantity: 0.03, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-ZNC-001'), percentage: 0.2, quantity: 0.02, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-POM-001'), percentage: 0.15, quantity: 0.015, unit: 'kg', wastagePercent: 2.0 },
    ];

    await BOM.findOneAndUpdate(
      { finishedGood: fgZeitgainCream._id },
      {
        $set: {
          formulaName: 'Zeitgain Premium Skin Rejuvenating Cream Formula',
          division: 'Fadna Life Science',
          blendGramsPerUnit: 50,
          batchSize: 100,
          unit: 'Jars / Packs',
          version: 'v1.0',
          isMultiStage: false,
          rawMaterials: zcrRawItems,
          packingMaterials: [{ packingMaterial: pmDefaultJar, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 }],
          notes: 'Zeitgain Cream with Niacinamide, Hyaluronic acid, Kokum, Vitamin C & E, and Zinc PCA.',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log('[LifeScienceSeed] BOM created: ZEITGAIN CREAM');
  }

  // --- FORMULA 5: SATINY (SAT) - MULTI-STAGE ---
  if (satinyFG) {
    const satinyStages = [
      {
        stageNumber: 1,
        stageName: 'Botanical Herb Extraction Phase',
        stageType: 'extraction' as const,
        outputItemName: 'Satiny Herbal Extract Intermediate',
        outputContributionPercent: 0.65,
        outputQuantity: 0.90317881,
        outputUnit: 'kg',
        ingredients: [
          { rawMaterial: getRM('RM-NIL-001'), rawMaterialName: 'Nilawariya Dried Herb Cut', percentage: 24.39, quantity: 0.2203, unit: 'kg', wastagePercent: 2.0, notes: 'Hair growth promoter' },
          { rawMaterial: getRM('RM-KIK-001'), rawMaterialName: 'Kikiridiya Herb Cut (Eclipta)', percentage: 24.39, quantity: 0.2203, unit: 'kg', wastagePercent: 2.0, notes: 'Bhringraj scalp rejuvenator' },
          { rawMaterial: getRM('RM-NEL-001'), rawMaterialName: 'Nelli Dried Fruit Cut (Amla)', percentage: 24.39, quantity: 0.2203, unit: 'kg', wastagePercent: 2.0, notes: 'Rich natural Vitamin C source' },
          { rawMaterial: getRM('RM-MUK-001'), rawMaterialName: 'Mukunuwenna Dehydrated Herb Cut', percentage: 19.51, quantity: 0.1762, unit: 'kg', wastagePercent: 2.0, notes: 'Cooling herbal nutrient' },
          { rawMaterial: getRM('RM-GOT-001'), rawMaterialName: 'Gotukola Dried Herb Cut', percentage: 4.88, quantity: 0.0441, unit: 'kg', wastagePercent: 2.0, notes: 'Microcirculation enhancer' },
          { rawMaterial: getRM('RM-DCO-001'), rawMaterialName: 'Desiccated Coconut Oil / Cut', percentage: 2.44, quantity: 0.0220, unit: 'kg', wastagePercent: 2.0, notes: 'Extraction lipid medium' },
        ],
        instructions: 'Slow Ayurvedic decoction extraction of 6 traditional botanicals. Yield: 0.90317881 kg concentrated active extract for 136.38 kg VCO master batch.',
      },
    ];

    const satinyRawItems = [
      { rawMaterial: getRM('RM-VCO-001'), percentage: 98.4, quantity: 136.38, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-EXT-SAT'), percentage: 0.65, quantity: 0.90317881, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-VTE-001'), percentage: 0.25, quantity: 0.35, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-PRF-ORG'), percentage: 0.35, quantity: 0.45, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-ORG-OIL'), percentage: 0.35, quantity: 0.48, unit: 'kg', wastagePercent: 1.5 },
    ];

    await BOM.findOneAndUpdate(
      { finishedGood: satinyFG._id },
      {
        $set: {
          formulaName: 'Satiny Ayurvedic Botanical Hair Oil Formulation',
          division: 'Fadna Life Science',
          blendGramsPerUnit: 100, // 100ml / ~92g per bottle
          batchSize: 1500, // Large 138kg batch produces ~1,500 bottles
          unit: 'Bottles / Packs',
          version: 'v2.0',
          isMultiStage: true,
          stages: satinyStages,
          rawMaterials: satinyRawItems,
          packingMaterials: [{ packingMaterial: pmDefaultBottle, quantity: 1500, unit: 'Pcs', wastagePercent: 1.0 }],
          notes: 'Master batch formulation for Satiny Hair Oil: 136.38 kg Virgin Coconut Oil infused with 0.90317881 kg Botanical Extract plus Vitamin E, perfume, and orange essential oil.',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log('[LifeScienceSeed] BOM created: SATINY HAIR OIL (Multi-Stage)');
  }

  // --- FORMULA 6: VERNOLAC (VER) - MULTI-STAGE ---
  if (fgVernolac) {
    const vernolacStages = [
      {
        stageNumber: 1,
        stageName: 'TBC Cut Botanical Extraction Phase',
        stageType: 'extraction' as const,
        outputItemName: 'Vernolac Concentrated Botanical Extract (28.626%)',
        outputContributionPercent: 28.626,
        outputQuantity: 1.145,
        outputUnit: 'kg',
        ingredients: [
          { rawMaterial: getRM('RM-PUP-TBC'), rawMaterialName: 'Pupula TBC Cut', percentage: 50.0, quantity: 0.5725, unit: 'kg', wastagePercent: 2.0, notes: 'Vernonia zeylanica coarse cut' },
          { rawMaterial: getRM('RM-GET-TBC'), rawMaterialName: 'Getathathumba TBC Cut', percentage: 25.0, quantity: 0.2863, unit: 'kg', wastagePercent: 2.0, notes: 'Leucas zeylanica coarse cut' },
          { rawMaterial: getRM('RM-KAL-TBC'), rawMaterialName: 'Kaluduru TBC Cut', percentage: 23.0, quantity: 0.2634, unit: 'kg', wastagePercent: 2.0, notes: 'Nigella sativa seeds cut' },
          { rawMaterial: getRM('RM-IRA-TBC'), rawMaterialName: 'Iramusu TBC Cut', percentage: 2.0, quantity: 0.0229, unit: 'kg', wastagePercent: 2.0, notes: 'Hemidesmus indicus root cut' },
        ],
        instructions: 'Botanical TBC extraction yielding purified bioactive extract which supplies 28.626% by mass into the master powder blend.',
      },
    ];

    const vernolacRawItems = [
      { rawMaterial: getRM('RM-PUP-PWD'), percentage: 35.82, quantity: 1.4328, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-EXT-VER'), percentage: 28.626, quantity: 1.145, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-GET-PWD'), percentage: 17.91, quantity: 0.7164, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-KAL-PWD'), percentage: 17.19, quantity: 0.6876, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-IRA-PWD'), percentage: 0.44, quantity: 0.0176, unit: 'kg', wastagePercent: 1.5 },
    ];

    await BOM.findOneAndUpdate(
      { finishedGood: fgVernolac._id },
      {
        $set: {
          formulaName: 'Vernolac Ayurvedic Botanical Extract Formula',
          division: 'Fadna Life Science',
          blendGramsPerUnit: 40,
          batchSize: 100,
          unit: 'Packs',
          version: 'v2.0',
          isMultiStage: true,
          stages: vernolacStages,
          rawMaterials: vernolacRawItems,
          packingMaterials: [{ packingMaterial: pmDefaultBlister, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 }],
          notes: 'Two-stage Vernolac formulation: Stage 1 produces 28.626% TBC Extract from Pupula, Getathathumba, Kaluduru, and Iramusu. Stage 2 combines extract with microfine powders.',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log('[LifeScienceSeed] BOM created: VERNOLAC (Multi-Stage)');
  }

  // --- FORMULA 7: ACTIVE PLUS (OR.ACT) ---
  if (fgActivePlus) {
    const activePlusRawItems = [
      { rawMaterial: getRM('RM-AQU-001'), percentage: 61.851, quantity: 6.1851, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-WNT-001'), percentage: 13.404, quantity: 1.3404, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-MEE-001'), percentage: 5.3, quantity: 0.53, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-VCO-001'), percentage: 5.3, quantity: 0.53, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-MET-001'), percentage: 4.0, quantity: 0.4, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-LMG-001'), percentage: 3.0, quantity: 0.3, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-PEP-001'), percentage: 2.22, quantity: 0.222, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-GMS-001'), percentage: 2.0, quantity: 0.2, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-CET-001'), percentage: 1.5, quantity: 0.15, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-PHE-001'), percentage: 0.5, quantity: 0.05, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-CAP-001'), percentage: 0.35, quantity: 0.035, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-MPB-001'), percentage: 0.2, quantity: 0.02, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-ULT-001'), percentage: 0.2, quantity: 0.02, unit: 'kg', wastagePercent: 2.0 },
      { rawMaterial: getRM('RM-PPB-001'), percentage: 0.1, quantity: 0.01, unit: 'kg', wastagePercent: 1.5 },
      { rawMaterial: getRM('RM-TEA-AMN'), percentage: 0.075, quantity: 0.0075, unit: 'kg', wastagePercent: 2.0 },
    ];

    await BOM.findOneAndUpdate(
      { finishedGood: fgActivePlus._id },
      {
        $set: {
          formulaName: 'Active Plus Botanical Pain Relief & Muscle Care Formulation',
          division: 'Fadna Life Science',
          blendGramsPerUnit: 100, // 100ml / 100g per unit
          batchSize: 100,
          unit: 'Bottles / Packs',
          version: 'v1.0',
          isMultiStage: false,
          rawMaterials: activePlusRawItems,
          packingMaterials: [{ packingMaterial: pmDefaultBottle, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 }],
          notes: 'Active Plus analgesic lotion with Wintergreen oil (13.404%), Meeoil, VCO, Lemongrass, Peppermint, and Capsicum Oleoresin.',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log('[LifeScienceSeed] BOM created: ACTIVE PLUS');
  }

  console.log('[LifeScienceSeed] Successfully seeded all 7 Life Science BOMs with multi-stage support!');
}

// Allow standalone execution
if (process.argv[1]?.includes('seedLifeScienceBOMs')) {
  runLifeScienceSeed()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
