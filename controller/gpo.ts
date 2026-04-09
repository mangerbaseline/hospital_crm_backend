import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import GPOModel from '../model/Gpo.ts';
import Deal from '../model/deal.ts';
import Hospital from '../model/Hospital.ts';
import Product from '../model/Product.ts';
import mongoose from "mongoose";

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
      .limit(limit).select("name");

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

/*
export const getAllGPODeals = async (req: Request, res: Response): Promise<void> => {
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
      // ONLY find GPOs containing hospitals created by the user
      const userHospitalGpoIds = await Hospital.find({ user: userId }).distinct('gpo');

      query._id = { $in: userHospitalGpoIds.map(id => id.toString()) };
    }

    // 3. Fetch GPOs with pagination and search
    const gpos = await GPOModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalGPOs = await GPOModel.countDocuments(query);

    // 4. Aggregate data for each GPO
    const gposWithDeals = await Promise.all(gpos.map(async (gpo: any) => {
      // Hospitals belonging to this GPO (Filter by user if userId provided)
      const hospitalQuery: any = { gpo: gpo._id };
      if (userId) {
        hospitalQuery.user = userId;
      }

      const hospitals = await Hospital.find(hospitalQuery)
        .populate('idn', 'name') // GPO details often list IDN info for hospitals
        .lean();

      // All deals for this GPO to aggregate ARR
      const allDeals = await Deal.find({ gpo: gpo._id })
        .populate({
          path: 'products',
          populate: {
            path: 'product'
          }
        })
        .lean();

      let gpoTotalExpectedARR = 0;
      const gpoARRByProduct: Record<string, number> = {};

      // Only aggregate deals for the hospitals belonging to the user (if userId provided)
      const allowedHospitalIds = hospitals.map(h => h._id.toString());
      const filteredDeals = allDeals.filter(d => allowedHospitalIds.includes(d.hospital.toString()));

      filteredDeals.forEach((deal: any) => {
        if (deal.products && Array.isArray(deal.products)) {
          deal.products.forEach((p: any) => {
            const amount = p.dealAmount || 0;
            gpoTotalExpectedARR += amount;

            const productName = (p.product && typeof p.product === 'object' && p.product.name)
              ? p.product.name
              : 'Unknown';

            gpoARRByProduct[productName] = (gpoARRByProduct[productName] || 0) + amount;
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
        ...gpo,
        totalHospitals: hospitals.length,
        gpoTotalExpectedARR,
        gpoARRByProduct: Object.entries(gpoARRByProduct).map(([name, amount]) => ({ name, amount })),
        hospitals: hospitalsWithData
      };
    }));

    res.status(200).json({
      success: true,
      data: gposWithDeals,
      pagination: {
        total: totalGPOs,
        page,
        limit,
        totalPages: Math.ceil(totalGPOs / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve GPOs and deals data',
      error: error.message
    });
  }
};
*/

/*
export const getAllGPODeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const userId = req.query.userId as string;

    const skip = (page - 1) * limit;

    const matchStage: any = {};
    if (search) {
      matchStage.name = { $regex: search, $options: "i" };
    }

    const hospitalMatch: any = { $expr: { $eq: ["$gpo", "$$gpoId"] } };
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      hospitalMatch.user = new mongoose.Types.ObjectId(userId);
    }

    const pipeline: any[] = [
      { $match: matchStage },

      // ✅ Step 1: Get hospitals (Filtered by user if userId provided)
      {
        $lookup: {
          from: "hospitals",
          let: { gpoId: "$_id" },
          pipeline: [
            { $match: hospitalMatch },
            {
              $lookup: {
                from: "idns",
                localField: "idn",
                foreignField: "_id",
                as: "idn"
              }
            },
            { $unwind: { path: "$idn", preserveNullAndEmptyArrays: true } }
          ],
          as: "hospitals"
        }
      },

      // ❌ If userId is provided, remove GPOs with no user hospitals
      ...(userId && mongoose.Types.ObjectId.isValid(userId) ? [{
        $match: {
          "hospitals.0": { $exists: true }
        }
      }] : []),

      // ✅ Step 2: Extract hospitalIds
      {
        $addFields: {
          hospitalIds: "$hospitals._id"
        }
      },

      // ✅ Step 3: Fetch ONLY relevant deals
      {
        $lookup: {
          from: "deals",
          let: { hospitalIds: "$hospitalIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$hospital", "$$hospitalIds"]
                }
              }
            },
            { $unwind: "$products" },

            {
              $lookup: {
                from: "products",
                localField: "products.product",
                foreignField: "_id",
                as: "product"
              }
            },
            { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } }
          ],
          as: "deals"
        }
      },

      // ✅ Step 4: Hospital-level aggregation
      {
        $addFields: {
          hospitals: {
            $map: {
              input: "$hospitals",
              as: "h",
              in: {
                _id: "$$h._id",
                hospitalName: "$$h.hospitalName",
                idn: "$$h.idn",

                totalExpectedARR: {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$deals",
                          as: "d",
                          cond: { $eq: ["$$d.hospital", "$$h._id"] }
                        }
                      },
                      as: "d",
                      in: { $ifNull: ["$$d.products.dealAmount", 0] }
                    }
                  }
                },

                expectedARRByProduct: {
                  $map: {
                    input: {
                      $setUnion: [
                        {
                          $map: {
                            input: {
                              $filter: {
                                input: "$deals",
                                as: "d",
                                cond: { $eq: ["$$d.hospital", "$$h._id"] }
                              }
                            },
                            as: "d",
                            in: "$$d.product.name"
                          }
                        }
                      ]
                    },
                    as: "productName",
                    in: {
                      name: "$$productName",
                      amount: {
                        $sum: {
                          $map: {
                            input: {
                              $filter: {
                                input: "$deals",
                                as: "d",
                                cond: {
                                  $and: [
                                    { $eq: ["$$d.hospital", "$$h._id"] },
                                    { $eq: ["$$d.product.name", "$$productName"] }
                                  ]
                                }
                              }
                            },
                            as: "d",
                            in: { $ifNull: ["$$d.products.dealAmount", 0] }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // ✅ Step 5: GPO totals
      {
        $addFields: {
          gpoTotalExpectedARR: {
            $sum: "$deals.products.dealAmount"
          }
        }
      },

      // ✅ Step 6: GPO product grouping
      {
        $addFields: {
          gpoARRByProduct: {
            $map: {
              input: {
                $setUnion: [
                  {
                    $map: {
                      input: "$deals",
                      as: "d",
                      in: "$$d.product.name"
                    }
                  }
                ]
              },
              as: "productName",
              in: {
                name: "$$productName",
                amount: {
                  $sum: {
                    $map: {
                      input: "$deals",
                      as: "d",
                      in: {
                        $cond: [
                          { $eq: ["$$d.product.name", "$$productName"] },
                          { $ifNull: ["$$d.products.dealAmount", 0] },
                          0
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      {
        $addFields: {
          totalHospitals: { $size: "$hospitals" }
        }
      },

      {
        $project: {
          deals: 0,
          hospitalIds: 0
        }
      },

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const gpos = await GPOModel.aggregate(pipeline);

    // ✅ correct total count
    const totalPipeline: any[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: "hospitals",
          let: { gpoId: "$_id" },
          pipeline: [{ $match: hospitalMatch }],
          as: "hospitals"
        }
      }
    ];

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      totalPipeline.push({ $match: { "hospitals.0": { $exists: true } } });
    }
    totalPipeline.push({ $count: "total" });

    const totalResult = await GPOModel.aggregate(totalPipeline);

    const total = totalResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: gpos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve GPOs and deals data",
      error: error.message
    });
  }
};
*/

export const getAllGPODeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const userId = req.query.userId as string;

    const skip = (page - 1) * limit;

    // ✅ Safe ObjectId
    const userObjectId =
      userId && mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : null;

    const matchStage: any = {};
    if (search) {
      matchStage.name = { $regex: search, $options: "i" };
    }

    const pipeline: any[] = [
      { $match: matchStage },

      // 🔥 STEP 1: Hospitals lookup (dynamic like IDN)
      {
        $lookup: {
          from: "hospitals",
          let: { gpoId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: userObjectId
                  ? {
                    $and: [
                      { $eq: ["$gpo", "$$gpoId"] },
                      { $eq: ["$user", userObjectId] }
                    ]
                  }
                  : {
                    $eq: ["$gpo", "$$gpoId"]
                  }
              }
            },
            {
              $lookup: {
                from: "idns",
                localField: "idn",
                foreignField: "_id",
                as: "idn"
              }
            },
            { $unwind: { path: "$idn", preserveNullAndEmptyArrays: true } }
          ],
          as: "hospitals"
        }
      },

      // 🔥 STEP 2: Remove empty GPOs ONLY if userId exists
      ...(userObjectId
        ? [
          {
            $match: {
              "hospitals.0": { $exists: true }
            }
          }
        ]
        : []),

      // 🔥 STEP 3: Extract hospitalIds
      {
        $addFields: {
          hospitalIds: "$hospitals._id"
        }
      },

      // 🔥 STEP 4: Deals lookup (ONLY from those hospitals)
      {
        $lookup: {
          from: "deals",
          let: { hospitalIds: "$hospitalIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$hospital", "$$hospitalIds"]
                }
              }
            },
            { $unwind: "$products" },
            {
              $lookup: {
                from: "products",
                localField: "products.product",
                foreignField: "_id",
                as: "product"
              }
            },
            { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } }
          ],
          as: "deals"
        }
      },

      // 🔥 STEP 5: Hospital-level aggregation
      {
        $addFields: {
          hospitals: {
            $map: {
              input: "$hospitals",
              as: "h",
              in: {
                _id: "$$h._id",
                hospitalName: "$$h.hospitalName",
                idn: "$$h.idn",

                totalExpectedARR: {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$deals",
                          as: "d",
                          cond: { $eq: ["$$d.hospital", "$$h._id"] }
                        }
                      },
                      as: "d",
                      in: { $ifNull: ["$$d.products.dealAmount", 0] }
                    }
                  }
                },

                expectedARRByProduct: {
                  $map: {
                    input: {
                      $setUnion: [
                        {
                          $map: {
                            input: {
                              $filter: {
                                input: "$deals",
                                as: "d",
                                cond: { $eq: ["$$d.hospital", "$$h._id"] }
                              }
                            },
                            as: "d",
                            in: "$$d.product.name"
                          }
                        }
                      ]
                    },
                    as: "productName",
                    in: {
                      name: "$$productName",
                      amount: {
                        $sum: {
                          $map: {
                            input: {
                              $filter: {
                                input: "$deals",
                                as: "d",
                                cond: {
                                  $and: [
                                    { $eq: ["$$d.hospital", "$$h._id"] },
                                    { $eq: ["$$d.product.name", "$$productName"] }
                                  ]
                                }
                              }
                            },
                            as: "d",
                            in: { $ifNull: ["$$d.products.dealAmount", 0] }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // 🔥 STEP 6: GPO totals
      {
        $addFields: {
          gpoTotalExpectedARR: {
            $sum: "$deals.products.dealAmount"
          }
        }
      },

      // 🔥 STEP 7: GPO product grouping
      {
        $addFields: {
          gpoARRByProduct: {
            $map: {
              input: {
                $setUnion: [
                  {
                    $map: {
                      input: "$deals",
                      as: "d",
                      in: "$$d.product.name"
                    }
                  }
                ]
              },
              as: "productName",
              in: {
                name: "$$productName",
                amount: {
                  $sum: {
                    $map: {
                      input: "$deals",
                      as: "d",
                      in: {
                        $cond: [
                          { $eq: ["$$d.product.name", "$$productName"] },
                          { $ifNull: ["$$d.products.dealAmount", 0] },
                          0
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      {
        $addFields: {
          totalHospitals: { $size: "$hospitals" }
        }
      },

      {
        $project: {
          deals: 0,
          hospitalIds: 0
        }
      },

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const gpos = await GPOModel.aggregate(pipeline);

    // ✅ Pagination count
    const totalPipeline: any[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: "hospitals",
          let: { gpoId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: userObjectId
                  ? {
                    $and: [
                      { $eq: ["$gpo", "$$gpoId"] },
                      { $eq: ["$user", userObjectId] }
                    ]
                  }
                  : {
                    $eq: ["$gpo", "$$gpoId"]
                  }
              }
            }
          ],
          as: "hospitals"
        }
      },
      ...(userObjectId
        ? [{ $match: { "hospitals.0": { $exists: true } } }]
        : []),
      { $count: "total" }
    ];

    const totalResult = await GPOModel.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: gpos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve GPOs and deals data",
      error: error.message
    });
  }
};