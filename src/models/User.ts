import mongoose, { Document, Schema } from 'mongoose';
import { UserSettings } from '@/types';

// Define the base interface without id to avoid conflicts
export interface UserData {
  githubId: number;
  githubUsername: string;
  email?: string;
  name?: string;
  avatarUrl: string;
  repositories: string[]; // repository full names
  settings: UserSettings;
  authorizedAccounts: Array<{
    githubAccountId: number;
    login: string;
    type: 'User' | 'Organization';
    role: 'owner' | 'member';
  }>;
  accessToken?: string; // Legacy field; removed after users reconnect.
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDocument extends UserData, Document {}

const UserSettingsSchema = new Schema<UserSettings>({
  autoReview: { type: Boolean, default: true },
  reviewLanguages: [{ type: String }],
  excludedPatterns: [{ type: String }],
  notificationPreferences: {
    email: { type: Boolean, default: true },
    slack: { type: String },
  },
});

const AuthorizedAccountSchema = new Schema({
  githubAccountId: { type: Number, required: true },
  login: { type: String, required: true },
  type: { type: String, enum: ['User', 'Organization'], required: true },
  role: { type: String, enum: ['owner', 'member'], required: true },
}, { _id: false });

const UserSchema = new Schema<UserDocument>({
  githubId: { type: Number, required: true, unique: true },
  githubUsername: { type: String, required: true },
  email: { type: String },
  name: { type: String },
  avatarUrl: { type: String, required: true },
  repositories: [{ type: String }],
  settings: { type: UserSettingsSchema, default: () => ({}) },
  authorizedAccounts: { type: [AuthorizedAccountSchema], default: [] },
  accessToken: { type: String, select: false }, // Temporary legacy migration field.
}, {
  timestamps: true,
});

// Indexes for better query performance
UserSchema.index({ githubUsername: 1 });
UserSchema.index({ repositories: 1 });
UserSchema.index({ 'authorizedAccounts.githubAccountId': 1 });

export const UserModel = mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);
