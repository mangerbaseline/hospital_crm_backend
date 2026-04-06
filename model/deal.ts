import mongoose, { Document, Schema } from 'mongoose';

export interface IDeal extends Document {
  hospital: mongoose.Types.ObjectId;
  contact?: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  gpo: mongoose.Types.ObjectId;
  idn: mongoose.Types.ObjectId;
  products: mongoose.Types.ObjectId[];
  currentStage: mongoose.Types.ObjectId;
  teamHospital: boolean;
  magnetHospital: boolean;
  competitiveProduct?: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
  expectedValue?: number;
  closeDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DealSchema: Schema = new Schema({
  hospital: {
    type: Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  idn: {
    type: Schema.Types.ObjectId,
    ref: 'IDN',
    required: true
  },
  gpo: {
    type: Schema.Types.ObjectId,
    ref: 'GPO',
    required: true
  },
  contact: {
    type: Schema.Types.ObjectId,
    ref: 'Contact',
    required: true
  },
  products: [
    {
      product: { type: Schema.Types.ObjectId, ref: "Product" },
      dealAmount: Number,
      stage: String,
      expectedCloseDate: Date
    }
  ],
  competitiveProduct: {
    type: String,
    trim: true
  },
  teamHospital: {
    type: Boolean,
    required: true
  },
  magnetHospital: {
    type: Boolean,
    required: true
  },
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