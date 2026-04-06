import express from 'express';
import { getDeals, getDealById, createDeal, deleteDeal, updateDeal } from '../controller/deal.ts';
import { protect, authorizeRoles } from '../middleware/authMiddleware.ts';
import { UserRole } from '../model/User.ts';

const router = express.Router();

router.use(protect);
router.get('/all-deals', getDeals);
router.get('/:id', getDealById);
router.post('/create', createDeal);
router.put('/:id', updateDeal);

export default router;
