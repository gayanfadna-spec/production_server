import { Router } from 'express';
import {
  getFinishedGoods,
  getFinishedGoodById,
  createFinishedGood,
  updateFinishedGood,
  deleteFinishedGood,
} from '../controllers/finishedGoodsController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', authenticate, getFinishedGoods);
router.get('/:id', authenticate, getFinishedGoodById);
router.post('/', authenticate, authorizeRoles('admin', 'production_manager'), createFinishedGood);
router.put('/:id', authenticate, authorizeRoles('admin', 'production_manager'), updateFinishedGood);
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteFinishedGood);

export default router;
