import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import Hospital from '../model/Hospital.ts';
import GPO from '../model/Gpo.ts';
import IDN from '../model/Idn.ts';

// export const getHospitals = async (req: Request, res: Response): Promise<void> => {
//   try {
//     // Query params
//     const page = parseInt(req.query.page as string) || 1;
//     const limit = parseInt(req.query.limit as string) || 10;
//     const search = (req.query.search as string) || "";

//     const skip = (page - 1) * limit;

//     // Search query (adjust fields based on your schema)
//     const searchQuery = search
//       ? {
//         $or: [
//           { hospitalName: { $regex: search, $options: "i" } },
//           // { address: { $regex: search, $options: "i" } },
//           { city: { $regex: search, $options: "i" } }
//         ]
//       }
//       : {};

//     // Fetch hospitals
//     const hospitals = await Hospital.find(searchQuery)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit).populate('idn');

//     const total = await Hospital.countDocuments(searchQuery);

//     res.status(200).json({
//       success: true,
//       page,
//       limit,
//       totalHospitals: total,
//       totalPages: Math.ceil(total / limit),
//       data: hospitals
//     });
//   } catch (error: any) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve hospitals",
//       error: error.message
//     });
//   }
// };


export const getHospitals = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const idn = req.query.idn as string; // 👈 NEW

    const skip = (page - 1) * limit;

    // Base search query
    let searchQuery: any = {};

    // Search filter
    if (search) {
      searchQuery.$or = [
        { hospitalName: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } }
      ];
    }

    if (idn) { searchQuery.idn = idn; }

    // const hospitals = await Hospital.find(searchQuery)
    //   .sort({ createdAt: -1 })
    //   .skip(skip)
    //   .limit(limit)
    //   .populate('idn').populate('gpo');



    const hospitals = await Hospital.find(searchQuery)
      .select('hospitalName gpo idn')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'gpo',
        select: 'name'
      })
      .populate({
        path: 'idn',
        select: 'name'
      });






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
    const hospital = await Hospital.findById(id)
      .populate("idn", 'name')
      .populate("gpo", 'name');

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

// export const createHospital = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const hospitalData = {
//       ...req.body,
//       user: req.user?._id
//     };

//     const hospital = new Hospital(hospitalData);
//     await hospital.save();

//     res.status(201).json({
//       success: true,
//       data: hospital
//     });
//   } catch (error: any) {
//     res.status(400).json({
//       success: false,
//       message: 'Failed to create hospital',
//       error: error.message
//     });
//   }
// };



export const createHospital = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hospitalData = {
      ...req.body,
      user: req.user?._id
    };

    const hospital = new Hospital(hospitalData);
    await hospital.save();

    if (hospital.gpo) {
      await GPO.findByIdAndUpdate(hospital.gpo, { $addToSet: { hospitals: hospital._id } }
      );
    }

    if (hospital.idn) {
      await IDN.findByIdAndUpdate(hospital.idn, { $addToSet: { hospitals: hospital._id } });
    }

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








// export const deleteHospital = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { id } = req.params;
//     if (typeof id !== 'string') {
//       res.status(400).json({ success: false, message: 'Invalid ID' });
//       return;
//     }

//     const hospital = await Hospital.findByIdAndDelete(id);

//     if (!hospital) {
//       res.status(404).json({ success: false, message: 'Hospital not found' });
//       return;
//     }

//     res.status(200).json({ success: true, message: 'Hospital deleted successfully' });
//   } catch (error: any) {
//     res.status(500).json({ success: false, message: 'Error deleting hospital', error: error.message });
//   }
// };


export const deleteHospital = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }

    const hospital = await Hospital.findById(id);

    if (!hospital) {
      res.status(404).json({ success: false, message: 'Hospital not found' });
      return;
    }

    if (hospital.gpo) {
      await GPO.findByIdAndUpdate(
        hospital.gpo,
        { $pull: { hospitals: hospital._id } }
      );
    }

    if (hospital.idn) {
      await IDN.findByIdAndUpdate(
        hospital.idn,
        { $pull: { hospitals: hospital._id } }
      );
    }

    await Hospital.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Hospital deleted successfully'
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error deleting hospital',
      error: error.message
    });
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



export const getHospitalsByIDN = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idnId } = req.params;

    if (!idnId) {
      res.status(400).json({ message: 'IDN ID is required' });
      return;
    }

    const hospitals = await Hospital.find({ idn: idnId })
      .select('_id hospitalName')
      .sort({ hospitalName: 1 });

    res.status(200).json({
      success: true,
      count: hospitals.length,
      data: hospitals
    });

  } catch (error) {
    console.error('Error fetching hospitals by IDN:', error);
    res.status(500).json({ message: 'Server error' });
  }
};






/*
export const getAllHospitalsDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const hospitals = await Hospital.find().populate('gpo idn')

    res.status(200).json({
      success: true,
      data: hospitals
    });

  } catch (error) {
    console.error('Error fetching hospitalsDeals:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
*/

export const getAllHospitalsDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const hospitals = await Hospital.aggregate([
      // 1. Lookup Deals
      {
        $lookup: {
          from: 'deals',
          localField: '_id',
          foreignField: 'hospital',
          as: 'deals'
        }
      },

      // 2. Lookup IDN
      {
        $lookup: {
          from: 'idns',
          let: { idnId: '$idn' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$idnId'] }
              }
            },
            {
              $project: {
                name: 1,
                user: 1
              }
            }
          ],
          as: 'idn'
        }
      },
      {
        $unwind: {
          path: '$idn',
          preserveNullAndEmptyArrays: true
        }
      },

      // 3. Lookup GPO
      {
        $lookup: {
          from: 'gpos',
          let: { gpoId: '$gpo' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$gpoId'] }
              }
            },
            {
              $project: {
                name: 1,
                user: 1
              }
            }
          ],
          as: 'gpo'
        }
      },
      {
        $unwind: {
          path: '$gpo',
          preserveNullAndEmptyArrays: true
        }
      },

      // 4. Populate products inside deals
      {
        $lookup: {
          from: 'products',
          localField: 'deals.products.product',
          foreignField: '_id',
          as: 'productsData'
        }
      },

      // 5. Merge product data into deals.products
      {
        $addFields: {
          deals: {
            $map: {
              input: '$deals',
              as: 'deal',
              in: {
                $mergeObjects: [
                  '$$deal',
                  {
                    products: {
                      $map: {
                        input: '$$deal.products',
                        as: 'prod',
                        in: {
                          $mergeObjects: [
                            '$$prod',
                            {
                              product: {
                                $arrayElemAt: [
                                  {
                                    $filter: {
                                      input: '$productsData',
                                      as: 'p',
                                      cond: { $eq: ['$$p._id', '$$prod.product'] }
                                    }
                                  },
                                  0
                                ]
                              }
                            }
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      },

      // Optional: remove temp field
      {
        $project: {
          productsData: 0
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: hospitals
    });

  } catch (error) {
    console.error('Error fetching hospitals with deals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};