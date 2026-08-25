import { createHash, randomBytes } from 'crypto';
import type mongoose from 'mongoose';
import { connectDB } from './database';
import { AccessCodeModel } from '@/models/AccessCode';

export const ACCESS_CODE_RESERVATION_COOKIE = 'access_code_reservation';
export const ACCESS_CODE_RESERVATION_SECONDS = 15 * 60;

export function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isPlausibleAccessCode(code: string): boolean {
  return /^MM-[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/.test(normalizeAccessCode(code));
}

export function hashAccessCode(code: string): string {
  return createHash('sha256')
    .update(`mega-miyya-access-code:v1:${normalizeAccessCode(code)}`)
    .digest('hex');
}

function hashReservationToken(token: string): string {
  return createHash('sha256').update(`mega-miyya-access-reservation:v1:${token}`).digest('hex');
}

export async function reserveAccessCode(code: string): Promise<string | null> {
  if (!isPlausibleAccessCode(code)) return null;
  await connectDB();
  const now = new Date();
  const reservationToken = randomBytes(32).toString('base64url');
  const reservationExpiresAt = new Date(now.getTime() + ACCESS_CODE_RESERVATION_SECONDS * 1000);
  const reserved = await AccessCodeModel.findOneAndUpdate(
    {
      codeHash: hashAccessCode(code),
      $or: [
        { status: 'unused' },
        { status: { $exists: false } },
        { status: 'reserved', reservationExpiresAt: { $lte: now } },
      ],
    },
    { $set: {
      status: 'reserved',
      reservedTokenHash: hashReservationToken(reservationToken),
      reservedAt: now,
      reservationExpiresAt,
    } },
    { new: true },
  );
  return reserved ? reservationToken : null;
}

export async function consumeAccessCodeReservation(
  reservationToken: string,
  githubId: number,
): Promise<mongoose.Types.ObjectId | null> {
  if (!reservationToken || !Number.isSafeInteger(githubId)) return null;
  await connectDB();
  const consumed = await AccessCodeModel.findOneAndUpdate(
    {
      status: 'reserved',
      reservedTokenHash: hashReservationToken(reservationToken),
      reservationExpiresAt: { $gt: new Date() },
    },
    {
      $set: { status: 'used', usedAt: new Date(), usedByGithubId: githubId },
      $unset: { reservedTokenHash: 1, reservedAt: 1, reservationExpiresAt: 1 },
    },
    { new: true },
  ).select('_id');
  return consumed?._id || null;
}

export async function bindAccessCodeToUser(accessCodeId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) {
  await AccessCodeModel.updateOne({ _id: accessCodeId, status: 'used' }, { $set: { usedByUserId: userId } });
}
