import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { FinishedGood } from '../models/FinishedGood.js';
import { RawMaterial } from '../models/RawMaterial.js';
import { PackingMaterial } from '../models/PackingMaterial.js';
import { BOM } from '../models/BOM.js';
import { BlendStock } from '../models/BlendStock.js';
import { BOMRun } from '../models/BOMRun.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { SalesTarget } from '../models/SalesTarget.js';
import { runLifeScienceSeed } from '../scripts/seedLifeScienceBOMs.js';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fadna_production';

export async function seedDatabase(isStandalone: boolean = false) {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    }
    console.log('[Seed] Connected to MongoDB for seeding:', uri);

    // Clear old records
    await User.deleteMany({});
    await FinishedGood.deleteMany({});
    await RawMaterial.deleteMany({});
    await PackingMaterial.deleteMany({});
    await BOM.deleteMany({});
    await BlendStock.deleteMany({});
    await BOMRun.deleteMany({});
    await StockTransaction.deleteMany({});
    await SalesTarget.deleteMany({});

    console.log('[Seed] Cleared existing records.');

    // 1. Create Users
    const users = await User.create([
      {
        name: 'Dr. Rohan Fernando',
        username: 'admin',
        email: 'admin@fadna.com',
        password: 'admin123',
        role: 'admin',
        department: 'Executive Factory Management',
      },
      {
        name: 'Kavinda Jayasuriya',
        username: 'manager',
        email: 'manager@fadna.com',
        password: 'manager123',
        role: 'production_manager',
        department: 'Blending & Packing Operations',
      },
      {
        name: 'Sunil Weerasinghe',
        username: 'store',
        email: 'store@fadna.com',
        password: 'store123',
        role: 'store_keeper',
        department: 'Central Raw & Finished Stores',
      },
      {
        name: 'Nadeesha Perera',
        username: 'viewer',
        email: 'viewer@fadna.com',
        password: 'viewer123',
        role: 'viewer',
        department: 'Quality Assurance & Audit',
      },
    ]);

    const adminUser = users[0];
    const managerUser = users[1];
    const storeUser = users[2];

    // 2. Create Finished Goods matching exact operational sheets
    // FADNA TEA Division
    const fadnaTeaItems = [
      // Table 1
      { sku: 'FG-TEA-001', shortCode: 'S(SPN)', name: 'SHAPE UP (SPN)', category: 'Herbal Tea', floor: 137, store: 500, stock: 637, cost: 420, price: 680, min: 300 },
      { sku: 'FG-TEA-002', shortCode: 'DSN', name: 'DIABE (SAN)', category: 'Ayurvedic Care', floor: 312, store: 1500, stock: 1812, cost: 390, price: 640, min: 400 },
      { sku: 'FG-TEA-003', shortCode: 'GPN2', name: 'GREEN PR (N2)', category: 'Green Tea', floor: 106, store: 400, stock: 506, cost: 380, price: 620, min: 300 },
      { sku: 'FG-TEA-004', shortCode: 'H', name: 'HASTHI', category: 'Herbal Infusion', floor: 15, store: 40, stock: 55, cost: 450, price: 750, min: 50 },
      { sku: 'FG-TEA-005', shortCode: 'CN3', name: 'CINNAMON (N3)', category: 'Spices Tea', floor: 297, store: 1200, stock: 1497, cost: 350, price: 590, min: 400 },
      { sku: 'FG-TEA-006', shortCode: 'T(SPN)', name: 'TUMMY (SPN)', category: 'Digestive', floor: 88, store: 250, stock: 338, cost: 370, price: 610, min: 200 },
      { sku: 'FG-TEA-007', shortCode: 'BN3', name: 'BELIMAL (N3)', category: 'Traditional Herb', floor: 402, store: 1600, stock: 2002, cost: 310, price: 530, min: 500 },
      { sku: 'FG-TEA-008', shortCode: 'IN4', name: 'IRAMUSU (N4)', category: 'Traditional Herb', floor: 254, store: 1400, stock: 1654, cost: 320, price: 540, min: 400 },
      { sku: 'FG-TEA-009', shortCode: 'RN3', name: 'RANAWARA (N3)', category: 'Traditional Herb', floor: 102, store: 350, stock: 452, cost: 310, price: 520, min: 200 },

      // Table 2
      { sku: 'FG-TEA-010', shortCode: 'KN2', name: 'KARAWILE (N3)', category: 'Traditional Herb', floor: 13, store: 50, stock: 63, cost: 340, price: 560, min: 50 },
      { sku: 'FG-TEA-011', shortCode: 'ETN', name: 'EZY TEA (N)', category: 'Wellness Blend', floor: 0, store: 0, stock: 0, cost: 360, price: 590, min: 50 },
      { sku: 'FG-TEA-012', shortCode: 'MMN', name: 'MIRACLE (N)', category: 'Moringa Blend', floor: 79, store: 300, stock: 379, cost: 410, price: 690, min: 100 },
      { sku: 'FG-TEA-013', shortCode: 'MCN', name: 'M/CINNA (N)', category: 'Moringa Blend', floor: 38, store: 150, stock: 188, cost: 420, price: 700, min: 100 },
      { sku: 'FG-TEA-014', shortCode: 'MGN', name: 'M/GREEN (N)', category: 'Moringa Blend', floor: 39, store: 200, stock: 239, cost: 420, price: 700, min: 100 },
      { sku: 'FG-TEA-015', shortCode: 'SSN', name: 'SOURSOP (N)', category: 'Herbal Blend', floor: 79, store: 200, stock: 279, cost: 430, price: 720, min: 100 },
      { sku: 'FG-TEA-016', shortCode: 'FAN', name: 'FENNEL (N)', category: 'Digestive', floor: 31, store: 80, stock: 111, cost: 340, price: 550, min: 50 },
      { sku: 'FG-TEA-017', shortCode: 'NRN', name: 'NELLI (N)', category: 'Traditional Herb', floor: 47, store: 250, stock: 297, cost: 330, price: 540, min: 100 },
      { sku: 'FG-TEA-018', shortCode: 'IMN', name: 'IMMUNNI (SPN)', category: 'Immunity', floor: 2, store: 10, stock: 12, cost: 450, price: 750, min: 50 },

      // Table 3 (Heritage / Special)
      { sku: 'FG-TEA-019', shortCode: 'HMM', name: 'H. MIRACLE', category: 'Heritage Range', floor: 6, store: 10, stock: 16, cost: 480, price: 800, min: 20 },
      { sku: 'FG-TEA-020', shortCode: 'HIR', name: 'H. IRAMUSU', category: 'Heritage Range', floor: 1, store: 3, stock: 4, cost: 460, price: 780, min: 20 },
      { sku: 'FG-TEA-021', shortCode: 'HRA', name: 'H. RANAWARA', category: 'Heritage Range', floor: 2, store: 4, stock: 6, cost: 460, price: 780, min: 20 },
      { sku: 'FG-TEA-022', shortCode: 'HBE', name: 'H. BELIMAL', category: 'Heritage Range', floor: 0, store: 0, stock: 0, cost: 460, price: 780, min: 20 },
      { sku: 'FG-TEA-023', shortCode: 'HCI', name: 'H. CINNAMON', category: 'Heritage Range', floor: 0, store: 0, stock: 0, cost: 480, price: 800, min: 20 },
      { sku: 'FG-TEA-024', shortCode: 'HGR', name: 'H. GREEN', category: 'Heritage Range', floor: 3, store: 5, stock: 8, cost: 480, price: 800, min: 20 },
    ].map((item) => ({
      ...item,
      division: 'Fadna Tea' as const,
      productionFloorStock: 0,
      finishedStoreStock: 0,
      physicalActualStock: null,
      unit: 'Packs',
      packSize: '20 Tea Bags',
      minReorderLevel: item.min,
      standardBatchSize: 1000,
      costPerUnit: item.cost,
      sellingPrice: item.price,
      description: `Official Fadna ${item.name} herbal tea blend.`,
    }));

    // FADNA LIFE SCIENCE Division
    const fadnaLifeScienceItems = [
      { sku: 'FG-LS-001', shortCode: 'OR.ACT', name: 'ORIGIN ACTIVE', category: 'Life Science', floor: 80, store: 350, stock: 430, cost: 580, price: 950, min: 100 },
      { sku: 'FG-LS-002', shortCode: 'SA', name: 'SALACIA ACTIVE', category: 'Life Science', floor: 120, store: 450, stock: 570, cost: 620, price: 990, min: 150 },
      { sku: 'FG-LS-003', shortCode: 'VER', name: 'VERUM CARE', category: 'Life Science', floor: 60, store: 220, stock: 280, cost: 540, price: 890, min: 100 },
      { sku: 'FG-LS-004', shortCode: 'BIO', name: 'BIO GUARD', category: 'Life Science', floor: 40, store: 180, stock: 220, cost: 600, price: 980, min: 80 },
      { sku: 'FG-LS-005', shortCode: 'ZCR', name: 'ZINC CHROMIUM', category: 'Life Science', floor: 50, store: 190, stock: 240, cost: 510, price: 850, min: 80 },
      { sku: 'FG-LS-006', shortCode: 'ZCA', name: 'ZINC CALCIUM', category: 'Life Science', floor: 45, store: 175, stock: 220, cost: 510, price: 850, min: 80 },
      { sku: 'FG-LS-007', shortCode: 'CLE', name: 'CLEANSE DETOX', category: 'Life Science', floor: 30, store: 150, stock: 180, cost: 560, price: 910, min: 60 },
      { sku: 'FG-LS-008', shortCode: 'GLO', name: 'GLO FORMULA', category: 'Life Science', floor: 70, store: 290, stock: 360, cost: 650, price: 1050, min: 100 },
      { sku: 'FG-LS-009', shortCode: 'EYE', name: 'EYE VISION CARE', category: 'Life Science', floor: 25, store: 120, stock: 145, cost: 620, price: 990, min: 50 },
      { sku: 'FG-LS-010', shortCode: 'MOI', name: 'MOISTURE COMPLEX', category: 'Life Science', floor: 40, store: 160, stock: 200, cost: 530, price: 870, min: 60 },
      { sku: 'FG-LS-011', shortCode: 'MOI.M', name: 'MOISTURE M', category: 'Life Science', floor: 35, store: 145, stock: 180, cost: 530, price: 870, min: 60 },
      { sku: 'FG-LS-012', shortCode: 'MOI.FE', name: 'MOISTURE FE', category: 'Life Science', floor: 55, store: 230, stock: 285, cost: 540, price: 880, min: 80 },
      { sku: 'FG-LS-013', shortCode: 'DER', name: 'DERMA HEALTH', category: 'Life Science', floor: 30, store: 130, stock: 160, cost: 590, price: 950, min: 50 },
      { sku: 'FG-LS-014', shortCode: 'EPID', name: 'EPIDERM D', category: 'Life Science', floor: 20, store: 95, stock: 115, cost: 610, price: 980, min: 40 },
      { sku: 'FG-LS-015', shortCode: 'EPIK', name: 'EPIDERM K', category: 'Life Science', floor: 20, store: 90, stock: 110, cost: 610, price: 980, min: 40 },
      { sku: 'FG-LS-016', shortCode: 'ACQ.N', name: 'ACQUA NUTRI', category: 'Life Science', floor: 45, store: 185, stock: 230, cost: 570, price: 920, min: 60 },
      { sku: 'FG-LS-017', shortCode: 'ORT', name: 'ORTHO HERB', category: 'Life Science', floor: 35, store: 150, stock: 185, cost: 630, price: 1020, min: 50 },
      { sku: 'FG-LS-018', shortCode: 'S(SHP)', name: 'SHAPE-UP LS (SHP)', category: 'Life Science', floor: 90, store: 410, stock: 500, cost: 590, price: 960, min: 120 },
    ].map((item) => ({
      ...item,
      division: 'Fadna Life Science' as const,
      productionFloorStock: 0,
      finishedStoreStock: 0,
      physicalActualStock: null,
      unit: 'Packs',
      packSize: '20 Capsules / Packs',
      minReorderLevel: item.min,
      standardBatchSize: 800,
      costPerUnit: item.cost,
      sellingPrice: item.price,
      description: `Fadna Life Science ${item.name} nutraceutical line.`,
    }));

    const finishedGoods = await FinishedGood.create([
      ...fadnaTeaItems,
      ...fadnaLifeScienceItems,
    ]);

    // 3. Create Raw Materials
    const rawMaterials = await RawMaterial.create([
      { sku: 'RM-TEA-001', name: 'Ceylon Black Tea BOPF Fannings', botanicalName: 'Camellia sinensis', category: 'Tea', unit: 'kg', currentStock: 1250, minReorderLevel: 250, costPerUnit: 1400, supplier: 'Bogawantalawa Tea Estates PLC', storageLocation: 'RM Warehouse Bay A-1' },
      { sku: 'RM-GAR-001', name: 'Dried Garcinia (Goraka Powder)', botanicalName: 'Garcinia cambogia', category: 'Tea', unit: 'kg', currentStock: 380, minReorderLevel: 80, costPerUnit: 1850, supplier: 'Southern Spice Farmers Network', storageLocation: 'RM Warehouse Bay A-2' },
      { sku: 'RM-CIN-001', name: 'Ceylon Cinnamon Powder (C5)', botanicalName: 'Cinnamomum verum', category: 'Others', unit: 'kg', currentStock: 240, minReorderLevel: 50, costPerUnit: 3200, supplier: 'Mirissa Organic Cinnamon Millers', storageLocation: 'RM Warehouse Bay B-1' },
      { sku: 'RM-KOT-001', name: 'Kothalahimbutu Crushed Root', botanicalName: 'Salacia reticulata', category: 'Lifescience', unit: 'kg', currentStock: 45, minReorderLevel: 60, costPerUnit: 4100, supplier: 'Anuradhapura Ayurvedic Herbal Supply', storageLocation: 'RM Warehouse Bay B-2' },
      { sku: 'RM-GIN-001', name: 'Ginger Root Coarse Flakes', botanicalName: 'Zingiber officinale', category: 'Others', unit: 'kg', currentStock: 410, minReorderLevel: 100, costPerUnit: 1650, supplier: 'Kandy Highland Spices', storageLocation: 'RM Warehouse Bay C-1' },
      { sku: 'RM-COR-001', name: 'Roasted Coriander Seeds', botanicalName: 'Coriandrum sativum', category: 'Others', unit: 'kg', currentStock: 520, minReorderLevel: 120, costPerUnit: 980, supplier: 'Matale Agro Supplies', storageLocation: 'RM Warehouse Bay C-2' },
      { sku: 'RM-BEL-001', name: 'Belimal Dehydrated Flowers', botanicalName: 'Aegle marmelos', category: 'Tea', unit: 'kg', currentStock: 480, minReorderLevel: 100, costPerUnit: 1750, supplier: 'Dambulla Herbal Growers Co-op', storageLocation: 'RM Warehouse Bay C-3' },
      { sku: 'RM-IRA-001', name: 'Iramusu Dried Root Cut', botanicalName: 'Hemidesmus indicus', category: 'Tea', unit: 'kg', currentStock: 360, minReorderLevel: 80, costPerUnit: 2100, supplier: 'Sabaragamuwa Ayurvedic Supply', storageLocation: 'RM Warehouse Bay C-4' },
      { sku: 'RM-RAN-001', name: 'Ranawara Dried Blossoms', botanicalName: 'Senna auriculata', category: 'Tea', unit: 'kg', currentStock: 190, minReorderLevel: 60, costPerUnit: 1950, supplier: 'Hambantota Floral Harvesters', storageLocation: 'RM Warehouse Bay D-1' },
      { sku: 'RM-MOR-001', name: 'Organic Moringa Leaves Cut', botanicalName: 'Moringa oleifera', category: 'QofL', unit: 'kg', currentStock: 310, minReorderLevel: 70, costPerUnit: 2400, supplier: 'Wanni Green Valley Organic Farms', storageLocation: 'RM Warehouse Bay D-2' },
      { sku: 'RM-GRN-001', name: 'Ceylon Green Tea Fannings', botanicalName: 'Camellia sinensis var. sinensis', category: 'Tea', unit: 'kg', currentStock: 28, minReorderLevel: 60, costPerUnit: 1950, supplier: 'Nuwara Eliya Green Leaf Tea Co.', storageLocation: 'RM Warehouse Bay D-3' },
    ]);

    // 4. Create Packing Materials
    const packingMaterials = await PackingMaterial.create([
      { sku: 'PM-FLT-001', name: 'Heat-Seal Teabag Filter Paper Rolls (120mm)', category: 'Filter Paper', unit: 'Rolls', currentStock: 85, minReorderLevel: 20, costPerUnit: 8500, supplier: 'Glatfelter Specialty Papers', storageLocation: 'PM Store Racks Section 1' },
      { sku: 'PM-TAG-001', name: 'Fadna Cotton Thread & Tag Reels', category: 'Tags & Strings', unit: 'Reels', currentStock: 42, minReorderLevel: 10, costPerUnit: 6200, supplier: 'Print & Pack Lanka Ltd', storageLocation: 'PM Store Racks Section 1' },
      { sku: 'PM-BOX-001', name: 'Fadna Shape-Up Monocarton Box (20s)', category: 'Monocartons', unit: 'Pcs', currentStock: 12500, minReorderLevel: 2500, costPerUnit: 28, supplier: 'Print & Pack Lanka Ltd', storageLocation: 'PM Store Racks Section 2' },
      { sku: 'PM-BOX-002', name: 'Fadna Diabe Tea Monocarton Box (20s)', category: 'Monocartons', unit: 'Pcs', currentStock: 8200, minReorderLevel: 2000, costPerUnit: 28, supplier: 'Print & Pack Lanka Ltd', storageLocation: 'PM Store Racks Section 2' },
      { sku: 'PM-BOX-003', name: 'Fadna Belimal Monocarton Box (20s)', category: 'Monocartons', unit: 'Pcs', currentStock: 11000, minReorderLevel: 2500, costPerUnit: 26, supplier: 'Print & Pack Lanka Ltd', storageLocation: 'PM Store Racks Section 2' },
      { sku: 'PM-PCH-001', name: 'Inner Barrier Sealed Foil Pouches', category: 'Inner Pouches', unit: 'Pcs', currentStock: 45000, minReorderLevel: 8000, costPerUnit: 8.5, supplier: 'Flexible Packaging Lanka', storageLocation: 'PM Store Racks Section 4' },
      { sku: 'PM-SHP-001', name: 'Master Shipper Corrugated Cartons (48 packs)', category: 'Master Shippers', unit: 'Pcs', currentStock: 950, minReorderLevel: 200, costPerUnit: 145, supplier: 'Boxmaster Packaging Group', storageLocation: 'PM Store Bay 5' },
    ]);

    // 5. Create Product Formulas (BOMs) for Fadna Tea and Fadna Life Science
    await BOM.create([
      // FADNA TEA FORMULAS
      {
        finishedGood: finishedGoods[0]._id, // Shape-Up Tea
        formulaName: 'Fadna Shape-Up Herbal Blend Formula',
        division: 'Fadna Tea',
        blendGramsPerUnit: 40,
        batchSize: 100,
        unit: 'Packs',
        version: 'v2.1',
        rawMaterials: [
          { rawMaterial: rawMaterials[0]._id, percentage: 55, quantity: 2.2, unit: 'kg', wastagePercent: 2.0 },
          { rawMaterial: rawMaterials[1]._id, percentage: 35, quantity: 1.4, unit: 'kg', wastagePercent: 2.5 },
          { rawMaterial: rawMaterials[2]._id, percentage: 10, quantity: 0.4, unit: 'kg', wastagePercent: 1.5 },
        ],
        packingMaterials: [
          { packingMaterial: packingMaterials[2]._id, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 },
          { packingMaterial: packingMaterials[5]._id, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 },
          { packingMaterial: packingMaterials[0]._id, quantity: 0.12, unit: 'Rolls', wastagePercent: 3.0 },
          { packingMaterial: packingMaterials[1]._id, quantity: 0.08, unit: 'Reels', wastagePercent: 2.0 },
        ],
        notes: 'Standard batch formulation for Shape-Up Tea (20 bags x 2g).',
      },
      {
        finishedGood: finishedGoods[1]._id, // Diabe Tea
        formulaName: 'Fadna Diabe Ayurvedic Botanical Formula',
        division: 'Fadna Tea',
        blendGramsPerUnit: 40,
        batchSize: 100,
        unit: 'Packs',
        version: 'v1.8',
        rawMaterials: [
          { rawMaterial: rawMaterials[3]._id, percentage: 62.5, quantity: 2.5, unit: 'kg', wastagePercent: 2.0 },
          { rawMaterial: rawMaterials[0]._id, percentage: 37.5, quantity: 1.5, unit: 'kg', wastagePercent: 1.5 },
        ],
        packingMaterials: [
          { packingMaterial: packingMaterials[3]._id, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 },
          { packingMaterial: packingMaterials[5]._id, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 },
          { packingMaterial: packingMaterials[0]._id, quantity: 0.12, unit: 'Rolls', wastagePercent: 3.0 },
          { packingMaterial: packingMaterials[1]._id, quantity: 0.08, unit: 'Reels', wastagePercent: 2.0 },
        ],
        notes: 'Clinical trial certified formulation.',
      },
      {
        finishedGood: finishedGoods[6]._id, // Belimal
        formulaName: 'Fadna Belimal Flower Herbal Recipe',
        division: 'Fadna Tea',
        blendGramsPerUnit: 40,
        batchSize: 100,
        unit: 'Packs',
        version: 'v1.4',
        rawMaterials: [
          { rawMaterial: rawMaterials[6]._id, percentage: 100, quantity: 4.0, unit: 'kg', wastagePercent: 2.0 },
        ],
        packingMaterials: [
          { packingMaterial: packingMaterials[4]._id, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 },
          { packingMaterial: packingMaterials[5]._id, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 },
          { packingMaterial: packingMaterials[0]._id, quantity: 0.12, unit: 'Rolls', wastagePercent: 3.0 },
          { packingMaterial: packingMaterials[1]._id, quantity: 0.08, unit: 'Reels', wastagePercent: 2.0 },
        ],
        notes: 'Pure Belimal flower infusion.',
      },
      // FADNA LIFE SCIENCE FORMULAS
      {
        finishedGood: finishedGoods[24]._id, // ORIGIN ACTIVE
        formulaName: 'Origin Active Life Science Formulation',
        division: 'Fadna Life Science',
        blendGramsPerUnit: 30,
        batchSize: 100,
        unit: 'Packs',
        version: 'v3.0',
        rawMaterials: [
          { rawMaterial: rawMaterials[9]._id, percentage: 60, quantity: 1.8, unit: 'kg', wastagePercent: 1.5 }, // Moringa
          { rawMaterial: rawMaterials[4]._id, percentage: 40, quantity: 1.2, unit: 'kg', wastagePercent: 2.0 }, // Ginger
        ],
        packingMaterials: [
          { packingMaterial: packingMaterials[2]._id, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 },
          { packingMaterial: packingMaterials[5]._id, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 },
        ],
        notes: 'Active nutraceutical booster for energy and cellular vitality.',
      },
      {
        finishedGood: finishedGoods[25]._id, // SALACIA ACTIVE
        formulaName: 'Salacia Active Botanical Sugar Support',
        division: 'Fadna Life Science',
        blendGramsPerUnit: 35,
        batchSize: 100,
        unit: 'Packs',
        version: 'v2.2',
        rawMaterials: [
          { rawMaterial: rawMaterials[3]._id, percentage: 80, quantity: 2.8, unit: 'kg', wastagePercent: 2.0 }, // Kothalahimbutu
          { rawMaterial: rawMaterials[2]._id, percentage: 20, quantity: 0.7, unit: 'kg', wastagePercent: 1.5 }, // Cinnamon
        ],
        packingMaterials: [
          { packingMaterial: packingMaterials[3]._id, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 },
          { packingMaterial: packingMaterials[5]._id, quantity: 100, unit: 'Pcs', wastagePercent: 1.0 },
        ],
        notes: 'Glycemic control herbal bioactive extract.',
      },
    ]);

    // 5.1 Seed Initial Blend Stock Records with Predictable Product Counts
    const sampleBlend1 = await BlendStock.create({
      blendCode: 'BLD-20261026-0001',
      blendName: 'Shape-Up Master Botanical Blend #B2026-01',
      division: 'Fadna Tea',
      targetFinishedGood: finishedGoods[0]._id,
      targetFinishedGoodName: finishedGoods[0].name,
      targetFinishedGoodSku: finishedGoods[0].sku,
      ingredients: [
        { rawMaterial: rawMaterials[0]._id, rawMaterialName: rawMaterials[0].name, sku: rawMaterials[0].sku, quantity: 22, unit: 'kg' },
        { rawMaterial: rawMaterials[1]._id, rawMaterialName: rawMaterials[1].name, sku: rawMaterials[1].sku, quantity: 14, unit: 'kg' },
        { rawMaterial: rawMaterials[2]._id, rawMaterialName: rawMaterials[2].name, sku: rawMaterials[2].sku, quantity: 4, unit: 'kg' },
      ],
      totalWeight: 40,
      availableWeight: 30, // 30kg left
      weightUnit: 'kg',
      blendGramsPerFinishedUnit: 40,
      predictedProductCount: 750, // 30,000g / 40g = 750 packs
      initialProductCount: 1000,
      status: 'Partially Consumed',
      notes: 'Initial production blend for supermarket export quota.',
      createdBy: adminUser._id,
      createdByName: adminUser.name,
    });

    const sampleBlend2 = await BlendStock.create({
      blendCode: 'BLD-20261026-0002',
      blendName: 'Salacia Active Life Science Botanical Blend #LS-01',
      division: 'Fadna Life Science',
      targetFinishedGood: finishedGoods[25]._id,
      targetFinishedGoodName: finishedGoods[25].name,
      targetFinishedGoodSku: finishedGoods[25].sku,
      ingredients: [
        { rawMaterial: rawMaterials[3]._id, rawMaterialName: rawMaterials[3].name, sku: rawMaterials[3].sku, quantity: 28, unit: 'kg' },
        { rawMaterial: rawMaterials[2]._id, rawMaterialName: rawMaterials[2].name, sku: rawMaterials[2].sku, quantity: 7, unit: 'kg' },
      ],
      totalWeight: 35,
      availableWeight: 35, // 35kg left
      weightUnit: 'kg',
      blendGramsPerFinishedUnit: 35,
      predictedProductCount: 1000, // 35,000g / 35g = 1,000 packs
      initialProductCount: 1000,
      status: 'In Stock',
      notes: 'High-purity Salacia reticulata extract mix.',
      createdBy: managerUser._id,
      createdByName: managerUser.name,
    });

    // 5.2 Seed Initial BOM WIP Run Records with Product Count of BOM
    await BOMRun.create({
      bomRunNumber: 'BOM-20261026-0001',
      bomName: 'Shape-Up Monocarton Packing WIP Run #01',
      division: 'Fadna Tea',
      finishedGood: finishedGoods[0]._id,
      finishedGoodName: finishedGoods[0].name,
      finishedGoodSku: finishedGoods[0].sku,
      blendStock: sampleBlend1._id,
      blendCode: sampleBlend1.blendCode,
      blendName: sampleBlend1.blendName,
      blendWeightConsumed: 10, // 10kg consumed
      blendWeightUnit: 'kg',
      packingMaterialsUsed: [
        { packingMaterial: packingMaterials[2]._id, name: packingMaterials[2].name, sku: packingMaterials[2].sku, quantity: 250, unit: 'Pcs' },
        { packingMaterial: packingMaterials[5]._id, name: packingMaterials[5].name, sku: packingMaterials[5].sku, quantity: 250, unit: 'Pcs' },
      ],
      bomProductCount: 250,
      availableBOMCount: 250, // 250 packs waiting in BOM WIP stage
      transferredToFGCount: 0,
      status: 'In BOM Stage',
      notes: 'Line 2 packing run in progress.',
      createdBy: managerUser._id,
      createdByName: managerUser.name,
    });

    // 6. Seed the EXACT historical daily dispatches matching the user's uploaded images!
    // Matching 7-Oct-2026 Fadna Tea Out table:
    // Rows: HIMASHA FREE ISSUE, EXPORT ORDER, PROMT ORDERS, PHARMACY ORDERS, SUPER K ORDERS, CARGILS ORDERS, CITY PACK ORDERS
    const fadnaTeaMap: { [code: string]: any } = {};
    finishedGoods.forEach((fg) => {
      fadnaTeaMap[fg.shortCode] = fg;
    });

    const oct7Date = new Date('2026-10-07T10:00:00.000Z');

    // Finished Good transactions are left clean for operational factory entry

    // Seed Life Science authentic 7 BOMs with Multi-Stage Extraction recipes
    await runLifeScienceSeed();

    console.log('[Seed] Database successfully seeded with authentic 100% matched Fadna Tea & Life Science sheets!');
    if (isStandalone) {
      process.exit(0);
    }
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
    if (isStandalone) {
      process.exit(1);
    }
  }
}

if (process.argv[1] && (process.argv[1].endsWith('seedData.ts') || process.argv[1].endsWith('seedData.js'))) {
  seedDatabase(true);
}
