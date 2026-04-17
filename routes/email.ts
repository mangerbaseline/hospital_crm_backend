import express from 'express';
import { createEmail, getEmailsBySender } from '../controller/email.ts';
import { protect } from '../middleware/authMiddleware.ts';

const router = express.Router();

// All email routes are protected
router.use(protect);

router.post('/save', createEmail);
router.get('/get-by-sender', getEmailsBySender);

export default router;
