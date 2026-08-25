import mongoose, { Document, Schema } from 'mongoose';

export interface AccessCodeDocument extends Document {
  codeHash: string;
  label?: string;
  status: 'unused' | 'reserved' | 'used' | 'revoked';
  reservedTokenHash?: string;
  reservedAt?: Date;
  reservationExpiresAt?: Date;
  usedAt?: Date;
  usedByGithubId?: number;
  usedByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AccessCodeSchema = new Schema<AccessCodeDocument>({
  codeHash: { type: String, required: true, unique: true, index: true, select: false },
  label: { type: String, maxlength: 120 },
  status: { type: String, enum: ['unused', 'reserved', 'used', 'revoked'], default: 'unused', index: true },
  reservedTokenHash: { type: String, select: false },
  reservedAt: { type: Date },
  reservationExpiresAt: { type: Date, index: true },
  usedAt: { type: Date },
  usedByGithubId: { type: Number, index: true },
  usedByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true });

export const AccessCodeModel = mongoose.models.AccessCode
  || mongoose.model<AccessCodeDocument>('AccessCode', AccessCodeSchema);
