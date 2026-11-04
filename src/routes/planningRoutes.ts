import { Router } from 'express';
import {
  getProductionCapacity,
  calculateSalesPlan,
  calculateThreeMonthMRP,
  saveSalesTarget,
  getSalesTargets,
} from '../controllers/planningController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/capacity', authenticate, getProductionCapacity);
router.post('/sales-plan', authenticate, calculateSalesPlan);
router.post('/three-month-mrp', authenticate, calculateThreeMonthMRP);
router.post('/sales-targets', authenticate, authorizeRoles('admin', 'production_manager'), saveSalesTarget);
router.get('/sales-targets', authenticate, getSalesTargets);

export default router;
