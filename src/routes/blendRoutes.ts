import express from 'express';
import { createBlend, getBlends, getActiveBlends, updateBlend } from '../controllers/blendController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getBlends);
router.get('/active', getActiveBlends);
router.post('/', authenticate, createBlend);
router.put('/:id', authenticate, updateBlend);

export default router;
