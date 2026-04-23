import express from 'express';
import { getMailboxMessages, sendMailFromMailbox } from '../controller/graphAppOnlyAPI.ts';
import { protect } from '../middleware/authMiddleware.ts';

const router = express.Router();

router.get('/messages/:email', protect, getMailboxMessages);
router.post('/send', protect, sendMailFromMailbox);

export default router;
