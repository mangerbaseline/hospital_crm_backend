import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import Deal from '../model/deal.ts';
import mongoose from 'mongoose';
import Product from '../model/Product.ts';


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

/*
export const getDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const searchQuery = (req.query.search as string) || "";
    const userId = req.query.userId as string;

    const matchStage: any = {};

    // ✅ Filter by userId
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
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

            // ✅ Hospital
            {
              $lookup: {
                from: "hospitals",
                localField: "hospital",
                foreignField: "_id",
                as: "hospital"
              }
            },
            { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },

            // ✅ IDN
            {
              $lookup: {
                from: "idns",
                localField: "hospital.idn",
                foreignField: "_id",
                as: "idn"
              }
            },
            { $unwind: { path: "$idn", preserveNullAndEmptyArrays: true } },

            // ✅ GPO
            {
              $lookup: {
                from: "gpos",
                localField: "hospital.gpo",
                foreignField: "_id",
                as: "gpo"
              }
            },
            { $unwind: { path: "$gpo", preserveNullAndEmptyArrays: true } },

            // ✅ Product
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

            // ✅ User
            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
              }
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

            // ✅ Final shape
            {
              $project: {
                dealId: "$_id",

                hospital: {
                  _id: "$hospital._id",
                  hospitalName: "$hospital.hospitalName",
                  city: "$hospital.city",
                  state: "$hospital.state",
                  zip: "$hospital.zip",

                  idn: {
                    _id: "$idn._id",
                    name: "$idn.name"
                  },

                  gpo: {
                    _id: "$gpo._id",
                    name: "$gpo.name"
                  }
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
          // ✅ 3. PRODUCT ARR
          // =========================
          productRevenue: [
            {
              $unwind: "$products"
            },
            {
              $group: {
                _id: "$products.product",
                ARR: {
                  $sum: {
                    $ifNull: ["$products.dealAmount", 0]
                  }
                }
              }
            },

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
                ARR: 1
              }
            },

            { $sort: { ARR: -1 } }
          ],

          // =========================
          // ✅ 4. CLOSED BUSINESS COUNT
          // =========================
          closedBusiness: [
            {
              $unwind: "$products"
            },
            {
              $match: {
                "products.stage": "Closed Won"
              }
            },
            {
              $count: "count"
            }
          ]
        }
      }
    ];

    const result = await Deal.aggregate(pipeline);

    const deals = result[0]?.deals || [];
    const totalHospitals = result[0]?.totalHospitals[0]?.count || 0;
    const productRevenue = result[0]?.productRevenue || [];
    const closedBusiness = result[0]?.closedBusiness[0]?.count || 0;

    res.status(200).json({
      success: true,
      totalDeals: deals.length,
      totalHospitals,
      closedBusiness,
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
*/


export const getDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const searchQuery = (req.query.search as string) || "";
    const userId = req.query.userId as string;

    const matchStage: any = {};

    // ✅ Filter by userId
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      matchStage.user = new mongoose.Types.ObjectId(userId);
    }

    // =========================
    // ✅ 1. DEAL PIPELINE
    // =========================
    const pipeline: any[] = [
      { $match: matchStage },

      {
        $facet: {
          // =========================
          // DEALS DATA
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

            // Hospital
            {
              $lookup: {
                from: "hospitals",
                localField: "hospital",
                foreignField: "_id",
                as: "hospital"
              }
            },
            { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },

            // IDN
            {
              $lookup: {
                from: "idns",
                localField: "hospital.idn",
                foreignField: "_id",
                as: "idn"
              }
            },
            { $unwind: { path: "$idn", preserveNullAndEmptyArrays: true } },

            // GPO
            {
              $lookup: {
                from: "gpos",
                localField: "hospital.gpo",
                foreignField: "_id",
                as: "gpo"
              }
            },
            { $unwind: { path: "$gpo", preserveNullAndEmptyArrays: true } },

            // Product
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

            // User
            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
              }
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

            // Final shape
            {
              $project: {
                dealId: "$_id",

                hospital: {
                  hospitalName: "$hospital.hospitalName",
                  city: "$hospital.city",
                  state: "$hospital.state",
                  zip: "$hospital.zip",
                  idn: {
                    _id: "$idn._id",
                    name: "$idn.name"
                  },
                  gpo: {
                    _id: "$gpo._id",
                    name: "$gpo.name"
                  }
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
          // TOTAL HOSPITALS
          // =========================
          totalHospitals: [
            {
              $group: {
                _id: "$hospital"
              }
            },
            { $count: "count" }
          ],

          // =========================
          // CLOSED BUSINESS
          // =========================
          closedBusiness: [
            { $unwind: "$products" },
            {
              $match: {
                "products.stage": "Closed Won"
              }
            },
            { $count: "count" }
          ]
        }
      }
    ];

    const result = await Deal.aggregate(pipeline);

    const deals = result[0]?.deals || [];
    const totalHospitals = result[0]?.totalHospitals[0]?.count || 0;
    const closedBusiness = result[0]?.closedBusiness[0]?.count || 0;

    // =========================
    // ✅ 2. PRODUCT REVENUE (SEPARATE FIX)
    // =========================
    const productRevenue = await Product.aggregate([
      {
        $lookup: {
          from: "deals",
          let: { productId: "$_id" },
          pipeline: [
            { $match: matchStage },
            { $unwind: "$products" },
            {
              $match: {
                $expr: {
                  $eq: ["$products.product", "$$productId"]
                }
              }
            }
          ],
          as: "dealData"
        }
      },
      {
        $addFields: {
          ARR: {
            $sum: {
              $map: {
                input: "$dealData",
                as: "d",
                in: {
                  $ifNull: ["$$d.products.dealAmount", 0]
                }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          productName: "$name",
          ARR: 1
        }
      },
      { $sort: { ARR: -1 } }
    ]);

    // =========================
    // ✅ FINAL RESPONSE
    // =========================
    res.status(200).json({
      success: true,
      totalDeals: deals.length,
      totalHospitals,
      closedBusiness,
      productRevenue, // ✅ always returns (even if 0)
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

/*
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
*/



export const updateDealProductStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dealId, productId, stage } = req.body;

    // ✅ Validation
    if (!dealId || !productId || !stage) {
      res.status(400).json({
        success: false,
        message: "dealId, productId and stage are required"
      });
      return;
    }

    // ✅ Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(dealId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid ObjectId(s)"
      });
      return;
    }

    // ✅ Update stage (no hospital filter)
    const updatedDeal = await Deal.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(dealId),
        "products.product": new mongoose.Types.ObjectId(productId)
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











export const removeProductFromDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hospitalId, productId } = req.query;

    if (!hospitalId || !productId) {
      res.status(400).json({
        success: false,
        message: "hospitalId and productId are required"
      });
      return;
    }

    const updatedDeal = await Deal.findOneAndUpdate(
      {
        hospital: hospitalId,
        "products.product": productId
      },
      {
        $pull: {
          products: { product: productId }
        }
      },
      { new: true }
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
      message: "Product removed successfully",
      data: updatedDeal
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to remove product",
      error: error.message
    });
  }
};