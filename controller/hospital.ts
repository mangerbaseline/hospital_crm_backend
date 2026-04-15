import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import Hospital from '../model/Hospital.ts';
import GPO from '../model/Gpo.ts';
import IDN from '../model/Idn.ts';
import mongoose from "mongoose";
import Deal from '../model/deal.ts';

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
    const search = (req.query.search as string) || "";
    const idn = req.query.idn as string;

    // Handle limit properly
    const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
    const skip = limit ? (page - 1) * limit : 0;

    // Build search query
    let searchQuery: any = {};

    if (search) {
      searchQuery.$or = [
        { hospitalName: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } }
      ];
    }

    if (idn) {
      searchQuery.idn = idn;
    }

    // Base query
    let query = Hospital.find(searchQuery)
      .select('hospitalName gpo idn')
      .sort({ createdAt: -1 })
      .populate({ path: 'gpo', select: 'name' })
      .populate({ path: 'idn', select: 'name' });

    // Apply pagination ONLY if limit exists
    if (limit) {
      query = query.skip(skip).limit(limit);
    }

    const hospitals = await query;
    const total = await Hospital.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      page: limit ? page : 1,                         // reset page if no limit
      limit: limit || total,                          // show total if no limit
      totalHospitals: total,
      totalPages: limit ? Math.ceil(total / limit) : 1, // avoid division by null
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

    // 1. Get hospital
    const hospital = await Hospital.findById(id)
      .populate("idn", "name")
      .populate("gpo", "name")
      .populate("contacts", "firstName lastName phoneNumber designation email");

    if (!hospital) {
      res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
      return;
    }

    // 2. Get deals of this hospital + populate products
    const deals = await Deal.find({ hospital: id })
      .select("products") // only products
      .populate({
        path: "products.product",
        select: "name"
      });

    // 3. Attach deals to hospital
    const responseData = {
      ...hospital.toObject(),
      deals
    };

    res.status(200).json({
      success: true,
      data: responseData
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


/*
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
*/

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
    )
      .populate("idn", "name")
      .populate("gpo", "name")
      .populate("contacts", "firstName lastName designation phoneNumber email");

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
export const getAllHospitalsDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    const userId = req.query.userId as string;

    const filterUserId = userId
      ? new mongoose.Types.ObjectId(userId)
      : null;

    const pipeline: any[] = [

      // ✅ USER FILTER
      ...(filterUserId ? [{ $match: { user: filterUserId } }] : []),

      // 1. Lookup Deals
      {
        $lookup: {
          from: "deals",
          let: { hospitalId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$hospital", "$$hospitalId"] }
              }
            },
            {
              $project: { products: 1 }
            }
          ],
          as: "deals"
        }
      },

      // ✅ FIX: Extract ALL product IDs (flatten nested arrays)
      {
        $addFields: {
          allProductIds: {
            $reduce: {
              input: "$deals",
              initialValue: [],
              in: {
                $concatArrays: [
                  "$$value",
                  {
                    $map: {
                      input: { $ifNull: ["$$this.products", []] },
                      as: "p",
                      in: "$$p.product"
                    }
                  }
                ]
              }
            }
          }
        }
      },

      // 2. Lookup IDN
      {
        $lookup: {
          from: "idns",
          let: { idnId: "$idn" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$idnId"] }
              }
            },
            { $project: { name: 1, user: 1 } }
          ],
          as: "idn"
        }
      },
      { $unwind: { path: "$idn", preserveNullAndEmptyArrays: true } },

      // 3. Lookup GPO
      {
        $lookup: {
          from: "gpos",
          let: { gpoId: "$gpo" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$gpoId"] }
              }
            },
            { $project: { name: 1, user: 1 } }
          ],
          as: "gpo"
        }
      },
      { $unwind: { path: "$gpo", preserveNullAndEmptyArrays: true } },

      // 4. Lookup Products using flattened IDs
      {
        $lookup: {
          from: "products",
          localField: "allProductIds",
          foreignField: "_id",
          as: "productsData"
        }
      },

      // 5. Merge product data (🔥 FIXED with $toString)
      {
        $addFields: {
          deals: {
            $map: {
              input: "$deals",
              as: "deal",
              in: {
                $mergeObjects: [
                  "$$deal",
                  {
                    products: {
                      $map: {
                        input: { $ifNull: ["$$deal.products", []] },
                        as: "prod",
                        in: {
                          $mergeObjects: [
                            "$$prod",
                            {
                              product: {
                                name: {
                                  $arrayElemAt: [
                                    {
                                      $map: {
                                        input: {
                                          $filter: {
                                            input: "$productsData",
                                            as: "p",
                                            cond: {
                                              $eq: [
                                                { $toString: "$$p._id" },
                                                { $toString: "$$prod.product" }
                                              ]
                                            }
                                          }
                                        },
                                        as: "matched",
                                        in: "$$matched.name"
                                      }
                                    },
                                    0
                                  ]
                                }
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

      // 🔍 SEARCH
      ...(search
        ? [{
          $match: {
            $or: [
              { hospitalName: { $regex: search, $options: "i" } },
              { city: { $regex: search, $options: "i" } },
              { "idn.name": { $regex: search, $options: "i" } },
              { "deals.products.product.name": { $regex: search, $options: "i" } }
            ]
          }
        }]
        : []),

      // 6. Final fields
      {
        $project: {
          hospitalName: 1,
          city: 1,
          state: 1,
          zip: 1,
          idn: 1,
          gpo: 1,
          deals: 1
        }
      },

      // 7. Pagination
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const result = await Hospital.aggregate(pipeline);

    const hospitals = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    res.status(200).json({
      success: true,
      page,
      limit,
      totalHospitals: total,
      totalPages: Math.ceil(total / limit),
      data: hospitals
    });

  } catch (error: any) {
    console.error("Error fetching hospitals with deals:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
*/

export const getAllHospitalsDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    const userId = req.query.userId as string;

    const filterUserId = userId
      ? new mongoose.Types.ObjectId(userId)
      : null;

    const pipeline: any[] = [

      // ✅ USER FILTER
      ...(filterUserId ? [{ $match: { user: filterUserId } }] : []),

      // 1. Lookup Deals
      {
        $lookup: {
          from: "deals",
          let: { hospitalId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$hospital", "$$hospitalId"] }
              }
            },
            {
              $project: { products: 1 }
            }
          ],
          as: "deals"
        }
      },

      // ✅ Flatten product IDs
      {
        $addFields: {
          allProductIds: {
            $reduce: {
              input: "$deals",
              initialValue: [],
              in: {
                $concatArrays: [
                  "$$value",
                  {
                    $map: {
                      input: { $ifNull: ["$$this.products", []] },
                      as: "p",
                      in: "$$p.product"
                    }
                  }
                ]
              }
            }
          }
        }
      },

      // 2. Lookup IDN
      {
        $lookup: {
          from: "idns",
          let: { idnId: "$idn" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$idnId"] } } },
            { $project: { name: 1, user: 1 } }
          ],
          as: "idn"
        }
      },
      { $unwind: { path: "$idn", preserveNullAndEmptyArrays: true } },

      // 3. Lookup GPO
      {
        $lookup: {
          from: "gpos",
          let: { gpoId: "$gpo" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$gpoId"] } } },
            { $project: { name: 1, user: 1 } }
          ],
          as: "gpo"
        }
      },
      { $unwind: { path: "$gpo", preserveNullAndEmptyArrays: true } },

      // 4. Lookup Products
      {
        $lookup: {
          from: "products",
          localField: "allProductIds",
          foreignField: "_id",
          as: "productsData"
        }
      },

      // 5. Merge + sort products
      {
        $addFields: {
          deals: {
            $map: {
              input: "$deals",
              as: "deal",
              in: {
                $mergeObjects: [
                  "$$deal",
                  {
                    products: {
                      $sortArray: {
                        input: {
                          $map: {
                            input: { $ifNull: ["$$deal.products", []] },
                            as: "prod",
                            in: {
                              $mergeObjects: [
                                "$$prod",
                                {
                                  product: {
                                    $arrayElemAt: [
                                      {
                                        $map: {
                                          input: {
                                            $filter: {
                                              input: "$productsData",
                                              as: "p",
                                              cond: {
                                                $eq: [
                                                  { $toString: "$$p._id" },
                                                  { $toString: "$$prod.product" }
                                                ]
                                              }
                                            }
                                          },
                                          as: "matched",
                                          in: "$$matched.name"
                                        }
                                      },
                                      0
                                    ]
                                  }
                                }
                              ]
                            }
                          }
                        },
                        sortBy: { expectedCloseDate: 1 } // 🔥 sort products
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      },

      // 🔥 NEW: Extract ALL expectedCloseDates
      {
        $addFields: {
          allDates: {
            $reduce: {
              input: "$deals",
              initialValue: [],
              in: {
                $concatArrays: [
                  "$$value",
                  {
                    $map: {
                      input: { $ifNull: ["$$this.products", []] },
                      as: "p",
                      in: "$$p.expectedCloseDate"
                    }
                  }
                ]
              }
            }
          }
        }
      },

      // 🔥 NEW: Get earliest date per hospital
      {
        $addFields: {
          minExpectedCloseDate: {
            $min: "$allDates"
          }
        }
      },

      // 🔍 SEARCH
      ...(search
        ? [{
          $match: {
            $or: [
              { hospitalName: { $regex: search, $options: "i" } },
              { city: { $regex: search, $options: "i" } },
              { "idn.name": { $regex: search, $options: "i" } },
              { "deals.products.product": { $regex: search, $options: "i" } }
            ]
          }
        }]
        : []),

      // 🔥 SORT HOSPITALS (MAIN REQUIREMENT)
      {
        $sort: { minExpectedCloseDate: 1 } // 👈 earliest hospital first
        // use -1 for latest first
      },

      // Final fields
      {
        $project: {
          hospitalName: 1,
          city: 1,
          state: 1,
          zip: 1,
          idn: 1,
          gpo: 1,
          deals: 1,
          minExpectedCloseDate: 1
        }
      },

      // Pagination
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const result = await Hospital.aggregate(pipeline);

    const hospitals = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    res.status(200).json({
      success: true,
      page,
      limit,
      totalHospitals: total,
      totalPages: Math.ceil(total / limit),
      data: hospitals
    });

  } catch (error: any) {
    console.error("Error fetching hospitals with deals:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};