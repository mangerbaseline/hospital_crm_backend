import type { Request, Response } from 'express';
import GPOModel from '../model/Gpo.ts';

export const getGPOs = async (req: Request, res: Response): Promise<void> => {
  try {
    const gpos = await GPOModel.find().sort({ createdAt: -1 });
    const count = await GPOModel.countDocuments();

    res.status(200).json({
      success: true,
      count,
      data: gpos
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve GPOs',
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

    const gpo = await GPOModel.findById(id).populate('hospitals');

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

export const createGPO = async (req: Request, res: Response): Promise<void> => {
  try {
    const gpo = new GPOModel(req.body);
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
