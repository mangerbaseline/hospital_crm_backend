import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import Hospital from '../model/Hospital.ts';

export const getHospitals = async (req: Request, res: Response): Promise<void> => {
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
          { hospitalName: { $regex: search, $options: "i" } },
          // { address: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } }
        ]
      }
      : {};

    // Fetch hospitals
    const hospitals = await Hospital.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit).populate('idn');

    const total = await Hospital.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      page,
      limit,
      totalHospitals: total,
      totalPages: Math.ceil(total / limit),
      data: hospitals
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve hospitals",
      error: error.message
    });
  }
};

export const getHospitalByHospitalId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }
    const hospital = await Hospital.findById(id);

    if (!hospital) {
      res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: hospital
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching hospital',
      error: error.message
    });
  }
};

export const createHospital = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hospitalData = {
      ...req.body,
      user: req.user?._id
    };

    const hospital = new Hospital(hospitalData);
    await hospital.save();

    res.status(201).json({
      success: true,
      data: hospital
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: 'Failed to create hospital',
      error: error.message
    });
  }
};

export const deleteHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const hospital = await Hospital.findByIdAndDelete(id);

    if (!hospital) {
      res.status(404).json({ success: false, message: 'Hospital not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Hospital deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error deleting hospital', error: error.message });
  }
};

export const updateHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const updatedHospital = await Hospital.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedHospital) {
      res.status(404).json({ success: false, message: 'Hospital not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: updatedHospital
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update hospital',
      error: error.message
    });
  }
};
