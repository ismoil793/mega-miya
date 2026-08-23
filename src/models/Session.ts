import mongoose, { Document, Schema } from 'mongoose';

export interface SessionDocument extends Document {
  tokenHash: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<SessionDocument>({
  tokenHash: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, {
  timestamps: true,
});

export const SessionModel = mongoose.models.Session || mongoose.model<SessionDocument>('Session', SessionSchema);
