import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import Deal from '../model/deal.ts';

/**
 * Fetch all deals with pagination and searching
 */
export const getDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const searchQuery = (req.query.search as string) || "";
    
    // For search, we might want to search by hospital name or something similar
    // but the deal model only stores the ObjectId. We can search by ID if provided or just return all and filtering by other criteria.
    // For now, let's keep it simple or expand it if needed.
    const query: any = {};
    if (searchQuery) {
        // Example: search by currentPipelineStage
        query.currentPipelineStage = { $regex: searchQuery, $options: "i" };
    }

    const deals = await Deal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('hospital')
      .populate('contact')
      .populate('products')
      .populate('user', 'name email');

    const total = await Deal.countDocuments(query);

    res.status(200).json({
      success: true,
      page,
      limit,
      totalDeals: total,
      totalPages: Math.ceil(total / limit),
      data: deals
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve deals',
      error: error.message
    });
  }
};

/**
 * Get a single deal by ID
 */
export const getDealById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deal = await Deal.findById(id)
      .populate('hospital')
      .populate('contact')
      .populate('products')
      .populate('user', 'name email');

    if (!deal) {
      res.status(404).json({ success: false, message: 'Deal not found' });
      return;
    }

    res.status(200).json({ success: true, data: deal });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error fetching deal', error: error.message });
  }
};

/**
 * Create a new deal
 */
export const createDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dealData = {
      ...req.body,
      user: req.user?._id
    };

    const newDeal = new Deal(dealData);
    await newDeal.save();

    res.status(201).json({
      success: true,
      data: newDeal
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: 'Failed to create deal',
      error: error.message
    });
  }
};

/**
 * Update an existing deal
 */
export const updateDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const updatedDeal = await Deal.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedDeal) {
      res.status(404).json({ success: false, message: 'Deal not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: updatedDeal
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update deal',
      error: error.message
    });
  }
};

/**
 * Delete a deal
 */
export const deleteDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deletedDeal = await Deal.findByIdAndDelete(id);

    if (!deletedDeal) {
      res.status(404).json({ success: false, message: 'Deal not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Deal deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error deleting deal', error: error.message });
  }
};
