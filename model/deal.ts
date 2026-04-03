import mongoose, { Document, Schema } from 'mongoose';

export interface IDeal extends Document {
  hospital: mongoose.Types.ObjectId;
  contact?: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  products: string[];
  currentStage: mongoose.Types.ObjectId;
  competitiveProduct?: string;
  notes?: string;
  expectedValue?: number;
  closeDate?: Date;
  stageHistory: {
    stage: mongoose.Types.ObjectId;
    enteredAt: Date;
    exitedAt?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const DealSchema: Schema = new Schema({
  hospital: {
    type: Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  contact: {
    type: Schema.Types.ObjectId,
    ref: 'Contact',
    required: true
  },
  products: [{
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  }],
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentPipelineStage: {
    type: String,
    required: true,
    enum: ['Demo', 'CPA', 'Committee', 'Trial', 'Pending Decision', 'Closed Won', 'Implemented'],
    trim: true
  },
  expectedValue: {
    type: Number,
    min: 0
  },
  closeDate: {
    type: Date
  },

}, {
  timestamps: true
});

export default mongoose.model<IDeal>('Deal', DealSchema);