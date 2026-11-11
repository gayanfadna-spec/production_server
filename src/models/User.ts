import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'production_manager' | 'store_keeper' | 'viewer' | 'other' | 'others';

export interface ILastEditedBy {
  userId?: mongoose.Types.ObjectId | string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  editedAt?: Date;
  summary?: string;
}

export const LastEditedBySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, default: '' },
    userEmail: { type: String, default: '' },
    userRole: { type: String, default: '' },
    editedAt: { type: Date, default: Date.now },
    summary: { type: String, default: '' },
  },
  { _id: false }
);

export interface IUser extends Document {
  username?: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  customRole?: string;
  department: string;
  isActive: boolean;
  avatar?: string;
  lastEditedBy?: ILastEditedBy;
  comparePassword(candidatePassword: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'production_manager', 'store_keeper', 'viewer', 'other', 'others'],
      default: 'viewer',
    },
    customRole: { type: String, default: '' },
    department: { type: String, default: 'Production & Planning' },
    isActive: { type: Boolean, default: true },
    avatar: { type: String, default: '' },
    lastEditedBy: { type: LastEditedBySchema, default: null },
  },
  { timestamps: true }
);

UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password as string, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', UserSchema);
