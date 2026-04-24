import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailRecipient {
  name?: string;
  address: string;
}

export interface IEmail extends Document {
  graphId: string;
  sender: IEmailRecipient;
  from: IEmailRecipient;
  toRecipients: IEmailRecipient[];
  ccRecipients: IEmailRecipient[];
  bccRecipients: IEmailRecipient[];
  subject: string;
  bodyPreview: string;
  body: {
    contentType: string;
    content: string;
  };
  receivedDateTime: Date;
  sentDateTime: Date;
  hasAttachments: boolean;
  isRead: boolean;
  isDraft: boolean;
  webLink: string;
  conversationId: string;
  importance: string;
  crmUser: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RecipientSchema = new Schema({
  name: { type: String, trim: true },
  address: { type: String, required: true, trim: true, lowercase: true }
}, { _id: false });

const EmailSchema = new Schema<IEmail>(
  {
    graphId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    sender: RecipientSchema,
    from: RecipientSchema,
    toRecipients: [RecipientSchema],
    ccRecipients: [RecipientSchema],
    bccRecipients: [RecipientSchema],
    subject: {
      type: String,
      trim: true
    },
    bodyPreview: {
      type: String
    },
    body: {
      contentType: { type: String },
      content: { type: String }
    },
    receivedDateTime: {
      type: Date
    },
    sentDateTime: {
      type: Date
    },
    hasAttachments: {
      type: Boolean,
      default: false
    },
    isRead: {
      type: Boolean,
      default: false
    },
    isDraft: {
      type: Boolean,
      default: false
    },
    webLink: {
      type: String
    },
    conversationId: {
      type: String
    },
    importance: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal'
    },
    crmUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Index for faster searches
EmailSchema.index({ crmUser: 1, receivedDateTime: -1 });
EmailSchema.index({ subject: 'text', bodyPreview: 'text' });

const Email = mongoose.model<IEmail>('Email', EmailSchema);

export default Email;