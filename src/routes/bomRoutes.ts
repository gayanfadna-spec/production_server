import { Router } from 'express';
import {
  getBOMs,
  getBOMByFinishedGood,
  createOrUpdateBOM,
  deleteBOM,
} from '../controllers/bomController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', authenticate, getBOMs);
router.get('/finished-good/:finishedGoodId', authenticate, getBOMByFinishedGood);
router.post('/', authenticate, authorizeRoles('admin', 'production_manager'), createOrUpdateBOM);
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteBOM);

export default router;
