import { Router } from 'express';
import {
  getRawMaterials,
  getRawMaterialById,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
} from '../controllers/rawMaterialsController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', authenticate, getRawMaterials);
router.get('/:id', authenticate, getRawMaterialById);
router.post('/', authenticate, authorizeRoles('admin', 'production_manager', 'store_keeper'), createRawMaterial);
router.put('/:id', authenticate, authorizeRoles('admin', 'production_manager', 'store_keeper'), updateRawMaterial);
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteRawMaterial);

export default router;
