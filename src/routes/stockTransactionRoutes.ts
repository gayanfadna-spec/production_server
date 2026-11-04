import { Router } from 'express';
import {
  getTransactions,
  createTransaction,
  executeProductionRun,
} from '../controllers/stockTransactionController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', authenticate, getTransactions);
router.post(
  '/',
  authenticate,
  authorizeRoles('admin', 'production_manager', 'store_keeper'),
  createTransaction
);
router.post(
  '/production-run',
  authenticate,
  authorizeRoles('admin', 'production_manager'),
  executeProductionRun
);

export default router;
