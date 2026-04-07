import mongoose, { Document, Schema } from 'mongoose';

export interface IDealProduct {
  product: mongoose.Types.ObjectId;
  dealAmount?: number;
  stage?: string;
  expectedCloseDate?: Date;
}


export interface IDeal extends Document {
  hospital: mongoose.Types.ObjectId;
  contact?: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  gpo: mongoose.Types.ObjectId;
  idn: mongoose.Types.ObjectId;
  products: IDealProduct[];
  notes: string;
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
  products: [
    {
      product: { type: Schema.Types.ObjectId, ref: "Product" },
      dealAmount: Number,
      stage: {
        type: String,
        enum: [
          "Demo",
          "CPA",
          "Committee",
          "Trial",
          "Pending Decision",
          "Closed Won",
          "Implemented"
        ],
        default: "Demo" // optional
      },
      expectedCloseDate: Date
    }
  ],
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

export default mongoose.model<IDeal>('Deal', DealSchema);