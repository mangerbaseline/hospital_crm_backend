import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import Deal from '../model/deal.ts';
import mongoose from 'mongoose';



/*
export const getDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const searchQuery = (req.query.search as string) || "";
    const userId = req.query.userId as string;

    const query: any = {};

    // ✅ Filter by userId
    if (userId) {
      query.user = userId;
    }

    // ✅ Filter by stage
    if (searchQuery) {
      query["products.stage"] = { $regex: searchQuery, $options: "i" };
    }

    // ✅ Fetch deals with limited fields
    const deals = await Deal.find(query)
      .sort({ createdAt: -1 })
      .populate({
        path: "hospital",
        select: "hospitalName city state zip idn gpo", // 👈 only needed fields
        populate: [
          { path: "idn", select: "name" }, // 👈 only name
          { path: "gpo", select: "name" }  // 👈 only name
        ]
      })
      .populate("products.product", "name")
      .populate("user", "name email");

    // ✅ Flatten
    const flattenedDeals: any[] = [];

    deals.forEach((deal: any) => {
      if (!deal.products || deal.products.length === 0) {
        flattenedDeals.push({
          dealId: deal._id,

          hospital: deal.hospital
            ? {
              hospitalName: deal.hospital.hospitalName,
              city: deal.hospital.city,
              state: deal.hospital.state,
              zip: deal.hospital.zip,
              idn: deal.hospital.idn || null,
              gpo: deal.hospital.gpo || null
            }
            : null,

          product: null,
          dealAmount: null,
          stage: null,
          expectedCloseDate: null,
          dealDate: null,

          user: deal.user || null,
          notes: deal.notes,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt
        });
      } else {
        deal.products.forEach((prod: any) => {
          flattenedDeals.push({
            dealId: deal._id,

            // ✅ Clean hospital object
            hospital: deal.hospital
              ? {
                hospitalName: deal.hospital.hospitalName,
                city: deal.hospital.city,
                state: deal.hospital.state,
                zip: deal.hospital.zip,
                idn: deal.hospital.idn || null,
                gpo: deal.hospital.gpo || null
              }
              : null,

            // ✅ Product
            product: prod.product || null,
            dealAmount: prod.dealAmount,
            stage: prod.stage,
            expectedCloseDate: prod.expectedCloseDate,
            dealDate: prod.dealDate,

            user: deal.user || null,
            notes: deal.notes,
            createdAt: deal.createdAt,
            updatedAt: deal.updatedAt
          });
        });
      }
    });

    // ✅ Pagination after flatten
    const paginatedDeals = flattenedDeals.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      page,
      limit,
      totalDeals: flattenedDeals.length,
      totalPages: Math.ceil(flattenedDeals.length / limit),
      data: paginatedDeals
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve deals",
      error: error.message
    });
  }
};
*/
/*
export const getDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const searchQuery = (req.query.search as string) || "";
    const userId = req.query.userId as string;

    const matchStage: any = {};

    // ✅ Filter by user
    if (userId) {
      matchStage.user = new mongoose.Types.ObjectId(userId);
    }

    const pipeline: any[] = [
      { $match: matchStage },

      // ✅ Unwind products (like flattening)
      {
        $unwind: {
          path: "$products",
          preserveNullAndEmptyArrays: true
        }
      },

      // ✅ Filter by stage
      ...(searchQuery
        ? [
          {
            $match: {
              "products.stage": {
                $regex: searchQuery,
                $options: "i"
              }
            }
          }
        ]
        : []),

      // ✅ Lookup hospital
      {
        $lookup: {
          from: "hospitals",
          localField: "hospital",
          foreignField: "_id",
          as: "hospital"
        }
      },
      { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },

      // ✅ Lookup IDN
      {
        $lookup: {
          from: "idns",
          localField: "hospital.idn",
          foreignField: "_id",
          as: "hospital.idn"
        }
      },
      {
        $unwind: {
          path: "$hospital.idn",
          preserveNullAndEmptyArrays: true
        }
      },

      // ✅ Lookup GPO
      {
        $lookup: {
          from: "gpos",
          localField: "hospital.gpo",
          foreignField: "_id",
          as: "hospital.gpo"
        }
      },
      {
        $unwind: {
          path: "$hospital.gpo",
          preserveNullAndEmptyArrays: true
        }
      },

      // ✅ Lookup product
      {
        $lookup: {
          from: "products",
          localField: "products.product",
          foreignField: "_id",
          as: "products.product"
        }
      },
      {
        $unwind: {
          path: "$products.product",
          preserveNullAndEmptyArrays: true
        }
      },

      // ✅ Lookup user
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // ✅ Final shape (like your flattened object)
      {
        $project: {
          dealId: "$_id",

          hospital: {
            hospitalName: "$hospital.hospitalName",
            city: "$hospital.city",
            state: "$hospital.state",
            zip: "$hospital.zip",
            idn: {
              _id: "$hospital.idn._id",
              name: "$hospital.idn.name"
            },
            gpo: {
              _id: "$hospital.gpo._id",
              name: "$hospital.gpo.name"
            }
          },

          product: "$products.product",
          dealAmount: "$products.dealAmount",
          stage: "$products.stage",
          expectedCloseDate: "$products.expectedCloseDate",
          dealDate: "$products.dealDate",

          user: {
            _id: "$user._id",
            name: "$user.name",
            email: "$user.email"
          },

          notes: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },

      // ✅ Sort
      { $sort: { createdAt: -1 } },

      // ✅ Pagination
      { $skip: skip },
      { $limit: limit }
    ];

    const data = await Deal.aggregate(pipeline);

    // ✅ Total count (separate pipeline)
    const countPipeline = [
      { $match: matchStage },
      {
        $unwind: {
          path: "$products",
          preserveNullAndEmptyArrays: true
        }
      },
      ...(searchQuery
        ? [
          {
            $match: {
              "products.stage": {
                $regex: searchQuery,
                $options: "i"
              }
            }
          }
        ]
        : []),
      { $count: "total" }
    ];

    const countResult = await Deal.aggregate(countPipeline);
    const totalDeals = countResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      page,
      limit,
      totalDeals,
      totalPages: Math.ceil(totalDeals / limit),
      data
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve deals",
      error: error.message
    });
  }
};
*/

export const getDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const searchQuery = (req.query.search as string) || "";
    const userId = req.query.userId as string;

    const matchStage: any = {};

    if (userId) {
      matchStage.user = new mongoose.Types.ObjectId(userId);
    }

    const pipeline: any[] = [
      { $match: matchStage },

      {
        $facet: {
          // =========================
          // ✅ 1. DEALS DATA
          // =========================
          deals: [
            {
              $unwind: {
                path: "$products",
                preserveNullAndEmptyArrays: true
              }
            },

            ...(searchQuery
              ? [
                {
                  $match: {
                    "products.stage": {
                      $regex: searchQuery,
                      $options: "i"
                    }
                  }
                }
              ]
              : []),

            // Lookups (same as yours)
            {
              $lookup: {
                from: "hospitals",
                localField: "hospital",
                foreignField: "_id",
                as: "hospital"
              }
            },
            { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },

            {
              $lookup: {
                from: "products",
                localField: "products.product",
                foreignField: "_id",
                as: "products.product"
              }
            },
            {
              $unwind: {
                path: "$products.product",
                preserveNullAndEmptyArrays: true
              }
            },

            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
              }
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

            {
              $project: {
                dealId: "$_id",

                hospital: {
                  _id: "$hospital._id",
                  hospitalName: "$hospital.hospitalName",
                  city: "$hospital.city",
                  state: "$hospital.state",
                  zip: "$hospital.zip"
                },

                product: "$products.product",
                dealAmount: "$products.dealAmount",
                stage: "$products.stage",

                user: {
                  _id: "$user._id",
                  name: "$user.name"
                },

                createdAt: 1
              }
            },

            { $sort: { createdAt: -1 } }
          ],

          // =========================
          // ✅ 2. TOTAL HOSPITALS
          // =========================
          totalHospitals: [
            {
              $group: {
                _id: "$hospital"
              }
            },
            {
              $count: "count"
            }
          ],

          // =========================
          // ✅ 3. PRODUCT REVENUE (ARR)
          // =========================
          productRevenue: [
            {
              $unwind: "$products"
            },
            {
              $group: {
                _id: "$products.product",
                TotalARR: {
                  $sum: {
                    $ifNull: ["$products.dealAmount", 0]
                  }
                }
              }
            },

            // ✅ Lookup product details
            {
              $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "product"
              }
            },
            { $unwind: "$product" },

            {
              $project: {
                _id: 0,
                productId: "$product._id",
                productName: "$product.name",
                TotalARR: 1
              }
            },

            { $sort: { TotalARR: -1 } }
          ]
        }
      }
    ];

    const result = await Deal.aggregate(pipeline);

    const deals = result[0]?.deals || [];
    const totalHospitals = result[0]?.totalHospitals[0]?.count || 0;
    const productRevenue = result[0]?.productRevenue || [];

    res.status(200).json({
      success: true,
      totalDeals: deals.length,
      totalHospitals,
      productRevenue,
      data: deals
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve deals",
      error: error.message
    });
  }
};

export const getDealById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deal = await Deal.findById(id)
      .populate('hospital')
      .populate('contact')
      .populate('products')
      .populate('user', 'name email');

    if (!deal) {
      res.status(404).json({ success: false, message: 'Deal not found' });
      return;
    }

    res.status(200).json({ success: true, data: deal });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error fetching deal', error: error.message });
  }
};

export const createDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dealData = {
      ...req.body,
      user: req.user?._id
    };

    const newDeal = new Deal(dealData);
    await newDeal.save();

    res.status(201).json({
      success: true,
      data: newDeal
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: 'Failed to create deal',
      error: error.message
    });
  }
};

export const updateDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const updatedDeal = await Deal.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedDeal) {
      res.status(404).json({ success: false, message: 'Deal not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: updatedDeal
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update deal',
      error: error.message
    });
  }
};

export const deleteDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deletedDeal = await Deal.findByIdAndDelete(id);

    if (!deletedDeal) {
      res.status(404).json({ success: false, message: 'Deal not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Deal deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error deleting deal', error: error.message });
  }
};


export const updateDealProductStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dealId, hospitalId, productId, stage } = req.body;

    // ✅ Validation
    if (!dealId || !hospitalId || !productId || !stage) {
      res.status(400).json({
        success: false,
        message: "dealId, hospitalId, productId and stage are required"
      });
      return;
    }

    // ✅ Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(dealId) ||
      !mongoose.Types.ObjectId.isValid(hospitalId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid ObjectId(s)"
      });
      return;
    }

    // ✅ Update stage
    const updatedDeal = await Deal.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(dealId as string),
        hospital: new mongoose.Types.ObjectId(hospitalId as string),
        "products.product": new mongoose.Types.ObjectId(productId as string)
      },
      {
        $set: {
          "products.$.stage": stage
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedDeal) {
      res.status(404).json({
        success: false,
        message: "Deal or product not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Stage updated successfully",
      data: updatedDeal
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to update stage",
      error: error.message
    });
  }
};


export const getDealStats = async () => {
}