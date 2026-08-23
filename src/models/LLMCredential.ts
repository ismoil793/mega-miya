import mongoose, { Document, Schema } from 'mongoose';

export type StoredAIProvider = 'openai' | 'anthropic';

export interface LLMCredentialDocument extends Document {
  githubAccountId: number;
  provider: StoredAIProvider;
  modelName: string;
  encryptedApiKey: string;
  encryptionIv: string;
  authTag: string;
  keyVersion: number;
  keyLastFour: string;
  configuredByUserId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LLMCredentialSchema = new Schema<LLMCredentialDocument>({
  githubAccountId: { type: Number, required: true, unique: true, index: true },
  provider: { type: String, enum: ['openai', 'anthropic'], required: true },
  modelName: { type: String, required: true },
  encryptedApiKey: { type: String, required: true, select: false },
  encryptionIv: { type: String, required: true, select: false },
  authTag: { type: String, required: true, select: false },
  keyVersion: { type: Number, required: true, select: false },
  keyLastFour: { type: String, required: true },
  configuredByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const LLMCredentialModel = mongoose.models.LLMCredential
  || mongoose.model<LLMCredentialDocument>('LLMCredential', LLMCredentialSchema);
