import { createAuthError, verifyAccessToken } from './auth.service.js';

export async function requireAuthentication(req, res, next) {
  const authorization = req.get('authorization');
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    throw createAuthError(401, 'Bearer access token is required');
  }

  const { claims, session, user } = await verifyAccessToken(match[1]);
  req.auth = {
    session,
    sessionId: claims.sid,
  };
  req.user = user;
  next();
}
