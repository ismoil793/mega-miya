import mongoose, { Document, Schema } from 'mongoose';

export interface InstallationRepository {
  githubRepositoryId: number;
  name: string;
  fullName: string;
  private: boolean;
}

export interface GitHubInstallationDocument extends Document {
  installationId: number;
  accountId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  status: 'active' | 'suspended';
  repositories: InstallationRepository[];
  reviewSettings?: {
    contextDepth: 'diff' | 'changed-files' | 'balanced' | 'deep';
    autoApproveWhenResolved: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const InstallationRepositorySchema = new Schema<InstallationRepository>({
  githubRepositoryId: { type: Number, required: true },
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  private: { type: Boolean, required: true },
}, { _id: false });

const GitHubInstallationSchema = new Schema<GitHubInstallationDocument>({
  installationId: { type: Number, required: true, unique: true, index: true },
  accountId: { type: Number, required: true, index: true },
  accountLogin: { type: String, required: true },
  accountType: { type: String, enum: ['User', 'Organization'], required: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  repositories: { type: [InstallationRepositorySchema], default: [] },
  reviewSettings: {
    contextDepth: { type: String, enum: ['diff', 'changed-files', 'balanced', 'deep'] },
    autoApproveWhenResolved: { type: Boolean, default: false },
  },
}, { timestamps: true });

GitHubInstallationSchema.index({ accountId: 1, status: 1 });
GitHubInstallationSchema.index({ 'repositories.githubRepositoryId': 1 });
GitHubInstallationSchema.index({ 'repositories.fullName': 1 });

export const GitHubInstallationModel = mongoose.models.GitHubInstallation
  || mongoose.model<GitHubInstallationDocument>('GitHubInstallation', GitHubInstallationSchema);
