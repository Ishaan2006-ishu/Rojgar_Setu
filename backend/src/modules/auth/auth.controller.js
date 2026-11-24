import {
  authenticateUser,
  createSession,
  registerUser,
  revokeSession,
  toPublicUser,
} from './auth.service.js';

export async function register(req, res) {
  const user = await registerUser(req.validatedBody);

  res.status(201).json({
    success: true,
    user: toPublicUser(user),
  });
}

export async function login(req, res) {
  const user = await authenticateUser(req.validatedBody);
  const token = await createSession(user);

  res.json({
    success: true,
    ...token,
    user: toPublicUser(user),
  });
}

export function getCurrentUser(req, res) {
  res.json({
    success: true,
    user: toPublicUser(req.user),
  });
}

export async function logout(req, res) {
  await revokeSession(req.auth.session);

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}
