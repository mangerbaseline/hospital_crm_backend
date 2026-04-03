import express from 'express';
import { getContacts, getContactById, createContact, deleteContact, updateContact } from '../controller/contact.ts';
import { protect, authorizeRoles } from '../middleware/authMiddleware.ts';
import { UserRole } from '../model/User.ts';

const router = express.Router();

router.use(protect);

router.get('/all-contacts', getContacts);
router.get('/:id', getContactById);
router.post('/create', authorizeRoles(UserRole.EXECUTIVE, UserRole.ADMIN), createContact);
router.put('/:id', authorizeRoles(UserRole.EXECUTIVE, UserRole.ADMIN), updateContact);
router.delete('/:id', authorizeRoles(UserRole.EXECUTIVE, UserRole.ADMIN), deleteContact);

export default router;
