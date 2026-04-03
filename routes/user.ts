import express from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser } from '../controller/user.ts';

import { protect, authorizeRoles } from '../middleware/authMiddleware.ts';
import { UserRole } from '../model/User.ts';

const router = express.Router();
router.use(protect);

router.get('/all-users', authorizeRoles(UserRole.ADMIN, UserRole.EXECUTIVE), getUsers);
router.post('/create', authorizeRoles(UserRole.ADMIN), createUser);

router.get('/:id', getUserById);
router.put('/:id', authorizeRoles(UserRole.ADMIN), updateUser);
router.delete('/:id', authorizeRoles(UserRole.ADMIN), deleteUser);


export default router;
