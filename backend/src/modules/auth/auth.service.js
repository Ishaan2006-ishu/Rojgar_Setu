import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import Session from './session.model.js';
import User from '../users/user.model.js';

const passwordRounds = 12;
const sessionDurationMs = 60 * 60 * 1000;

export function createAuthError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function registerUser({ name, email, password, capabilities }) {
  const existingUser = await User.findOne({ email }).select('_id');
  if (existingUser) {
    throw createAuthError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, passwordRounds);

  try {
    return await User.create({ name, email, passwordHash, capabilities });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email === 1) {
      throw createAuthError(409, 'An account with this email already exists');
    }

    throw error;
  }
}

export async function authenticateUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches =
    user && (await bcrypt.compare(password, user.passwordHash));

  if (!passwordMatches) {
    throw createAuthError(401, 'Invalid email or password');
  }

  return user;
}

export async function createSession(user) {
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  const session = await Session.create({
    userId: user._id,
    expiresAt,
  });
  const accessToken = jwt.sign(
    { sid: String(session._id) },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: Math.floor(sessionDurationMs / 1000),
      subject: String(user._id),
    },
  );

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: Math.floor(sessionDurationMs / 1000),
  };
}

export function toPublicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    capabilities: user.capabilities,
    createdAt: user.createdAt,
  };
}

export async function verifyAccessToken(token) {
  let claims;
  try {
    claims = jwt.verify(token, env.jwtSecret, {
      algorithms: ['HS256'],
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createAuthError(401, 'Invalid or expired access token');
    }

    throw error;
  }

  if (
    typeof claims === 'string' ||
    typeof claims.sub !== 'string' ||
    typeof claims.sid !== 'string' ||
    !mongoose.isValidObjectId(claims.sub) ||
    !mongoose.isValidObjectId(claims.sid)
  ) {
    throw createAuthError(401, 'Invalid access token');
  }

  const session = await Session.findOne({
    _id: claims.sid,
    userId: claims.sub,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) {
    throw createAuthError(401, 'Session is invalid or expired');
  }

  const user = await User.findById(claims.sub);
  if (!user) {
    throw createAuthError(401, 'Account no longer exists');
  }

  return { claims, session, user };
}

export async function revokeSession(session) {
  await Session.updateOne(
    { _id: session._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
