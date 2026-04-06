import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import Contact from '../model/Contact.ts';


// export const getContacts = async (req: Request, res: Response): Promise<void> => {
//   try {
//     // Query params from frontend
//     const page = parseInt(req.query.page as string) || 1;
//     const limit = parseInt(req.query.limit as string) || 10;
//     const search = (req.query.search as string) || "";

//     const skip = (page - 1) * limit;

//     // Search condition (you can customize fields)
//     const searchQuery = search
//       ? {
//         $or: [
//           { firstName: { $regex: search, $options: "i" } },
//           { lastName: { $regex: search, $options: "i" } },
//           { email: { $regex: search, $options: "i" } },
//         ]
//       }
//       : {};

//     // Fetch data
//     const contacts = await Contact.find(searchQuery)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .populate("hospital");

//     const total = await Contact.countDocuments(searchQuery);

//     res.status(200).json({
//       success: true,
//       page,
//       limit,
//       totalContacts: total,
//       totalPages: Math.ceil(total / limit),
//       data: contacts
//     });
//   } catch (error: any) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve contacts",
//       error: error.message
//     });
//   }
// };



export const getContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const userId = req.query.userId as string; // <-- get userId

    const skip = (page - 1) * limit;

    // Base search query
    let searchQuery: any = {};

    // Add search filter
    if (search) {
      searchQuery.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Add user filter ONLY if provided
    if (userId) {
      searchQuery.user = userId; // or createdBy depending on your schema
    }

    const contacts = await Contact.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("hospital");

    const total = await Contact.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      page,
      limit,
      totalContacts: total,
      totalPages: Math.ceil(total / limit),
      data: contacts
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve contacts",
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

export const createContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, phoneNumber } = req.body;

    // Check if contact with same email or phone number already exists
    const existingContact = await Contact.findOne({
      $or: [{ email }, { phoneNumber }]
    });

    if (existingContact) {
      res.status(400).json({
        success: false,
        message: existingContact.email === email
          ? 'Contact with this email already exists'
          : 'Contact with this phone number already exists'
      });
      return;
    }

    // Associate contact with the authenticated user
    const contactData = {
      ...req.body,
      user: req.user?._id
    };

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
