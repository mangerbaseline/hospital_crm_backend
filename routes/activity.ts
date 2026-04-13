import express from 'express';
import { getActivities } from '../controller/activity.ts';
import { protect } from '../middleware/authMiddleware.ts';

const router = express.Router();

router.use(protect);

router.get('/all-activities', getActivities);

export default router;
