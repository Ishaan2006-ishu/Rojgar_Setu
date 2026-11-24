import { createAuthError } from './auth.service.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedCapabilities = new Set(['worker', 'employer']);

function requireObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createAuthError(400, 'Request body must be a JSON object');
  }
}

function validateCredentials(body) {
  requireObjectBody(body);

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!emailPattern.test(email) || email.length > 254) {
    throw createAuthError(400, 'A valid email is required');
  }

  if (
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw createAuthError(
      400,
      'Password must be at least 8 characters and no more than 72 bytes',
    );
  }

  return { email, password };
}

export function validateRegistration(req, res, next) {
  try {
    const { email, password } = validateCredentials(req.body);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const capabilities = req.body.capabilities;

    if (!name || name.length > 100) {
      throw createAuthError(400, 'Name is required and must be 100 characters or fewer');
    }

    if (
      !Array.isArray(capabilities) ||
      capabilities.length === 0 ||
      capabilities.some(
        (capability) => !allowedCapabilities.has(capability),
      ) ||
      new Set(capabilities).size !== capabilities.length
    ) {
      throw createAuthError(
        400,
        'Capabilities must contain worker, employer, or both without duplicates',
      );
    }

    req.validatedBody = { name, email, password, capabilities };
    next();
  } catch (error) {
    next(error);
  }
}

export function validateLogin(req, res, next) {
  try {
    req.validatedBody = validateCredentials(req.body);
    next();
  } catch (error) {
    next(error);
  }
}
