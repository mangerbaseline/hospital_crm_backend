import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  SALES = 'Sales',
  CUSTOMER_SUCCESS = 'Customer Success',
  EXECUTIVE = 'Executive',
  ADMIN = 'Admin'
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  comparePassword(password: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
      minlength: [8, 'Password must be at least 8 characters long'],
      validate: {
        validator: function (v: string) {
          // At least 1 lowercase, 1 uppercase, 1 digit, and one special character
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/.test(v);
        },
        message: 'Password must include at least one uppercase letter, one lowercase letter, one number and one special character (@$!%*?&#)'
      }
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(UserRole),
      default: UserRole.SALES,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret['__v'] = undefined;
        ret['password'] = undefined;
        return ret;
      },
    },
  }
);

// Middleware: Hash password before saving (Mongoose v9 async style - no next needed)
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password!, salt);
});

// Method: Verify password
UserSchema.methods['comparePassword'] = async function (
  enteredPassword: string
): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this['password'] as string);
};

export default mongoose.model<IUser>('User', UserSchema);