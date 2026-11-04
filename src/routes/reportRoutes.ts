import { Router } from 'express';
import {
  getDailyInOutReport,
  getDailyStockReport,
  getDailyMatrixReport,
  getDailyMatrixDates,
  postDailyMatrixDispatch,
  savePhysicalAudit,
  saveDailyMatrixGrid,
} from '../controllers/reportController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/daily-in-out', authenticate, getDailyInOutReport);
router.get('/daily-stock', authenticate, getDailyStockReport);
router.get('/daily-matrix', authenticate, getDailyMatrixReport);
router.get('/daily-matrix-dates', authenticate, getDailyMatrixDates);
router.post('/daily-matrix-dispatch', authenticate, postDailyMatrixDispatch);
router.post('/save-physical-audit', authenticate, savePhysicalAudit);
router.post('/save-daily-matrix-grid', authenticate, saveDailyMatrixGrid);

export default router;


