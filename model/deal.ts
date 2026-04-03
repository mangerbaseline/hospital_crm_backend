import mongoose, { Document, Schema } from 'mongoose';

export interface IDeal extends Document {
  hospital: mongoose.Types.ObjectId;
  contact?: mongoose.Types.ObjectId;
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
    ref: 'Contact'
  },
  products: [{
    type: String,
    enum: ['HeelPOD', 'MAC System', 'ELEVATE'],
    required: true
  }],
  currentStage: {
    type: Schema.Types.ObjectId,
    ref: 'PipelineStage',
    required: true
  },
  competitiveProduct: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  expectedValue: {
    type: Number,
    min: 0
  },
  closeDate: {
    type: Date
  },
  stageHistory: [{
    stage: {
      type: Schema.Types.ObjectId,
      ref: 'PipelineStage',
      required: true
    },
    enteredAt: {
      type: Date,
      required: true
    },
    exitedAt: {
      type: Date
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient querying
DealSchema.index({ hospital: 1 });
DealSchema.index({ currentStage: 1 });
DealSchema.index({ 'stageHistory.stage': 1 });

export default mongoose.model<IDeal>('Deal', DealSchema);