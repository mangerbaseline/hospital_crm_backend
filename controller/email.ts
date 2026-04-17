import type { Request, Response } from 'express';
import Email, { saveEmails } from '../model/email.ts';

export const createEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const emailData = req.body;

    if (!emailData || (Array.isArray(emailData) && emailData.length === 0)) {
      res.status(400).json({
        success: false,
        message: 'Email data is required'
      });
      return;
    }

    const savedEmails = await saveEmails(emailData);

    res.status(201).json({
      success: true,
      data: savedEmails
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to save emails',
      error: error.message
    });
  }
};

export const getEmailsBySender = async (req: Request, res: Response): Promise<void> => {
  try {
    const { senderMail, page = "1", limit = "10" } = req.query;

    if (!senderMail) {
      res.status(400).json({
        success: false,
        message: 'senderMail is required'
      });
      return;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const query = { senderMail: (senderMail as string).toLowerCase() };

    const emails = await Email.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Email.countDocuments(query);

    res.status(200).json({
      success: true,
      data: emails,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch emails',
      error: error.message
    });
  }
};