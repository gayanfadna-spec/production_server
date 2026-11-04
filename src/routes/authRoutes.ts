import { Router } from 'express';
import { login, getMe, getUsers, createUser } from '../controllers/authController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.get('/users', authenticate, authorizeRoles('admin'), getUsers);
router.post('/users', authenticate, authorizeRoles('admin'), createUser);

export default router;
