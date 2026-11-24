import { createAuthError } from '../auth/auth.service.js';

const editableFields = new Set([
  'employerType',
  'displayName',
  'businessCategory',
  'description',
  'location',
  'status',
]);

function requireObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createAuthError(400, 'Request body must be a JSON object');
  }
}

function requireString(value, field, maxLength = Infinity) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    throw createAuthError(400, `${field} must be a non-empty string`);
  }

  return value.trim();
}

function validateLocation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createAuthError(400, 'Location must be an object');
  }

  const location = { type: 'Point' };
  if (value.coordinates !== undefined) {
    const coordinates = value.coordinates;
    if (
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      !coordinates.every(Number.isFinite) ||
      coordinates[0] < -180 ||
      coordinates[0] > 180 ||
      coordinates[1] < -90 ||
      coordinates[1] > 90
    ) {
      throw createAuthError(
        400,
        'Location coordinates must contain valid longitude and latitude',
      );
    }
    location.coordinates = [...coordinates];
  }

  for (const field of ['area', 'city']) {
    if (value[field] !== undefined) {
      location[field] = requireString(value[field], `Location ${field}`);
    }
  }
  return location;
}

function sanitizeEmployerBody(body, isCreate) {
  requireObjectBody(body);
  const sanitized = {};

  for (const [field, value] of Object.entries(body)) {
    if (!editableFields.has(field)) continue;

    switch (field) {
      case 'employerType':
        if (!['individual', 'business'].includes(value)) {
          throw createAuthError(400, 'Employer type is invalid');
        }
        sanitized.employerType = value;
        break;
      case 'displayName':
        sanitized.displayName = requireString(value, 'Display name');
        break;
      case 'businessCategory':
        sanitized.businessCategory = requireString(value, 'Business category');
        break;
      case 'description':
        if (typeof value !== 'string' || value.length > 500) {
          throw createAuthError(400, 'Description must be 500 characters or fewer');
        }
        sanitized.description = value.trim();
        break;
      case 'location':
        sanitized.location = validateLocation(value);
        break;
      case 'status':
        if (!['active', 'paused'].includes(value)) {
          throw createAuthError(400, 'Employer status is invalid');
        }
        sanitized.status = value;
        break;
      default:
        break;
    }
  }

  if (isCreate && (!sanitized.employerType || !sanitized.displayName)) {
    throw createAuthError(400, 'Employer type and display name are required');
  }
  if (!isCreate && Object.keys(sanitized).length === 0) {
    throw createAuthError(400, 'At least one profile field must be provided');
  }

  return sanitized;
}

export function validateEmployerCreation(req, res, next) {
  try {
    req.validatedBody = sanitizeEmployerBody(req.body, true);
    next();
  } catch (error) {
    next(error);
  }
}

export function validateEmployerUpdate(req, res, next) {
  try {
    req.validatedBody = sanitizeEmployerBody(req.body, false);
    next();
  } catch (error) {
    next(error);
  }
}
