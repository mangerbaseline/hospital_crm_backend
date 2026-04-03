import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import IDN from '../model/Idn.ts';

export const getIDNs = async (req: Request, res: Response): Promise<void> => {
  try {
    // Query params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const skip = (page - 1) * limit;

    // Search query (adjust fields based on your schema)
    const searchQuery = search
      ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
        ]
      }
      : {};

    // Fetch IDNs
    const idns = await IDN.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit).populate('hospitals');

    const total = await IDN.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      page,
      limit,
      totalIDNs: total,
      totalPages: Math.ceil(total / limit),
      data: idns
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve IDNs",
      error: error.message
    });
  }
};

export const getIDNById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const idn = await IDN.findById(id).populate('hospitals');

    if (!idn) {
      res.status(404).json({
        success: false,
        message: 'IDN not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: idn
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching IDN',
      error: error.message
    });
  }
};

export const createIDN = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const idnData = {
      ...req.body,
      user: req.user?._id
    };

    const idn = new IDN(idnData);
    await idn.save();

    res.status(201).json({
      success: true,
      data: idn
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: 'Failed to create IDN',
      error: error.message
    });
  }
};

export const deleteIDN = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const idn = await IDN.findByIdAndDelete(id);

    if (!idn) {
      res.status(404).json({ success: false, message: 'IDN not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'IDN deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error deleting IDN', error: error.message });
  }
};

export const updateIDN = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const updatedIDN = await IDN.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedIDN) {
      res.status(404).json({ success: false, message: 'IDN not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: updatedIDN
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update IDN',
      error: error.message
    });
  }
};
