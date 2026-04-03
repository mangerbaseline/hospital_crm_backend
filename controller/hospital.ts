import type { Request, Response } from 'express';
import Hospital from '../model/Hospital.ts';

export const getHospitals = async (req: Request, res: Response): Promise<void> => {
  try {
    const hospitals = await Hospital.find().sort({ createdAt: -1 });
    const count = await Hospital.countDocuments();

    res.status(200).json({
      success: true,
      count,
      data: hospitals
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve hospitals',
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

export const createHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    const hospital = new Hospital(req.body);
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
