import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import Deal from '../model/deal.ts';
import mongoose from 'mongoose';
import Product from '../model/Product.ts';
import Hospital from '../model/Hospital.ts';


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


/*
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
*/


export const createDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { products, ...rest } = req.body;

    if (!products || !products.length) {
      res.status(400).json({
        success: false,
        message: "At least one product is required"
      });
      return;
    }

    const dealsToInsert = products.map((product: any) => ({
      ...rest,
      user: req.user?._id,
      products: [product] // only ONE product per document
    }));

    const createdDeals = await Deal.insertMany(dealsToInsert);

    res.status(201).json({
      success: true,
      count: createdDeals.length,
      data: createdDeals
    });

  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: 'Failed to create deals',
      error: error.message
    });
  }
};


/*
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
*/

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



/*
export const removeProductFromDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const hospitalId = req.query.hospitalId as string;
    const productItemId = req.query.productItemId as string; // 👈 use embedded _id

    if (!hospitalId || !productItemId) {
      res.status(400).json({
        success: false,
        message: "hospitalId and productItemId are required"
      });
      return;
    }

    const updatedDeal = await Deal.findOneAndUpdate(
      {
        hospital: hospitalId,
        "products._id": productItemId // ✅ match exact item
      },
      {
        $pull: {
          products: { _id: productItemId } // ✅ remove by _id
        }
      },
      { new: true }
    );

    if (!updatedDeal) {
      res.status(404).json({
        success: false,
        message: "Deal or product item not found"
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
*/


export const removeDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const dealId = req.params.dealId || req.query.dealId as string;

    if (!dealId) {
      res.status(400).json({
        success: false,
        message: "dealId is required"
      });
      return;
    }

    const deletedDeal = await Deal.findByIdAndDelete(dealId);

    if (!deletedDeal) {
      res.status(404).json({
        success: false,
        message: "Deal not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Deal deleted successfully",
      data: deletedDeal
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to delete deal",
      error: error.message
    });
  }
};

/*
export const addProductToDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const hospitalId = req.query.hospitalId as string;

    const {
      product,
      dealAmount,
      stage,
      expectedCloseDate,
      dealDate
    } = req.body;

    if (!hospitalId || !product) {
      res.status(400).json({
        success: false,
        message: "hospitalId and product are required"
      });
      return;
    }

    const newProduct = {
      product,
      dealAmount,
      stage,
      expectedCloseDate,
      dealDate
    };

    const updatedDeal = await Deal.findOneAndUpdate(
      { hospital: hospitalId },
      {
        $push: {
          products: newProduct
        }
      },
      { new: true }
    );

    if (!updatedDeal) {
      res.status(404).json({
        success: false,
        message: "Deal not found for this hospital"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Product added successfully",
      data: updatedDeal
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to add product",
      error: error.message
    });
  }
};
*/

export const addProductToDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const hospitalId = req.query.hospitalId as string;

    const {
      product,
      dealAmount,
      stage,
      expectedCloseDate,
      dealDate,
      idn,
      gpo
    } = req.body;

    if (!hospitalId || !product || !idn || !gpo) {
      res.status(400).json({
        success: false,
        message: "hospitalId, product, idn and gpo are required"
      });
      return;
    }

    const newDeal = new Deal({
      hospital: hospitalId,
      idn,
      gpo,
      user: (req as any).user?._id, // if using auth
      products: [
        {
          product,
          dealAmount,
          stage,
          expectedCloseDate,
          dealDate
        }
      ]
    });

    await newDeal.save();

    res.status(201).json({
      success: true,
      message: "Deal created successfully",
      data: newDeal
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to create deal",
      error: error.message
    });
  }
};

/*
export const updateProductInDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const hospitalId = req.query.hospitalId as string;
    const productItemId = req.query.productItemId as string; // 👈 THIS is products._id

    const {
      dealAmount,
      stage,
      expectedCloseDate,
      dealDate
    } = req.body;

    if (!hospitalId || !productItemId) {
      res.status(400).json({
        success: false,
        message: "hospitalId and productItemId are required"
      });
      return;
    }

    const updateFields: any = {};

    if (dealAmount !== undefined) updateFields["products.$.dealAmount"] = dealAmount;
    if (stage) updateFields["products.$.stage"] = stage;
    if (expectedCloseDate) updateFields["products.$.expectedCloseDate"] = expectedCloseDate;
    if (dealDate) updateFields["products.$.dealDate"] = dealDate;

    const updatedDeal = await Deal.findOneAndUpdate(
      {
        hospital: hospitalId,
        "products._id": productItemId // ✅ match by embedded _id
      },
      {
        $set: updateFields
      },
      { new: true, runValidators: true }
    );

    if (!updatedDeal) {
      res.status(404).json({
        success: false,
        message: "Deal or product item not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedDeal
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message
    });
  }
};
*/

export const updateDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const dealId = req.params.dealId || (req.query.dealId as string);

    const {
      dealAmount,
      stage,
      expectedCloseDate,
      dealDate,
      product
    } = req.body;

    if (!dealId) {
      res.status(400).json({
        success: false,
        message: "dealId is required"
      });
      return;
    }

    const updateFields: any = {};

    if (product) updateFields["products.0.product"] = product;
    if (dealAmount !== undefined) updateFields["products.0.dealAmount"] = dealAmount;
    if (stage) updateFields["products.0.stage"] = stage;
    if (expectedCloseDate) updateFields["products.0.expectedCloseDate"] = expectedCloseDate;
    if (dealDate) updateFields["products.0.dealDate"] = dealDate;

    const updatedDeal = await Deal.findByIdAndUpdate(
      dealId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedDeal) {
      res.status(404).json({
        success: false,
        message: "Deal not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Deal updated successfully",
      data: updatedDeal
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to update deal",
      error: error.message
    });
  }
};


export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const objectUserId = new mongoose.Types.ObjectId(userId);

    // 🔥 Parallel counts
    const [
      totalHospitals,
      totalHospitalsInDB,
      totalProductsInDB
    ] = await Promise.all([
      Hospital.countDocuments({ user: objectUserId }),
      Hospital.countDocuments({}),
      Product.countDocuments({})
    ]);

    // 🔥 Aggregation
    const result = await Deal.aggregate([
      { $match: { user: objectUserId } },
      { $unwind: "$products" },

      {
        $facet: {
          // ================= TOTALS =================
          totals: [
            {
              $group: {
                _id: null,

                totalPipelineAmount: {
                  $sum: "$products.dealAmount"
                },

                closedWonAmount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$products.stage", "Closed Won"] },
                      "$products.dealAmount",
                      0
                    ]
                  }
                },

                implementedAmount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$products.stage", "Implemented"] },
                      "$products.dealAmount",
                      0
                    ]
                  }
                }
              }
            }
          ],

          // ================= PIPELINE =================
          pipeline: [
            {
              $group: {
                _id: "$products.stage",
                amount: { $sum: "$products.dealAmount" },
                hospitals: { $addToSet: "$hospital" }
              }
            },
            {
              $project: {
                _id: 0,
                stage: "$_id",
                amount: 1,
                hospitalCount: { $size: "$hospitals" }
              }
            }
          ],

          // ================= CLOSED WON =================
          closedWon: [
            {
              $match: { "products.stage": "Closed Won" }
            },
            {
              $group: {
                _id: "$hospital",
                products: {
                  $push: {
                    _id: "$products._id",
                    product: "$products.product",
                    dealAmount: "$products.dealAmount",
                    stage: "$products.stage",
                    expectedCloseDate: "$products.expectedCloseDate",
                    dealDate: "$products.dealDate"
                  }
                }
              }
            },
            {
              $lookup: {
                from: "hospitals",
                localField: "_id",
                foreignField: "_id",
                as: "hospital"
              }
            },
            { $unwind: "$hospital" },
            {
              $project: {
                _id: "$hospital._id",
                hospitalName: "$hospital.hospitalName",
                products: 1
              }
            }
          ],

          // ================= IMPLEMENTED =================
          implemented: [
            {
              $match: { "products.stage": "Implemented" }
            },
            {
              $group: {
                _id: "$hospital",
                products: {
                  $push: {
                    _id: "$products._id",
                    product: "$products.product",
                    dealAmount: "$products.dealAmount",
                    stage: "$products.stage",
                    expectedCloseDate: "$products.expectedCloseDate",
                    dealDate: "$products.dealDate"
                  }
                }
              }
            },
            {
              $lookup: {
                from: "hospitals",
                localField: "_id",
                foreignField: "_id",
                as: "hospital"
              }
            },
            { $unwind: "$hospital" },
            {
              $project: {
                _id: "$hospital._id",
                hospitalName: "$hospital.hospitalName",
                products: 1
              }
            }
          ]
        }
      }
    ]);

    const data = result[0];

    // 🔥 Final response
    res.status(200).json({
      success: true,
      data: {
        totalHospitals,
        totalHospitalsInDB,
        totalProductsInDB,

        totalPipelineAmount: data.totals[0]?.totalPipelineAmount || 0,

        closedWon: {
          amount: data.totals[0]?.closedWonAmount || 0,
          hospitals: data.closedWon || []
        },

        implemented: {
          amount: data.totals[0]?.implementedAmount || 0,
          hospitals: data.implemented || []
        },

        pipeline: data.pipeline || []
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message
    });
  }
};