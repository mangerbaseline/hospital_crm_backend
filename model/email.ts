import mongoose, { Document, Schema } from 'mongoose';

export interface IEmail extends Document {
  senderMail: string;
  receiverMail: string;
  cc: string[];
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmailSchema: Schema = new Schema({
  senderMail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  receiverMail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  cc: [{
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  }],
  subject: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
}, {
  timestamps: true
});

const Email = mongoose.model<IEmail>('Email', EmailSchema);

export const saveEmails = async (emailData: any | any[]) => {
  try {
    return await Email.create(emailData);
  } catch (error) {
    throw error;
  }
};

export default Email;