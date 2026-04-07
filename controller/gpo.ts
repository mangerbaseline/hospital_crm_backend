import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import GPOModel from '../model/Gpo.ts';
import Deal from '../model/deal.ts';

export const getGPOs = async (req: Request, res: Response): Promise<void> => {
  try {
    // Query params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const skip = (page - 1) * limit;

    // Search query (adjust fields as per your schema)
    const searchQuery = search
      ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
        ]
      }
      : {};

    // Fetch GPOs
    const gpos = await GPOModel.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit).select('name')

    const total = await GPOModel.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      page,
      limit,
      totalGPOs: total,
      totalPages: Math.ceil(total / limit),
      data: gpos
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve GPOs",
      error: error.message
    });
  }
};

export const getGPOById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const gpo = await GPOModel.findById(id).select('name')

    if (!gpo) {
      res.status(404).json({
        success: false,
        message: 'GPO not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: gpo
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching GPO',
      error: error.message
    });
  }
};

export const createGPO = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gpoData = {
      ...req.body,
      user: req.user?._id
    };

    const gpo = new GPOModel(gpoData);
    await gpo.save();

    res.status(201).json({
      success: true,
      data: gpo
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: 'Failed to create GPO',
      error: error.message
    });
  }
};

export const deleteGPO = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const gpo = await GPOModel.findByIdAndDelete(id);

    if (!gpo) {
      res.status(404).json({ success: false, message: 'GPO not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'GPO deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error deleting GPO', error: error.message });
  }
};

export const updateGPO = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const updatedGPO = await GPOModel.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedGPO) {
      res.status(404).json({ success: false, message: 'GPO not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: updatedGPO
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update GPO',
      error: error.message
    });
  }
};



export const getGPOsWithDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string) || "";

    const searchQuery = search
      ? {
        name: { $regex: search, $options: "i" },
      }
      : {};

    // 1. Get GPOs with hospitals
    const gpos = await GPOModel.find(searchQuery)
      .populate("hospitals")
      .sort({ createdAt: -1 });

    // 2. Extract all hospital IDs
    const hospitalIds = gpos.flatMap((gpo: any) =>
      gpo.hospitals.map((h: any) => h._id)
    );

    // 3. Get deals for those hospitals
    const deals = await Deal.find({
      hospital: { $in: hospitalIds },
    })
      .populate("hospital")
      .populate("user", "name email")
      .populate("products.product");

    // 4. Map deals back to GPOs
    const result = gpos.map((gpo: any) => {
      const gpoHospitalIds = gpo.hospitals.map((h: any) => h._id.toString());

      const gpoDeals = deals.filter((deal: any) =>
        gpoHospitalIds.includes(deal.hospital._id.toString())
      );

      return {
        ...gpo.toObject(),
        deals: gpoDeals,
      };
    });

    res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error: any) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch GPOs with deals",
      error: error.message,
    });
  }
};