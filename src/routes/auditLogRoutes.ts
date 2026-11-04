import { Router } from 'express';
import {
  getAuditLogs,
  getRecentAuditLogs,
  getEntityAuditLogs,
} from '../controllers/auditLogController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', authenticate, getAuditLogs);
router.get('/recent', authenticate, getRecentAuditLogs);
router.get('/entity/:entityType/:entityId', authenticate, getEntityAuditLogs);

export default router;
