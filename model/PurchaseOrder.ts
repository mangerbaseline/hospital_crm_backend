import mongoose, { Document, Schema } from 'mongoose';

export interface IPurchaseOrder extends Document {
  pipelineStage: mongoose.Types.ObjectId;
  hospital: mongoose.Types.ObjectId;
  purchaseOrderType: 'MAC System' | 'HeelPOD' | 'ELEVATE';
  expectedARR: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  orderNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderSchema: Schema = new Schema({
  pipeline: {
    type: Schema.Types.ObjectId,
    ref: 'Pipeline',
    required: true
  },
  hospital: {
    type: Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  purchaseOrderType: {
    type: String,
    required: true,
    enum: ['MAC System', 'HeelPOD', 'ELEVATE']
  },
  expectedARR: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
    default: 'Pending'
  },
  orderNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Create indexes for efficient querying
PurchaseOrderSchema.index({ pipelineStage: 1 });
PurchaseOrderSchema.index({ hospital: 1 });
PurchaseOrderSchema.index({ status: 1 });
PurchaseOrderSchema.index({ purchaseOrderType: 1 });

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
