import express from 'express';
import { getIDNs, getIDNById, createIDN, deleteIDN, updateIDN } from '../controller/idn.ts';
import { protect, authorizeRoles } from '../middleware/authMiddleware.ts';
import { UserRole } from '../model/User.ts';

const router = express.Router();

router.use(protect);

router.get('/all-idns', getIDNs);
router.get('/:id', getIDNById);
router.post('/create', createIDN);
router.put('/:id', updateIDN);
router.delete('/:id', deleteIDN);

export default router;
