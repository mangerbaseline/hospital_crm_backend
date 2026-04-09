import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import IDN from '../model/Idn.ts';
import Deal from '../model/deal.ts';
import Hospital from '../model/Hospital.ts';
import Product from '../model/Product.ts';

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


export const getAllIDNsDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Extract query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const userId = req.query.userId as string;

    const skip = (page - 1) * limit;

    // 2. Build search and filter query
    const query: any = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (userId) {
      // ONLY find IDNs containing hospitals created by the user
      const userHospitalIdnIds = await Hospital.find({ user: userId }).distinct('idn');

      query._id = { $in: userHospitalIdnIds.map(id => id.toString()) };
    }

    // 3. Fetch IDNs with pagination and search
    const idns = await IDN.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalIDNs = await IDN.countDocuments(query);

    // 4. Aggregate data for each IDN
    const idnsWithDeals = await Promise.all(idns.map(async (idn: any) => {
      // Hospitals belonging to this IDN (Filter by user if userId provided)
      const hospitalQuery: any = { idn: idn._id };
      if (userId) {
        hospitalQuery.user = userId;
      }

      const hospitals = await Hospital.find(hospitalQuery)
        .populate('gpo', 'name')
        .lean();

      const allDeals = await Deal.find({ idn: idn._id })
        .populate({
          path: 'products',
          populate: {
            path: 'product'
          }
        })
        .lean();

      // console.log(JSON.stringify(allDeals, null, 2));


      let idnTotalExpectedARR = 0;
      const idnARRByProduct: Record<string, number> = {};

      // Only aggregate deals for the hospitals belonging to the user (if userId provided)
      const allowedHospitalIds = hospitals.map(h => h._id.toString());
      const filteredDeals = allDeals.filter(d => allowedHospitalIds.includes(d.hospital.toString()));

      filteredDeals.forEach((deal: any) => {
        if (deal.products && Array.isArray(deal.products)) {
          deal.products.forEach((p: any) => {
            const amount = p.dealAmount || 0;
            idnTotalExpectedARR += amount;

            // Check if product is populated and has a name
            const productName = (p.product && typeof p.product === 'object' && p.product.name)
              ? p.product.name
              : 'Unknown';

            idnARRByProduct[productName] = (idnARRByProduct[productName] || 0) + amount;
          });
        }
      });

      const hospitalsWithData = hospitals.map(hospital => {
        const hospitalDeals = allDeals.filter(d => d.hospital.toString() === hospital._id.toString());

        let hospitalTotalExpectedARR = 0;
        const hospitalARRByProduct: Record<string, number> = {};

        hospitalDeals.forEach((deal: any) => {
          if (deal.products && Array.isArray(deal.products)) {
            deal.products.forEach((p: any) => {
              const amount = p.dealAmount || 0;
              hospitalTotalExpectedARR += amount;

              const productName = (p.product && typeof p.product === 'object' && p.product.name)
                ? p.product.name
                : 'Unknown';

              hospitalARRByProduct[productName] = (hospitalARRByProduct[productName] || 0) + amount;
            });
          }
        });

        return {
          ...hospital,
          totalExpectedARR: hospitalTotalExpectedARR,
          expectedARRByProduct: Object.entries(hospitalARRByProduct).map(([name, amount]) => ({ name, amount }))
        };
      });

      return {
        ...idn,
        totalHospitals: hospitals.length,
        idnTotalExpectedARR,
        idnARRByProduct: Object.entries(idnARRByProduct).map(([name, amount]) => ({ name, amount })),
        hospitals: hospitalsWithData
      };
    }));

    res.status(200).json({
      success: true,
      data: idnsWithDeals,
      pagination: {
        total: totalIDNs,
        page,
        limit,
        totalPages: Math.ceil(totalIDNs / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve IDNs and deals data',
      error: error.message
    });
  }
};