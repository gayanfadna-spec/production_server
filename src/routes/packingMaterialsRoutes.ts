import { Router } from 'express';
import {
  getPackingMaterials,
  getPackingMaterialById,
  createPackingMaterial,
  updatePackingMaterial,
  deletePackingMaterial,
} from '../controllers/packingMaterialsController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', authenticate, getPackingMaterials);
router.get('/:id', authenticate, getPackingMaterialById);
router.post('/', authenticate, authorizeRoles('admin', 'production_manager', 'store_keeper'), createPackingMaterial);
router.put('/:id', authenticate, authorizeRoles('admin', 'production_manager', 'store_keeper'), updatePackingMaterial);
router.delete('/:id', authenticate, authorizeRoles('admin'), deletePackingMaterial);

export default router;
