import type { Request, Response } from 'express';
import Task from '../model/Task.ts';
import Notes from '../model/Notes.ts';
import CallLogs from '../model/CallLogs.ts';
import mongoose from "mongoose";

export const getActivities = async (req: Request, res: Response): Promise<void> => {
    try {
        const hospitalId = req.query.hospitalId as string;
        const userId = req.query.userId as string;
        const limit = parseInt(req.query.limit as string) || 20;

        const filter: any = {};
        if (hospitalId) filter.hospital = new mongoose.Types.ObjectId(hospitalId);
        if (userId) filter.user = new mongoose.Types.ObjectId(userId);

        const pipeline: any[] = [
            // 1. Start with Tasks
            { $match: filter },
            { $addFields: { activityType: 'task' } },

            // 2. Union with Notes
            {
                $unionWith: {
                    coll: 'notes', 
                    pipeline: [
                        { $match: filter },
                        { $addFields: { activityType: 'note' } }
                    ]
                }
            },

            // 3. Union with CallLogs
            {
                $unionWith: {
                    coll: 'calllogs',
                    pipeline: [
                        { $match: filter },
                        { $addFields: { activityType: 'callLog' } }
                    ]
                }
            },

            // 4. Sort all combined activities by createdAt
            { $sort: { createdAt: -1 } },

            // 5. Global Limit
            { $limit: limit },

            // 6. Final Populates (Lookup)
            {
                $lookup: {
                    from: 'hospitals',
                    localField: 'hospital',
                    foreignField: '_id',
                    pipeline: [{ $project: { hospitalName: 1 } }],
                    as: 'hospital'
                }
            },
            { $unwind: { path: '$hospital', preserveNullAndEmptyArrays: true } },
            
            {
                $lookup: {
                    from: 'contacts',
                    localField: 'contact',
                    foreignField: '_id',
                    pipeline: [{ $project: { firstName: 1 } }],
                    as: 'contact'
                }
            },
            { $unwind: { path: '$contact', preserveNullAndEmptyArrays: true } }
        ];

        const combinedActivities = await Task.aggregate(pipeline);

        res.status(200).json({
            success: true,
            total: combinedActivities.length,
            data: combinedActivities
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: "Failed to aggregate activities",
            error: error.message
        });
    }
};