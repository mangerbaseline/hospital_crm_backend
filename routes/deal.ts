import express from 'express';
import { getDeals, getDealById, createDeal, deleteDeal, updateDeal, updateDealProductStage, getDealStats } from '../controller/deal.ts';
import { protect, authorizeRoles } from '../middleware/authMiddleware.ts';

const router = express.Router();

router.use(protect);
router.get('/all-deals', getDeals);
router.get('/stats/get-deal-stats', getDealStats)
router.get('/:id', getDealById);
router.post('/create', createDeal);
router.put('/:id', updateDeal);

router.put('/stage/update-deal-stage', updateDealProductStage)



export default router;
