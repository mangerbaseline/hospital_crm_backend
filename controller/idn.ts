import type { Request, Response } from 'express';
import IDN from '../model/Idn.ts';

export const getIDNs = async (req: Request, res: Response): Promise<void> => {
  try {
    const idns = await IDN.find().sort({ createdAt: -1 });
    const count = await IDN.countDocuments();

    res.status(200).json({
      success: true,
      count,
      data: idns
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve IDNs',
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

export const createIDN = async (req: Request, res: Response): Promise<void> => {
  try {
    const idn = new IDN(req.body);
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
