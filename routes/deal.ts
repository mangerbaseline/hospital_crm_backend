import express from 'express';
import { getDeals, getDealById, createDeal, deleteDeal, updateDeal, updateDealProductStage, removeProductFromDeal, addProductToDeal, updateProductInDeal } from '../controller/deal.ts';
import { protect, authorizeRoles } from '../middleware/authMiddleware.ts';

const router = express.Router();

router.use(protect);
router.get('/all-deals', getDeals);
router.get('/:id', getDealById);
router.post('/create', createDeal);
router.put('/:id', updateDeal);

router.put('/stage/update-deal-stage', updateDealProductStage)

router.delete("/delete/product", removeProductFromDeal);
router.post("/add/product", addProductToDeal);
router.put("/update/product", updateProductInDeal);

export default router;