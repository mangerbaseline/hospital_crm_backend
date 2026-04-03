import type { Request, Response } from 'express';
import Contact from '../model/Contact.ts';

export const getContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }).populate('hospital');
    const count = await Contact.countDocuments();

    res.status(200).json({
      success: true,
      count,
      data: contacts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contacts',
      error: error.message
    });
  }
};

export const getContactById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const contact = await Contact.findById(id).populate('hospital');

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching contact',
      error: error.message
    });
  }
};

export const createContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const contactData = req.body;
    console.log(contactData);

    const newContact = new Contact(contactData);
    await newContact.save();

    res.status(201).json({
      success: true,
      data: newContact
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: 'Failed to create contact',
      error: error.message
    });
  }
};

export const deleteContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      res.status(404).json({ success: false, message: 'Contact not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Contact deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error deleting contact', error: error.message });
  }
};

export const updateContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const updatedContact = await Contact.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedContact) {
      res.status(404).json({ success: false, message: 'Contact not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: updatedContact
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update contact',
      error: error.message
    });
  }
};
