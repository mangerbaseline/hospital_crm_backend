import express from 'express';
import { getGPOs, getGPOById, createGPO, deleteGPO, updateGPO, getGPOsWithDeals } from '../controller/gpo.ts';
import { protect, authorizeRoles } from '../middleware/authMiddleware.ts';
import { UserRole } from '../model/User.ts';

const router = express.Router();


router.use(protect);

router.get('/all-gpos', getGPOs);
router.get('/:id', getGPOById);
router.post('/create', createGPO);
router.put('/:id', updateGPO);
router.delete('/:id', deleteGPO);
router.get('/gpo-with-deals', getGPOsWithDeals);

export default router;