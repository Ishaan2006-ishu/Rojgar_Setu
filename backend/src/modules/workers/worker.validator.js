import { createAuthError } from '../auth/auth.service.js';

const editableFields = new Set([
  'occupation',
  'skills',
  'experienceYears',
  'expectedCompensation',
  'location',
  'preferredRadiusKm',
  'availability',
  'bio',
  'profileStatus',
]);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function requireObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createAuthError(400, 'Request body must be a JSON object');
  }
}

function requireString(value, field, { maxLength = Infinity } = {}) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw createAuthError(400, `${field} must be a non-empty string`);
  }

  return value.trim();
}

function validateLocation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createAuthError(400, 'Location must be an object');
  }

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

  const location = { type: 'Point', coordinates: [...coordinates] };
  for (const field of ['area', 'city']) {
    if (value[field] !== undefined) {
      location[field] = requireString(value[field], `Location ${field}`);
    }
  }
  return location;
}

function validateCompensation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createAuthError(400, 'Expected compensation must be an object');
  }

  const { min, max } = value;
  if (
    !Number.isFinite(min) ||
    min < 0 ||
    !Number.isFinite(max) ||
    max < min
  ) {
    throw createAuthError(400, 'Compensation range must have valid min and max values');
  }

  const unit = value.unit ?? 'day';
  if (!['hour', 'day', 'month', 'job'].includes(unit)) {
    throw createAuthError(400, 'Compensation unit is invalid');
  }

  const currency =
    value.currency === undefined
      ? 'INR'
      : requireString(value.currency, 'Compensation currency');
  return { min, max, currency, unit };
}

function validateAvailability(value) {
  if (!Array.isArray(value)) {
    throw createAuthError(400, 'Availability must be an array');
  }

  return value.map((schedule) => {
    if (
      !schedule ||
      typeof schedule !== 'object' ||
      Array.isArray(schedule) ||
      !Number.isInteger(schedule.dayOfWeek) ||
      schedule.dayOfWeek < 0 ||
      schedule.dayOfWeek > 6 ||
      typeof schedule.start !== 'string' ||
      !timePattern.test(schedule.start) ||
      typeof schedule.end !== 'string' ||
      !timePattern.test(schedule.end) ||
      schedule.start >= schedule.end
    ) {
      throw createAuthError(400, 'Availability schedule is invalid');
    }

    return {
      dayOfWeek: schedule.dayOfWeek,
      start: schedule.start,
      end: schedule.end,
    };
  });
}

function sanitizeWorkerBody(body, isCreate) {
  requireObjectBody(body);
  const sanitized = {};

  for (const [field, value] of Object.entries(body)) {
    if (!editableFields.has(field)) continue;

    switch (field) {
      case 'occupation':
        sanitized.occupation = requireString(value, 'Occupation');
        break;
      case 'skills':
        if (
          !Array.isArray(value) ||
          value.length === 0 ||
          value.some((skill) => typeof skill !== 'string' || !skill.trim())
        ) {
          throw createAuthError(400, 'Skills must contain at least one non-empty skill');
        }
        sanitized.skills = value.map((skill) => skill.trim());
        break;
      case 'experienceYears':
        if (!Number.isFinite(value) || value < 0) {
          throw createAuthError(400, 'Experience years must be a non-negative number');
        }
        sanitized.experienceYears = value;
        break;
      case 'expectedCompensation':
        sanitized.expectedCompensation = validateCompensation(value);
        break;
      case 'location':
        sanitized.location = validateLocation(value);
        break;
      case 'preferredRadiusKm':
        if (!Number.isFinite(value) || value < 1) {
          throw createAuthError(400, 'Preferred radius must be at least 1 km');
        }
        sanitized.preferredRadiusKm = value;
        break;
      case 'availability':
        sanitized.availability = validateAvailability(value);
        break;
      case 'bio':
        if (typeof value !== 'string' || value.length > 500) {
          throw createAuthError(400, 'Bio must be 500 characters or fewer');
        }
        sanitized.bio = value.trim();
        break;
      case 'profileStatus':
        if (!['draft', 'active', 'paused'].includes(value)) {
          throw createAuthError(400, 'Profile status is invalid');
        }
        sanitized.profileStatus = value;
        break;
      default:
        break;
    }
  }

  if (isCreate && (!sanitized.occupation || !sanitized.skills || !sanitized.location)) {
    throw createAuthError(400, 'Occupation, skills, and location are required');
  }
  if (!isCreate && Object.keys(sanitized).length === 0) {
    throw createAuthError(400, 'At least one profile field must be provided');
  }

  return sanitized;
}

export function validateWorkerCreation(req, res, next) {
  try {
    req.validatedBody = sanitizeWorkerBody(req.body, true);
    next();
  } catch (error) {
    next(error);
  }
}

export function validateWorkerUpdate(req, res, next) {
  try {
    req.validatedBody = sanitizeWorkerBody(req.body, false);
    next();
  } catch (error) {
    next(error);
  }
}
