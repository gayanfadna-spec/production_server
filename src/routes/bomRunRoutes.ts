import express from 'express';
import {
  createBOMRun,
  transferBOMToFinishedGoods,
  getBOMRuns,
  getActiveBOMRuns,
} from '../controllers/bomRunController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getBOMRuns);
router.get('/active', getActiveBOMRuns);
router.post('/', authenticate, createBOMRun);
router.post('/:id/transfer-to-fg', authenticate, transferBOMToFinishedGoods);

export default router;
