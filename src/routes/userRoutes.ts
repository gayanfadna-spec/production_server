import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
} from '../controllers/userController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Only admin can create, update, delete or toggle user accounts
// Authenticated users can list or view users
router.get('/', authenticate, getUsers);
router.get('/:id', authenticate, getUserById);
router.post('/', authenticate, authorizeRoles('admin'), createUser);
router.put('/:id', authenticate, authorizeRoles('admin'), updateUser);
router.patch('/:id/toggle-status', authenticate, authorizeRoles('admin'), toggleUserStatus);
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteUser);

export default router;
