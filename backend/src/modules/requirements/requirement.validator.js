import mongoose from 'mongoose';
import { createAuthError } from '../auth/auth.service.js';
import {
  PAY_UNITS,
  PRICING_METHODS,
  REQUIREMENT_STATUSES,
  WORK_TYPES,
} from './requirement.model.js';

const MAX_SKILLS = 20;
const MAX_PAGE_LIMIT = 50;
const DEFAULT_PAGE_LIMIT = 20;

// Fields an employer may send on create/update. Anything else is ignored,
// which prevents mass assignment of employerId, vacanciesFilled, etc.
const editableFields = new Set([
  'title',
  'description',
  'occupation',
  'requiredSkills',
  'workType',
  'workLocation',
  'schedule',
  'vacanciesTotal',
  'pricing',
  'status',
]);

// Employers may move between these statuses themselves. 'filled' is set by
// hiring and 'closed' only through the close endpoint.
const employerSettableStatuses = ['draft', 'open', 'paused'];

function badRequest(message) {
  return createAuthError(400, message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${field} must be a non-empty string`);
  }
  if (value.trim().length > maxLength) {
    throw badRequest(`${field} must be ${maxLength} characters or fewer`);
  }
  return value.trim();
}

function validateSkills(value) {
  if (!Array.isArray(value) || value.length > MAX_SKILLS) {
    throw badRequest(`Required skills must be an array of at most ${MAX_SKILLS} items`);
  }
  const skills = value.map((skill) => requireString(skill, 'Skill', 50));
  return [...new Set(skills)];
}

function validateWorkLocation(value) {
  if (!isPlainObject(value)) {
    throw badRequest('Work location must be an object');
  }
  const { coordinates } = value;
  if (
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    !coordinates.every(Number.isFinite) ||
    coordinates[0] < -180 ||
    coordinates[0] > 180 ||
    coordinates[1] < -90 ||
    coordinates[1] > 90
  ) {
    throw badRequest(
      'Work location coordinates must be [longitude, latitude] within valid ranges',
    );
  }

  const location = { type: 'Point', coordinates: [...coordinates] };
  for (const field of ['area', 'city']) {
    if (value[field] !== undefined) {
      location[field] = requireString(value[field], `Work location ${field}`, 100);
    }
  }
  return location;
}

function parseDate(value, field) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw badRequest(`${field} must be a valid date`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date`);
  }
  return date;
}

function validateSchedule(value, isCreate) {
  if (!isPlainObject(value)) {
    throw badRequest('Schedule must be an object');
  }
  const startAt = parseDate(value.startAt, 'Schedule startAt');
  const endAt = parseDate(value.endAt, 'Schedule endAt');
  if (endAt <= startAt) {
    throw badRequest('Schedule endAt must be after startAt');
  }
  if (isCreate && endAt <= new Date()) {
    throw badRequest('Schedule endAt must be in the future');
  }

  const schedule = { startAt, endAt };
  if (value.durationHours !== undefined) {
    if (!Number.isFinite(value.durationHours) || value.durationHours <= 0) {
      throw badRequest('Schedule durationHours must be a positive number');
    }
    schedule.durationHours = value.durationHours;
  }
  return schedule;
}

function validatePricing(value) {
  if (!isPlainObject(value)) {
    throw badRequest('Pricing must be an object');
  }
  if (!PRICING_METHODS.includes(value.method)) {
    throw badRequest(`Pricing method must be one of: ${PRICING_METHODS.join(', ')}`);
  }

  const pricing = { method: value.method };
  if (value.amountMinor !== undefined) {
    if (!Number.isInteger(value.amountMinor) || value.amountMinor < 1) {
      throw badRequest('Pricing amountMinor must be a positive integer (paise)');
    }
    pricing.amountMinor = value.amountMinor;
  }
  if (pricing.method === 'fixed' && pricing.amountMinor === undefined) {
    throw badRequest('Pricing amountMinor is required for fixed pricing');
  }

  if (value.unit !== undefined) {
    if (!PAY_UNITS.includes(value.unit)) {
      throw badRequest(`Pricing unit must be one of: ${PAY_UNITS.join(', ')}`);
    }
    pricing.unit = value.unit;
  }
  if (pricing.amountMinor !== undefined && pricing.unit === undefined) {
    throw badRequest('Pricing unit is required when an amount is given');
  }

  if (value.currency !== undefined) {
    if (typeof value.currency !== 'string' || !/^[A-Za-z]{3}$/.test(value.currency)) {
      throw badRequest('Pricing currency must be a 3-letter ISO code');
    }
    pricing.currency = value.currency.toUpperCase();
  } else {
    pricing.currency = 'INR';
  }
  return pricing;
}

function sanitizeRequirementBody(body, isCreate) {
  if (!isPlainObject(body)) {
    throw badRequest('Request body must be a JSON object');
  }
  const sanitized = {};

  for (const [field, value] of Object.entries(body)) {
    if (!editableFields.has(field)) continue;

    switch (field) {
      case 'title':
        sanitized.title = requireString(value, 'Title', 120);
        break;
      case 'description':
        sanitized.description = requireString(value, 'Description', 2000);
        break;
      case 'occupation':
        sanitized.occupation = requireString(value, 'Occupation', 100);
        break;
      case 'requiredSkills':
        sanitized.requiredSkills = validateSkills(value);
        break;
      case 'workType':
        if (!WORK_TYPES.includes(value)) {
          throw badRequest(`Work type must be one of: ${WORK_TYPES.join(', ')}`);
        }
        sanitized.workType = value;
        break;
      case 'workLocation':
        sanitized.workLocation = validateWorkLocation(value);
        break;
      case 'schedule':
        sanitized.schedule = validateSchedule(value, isCreate);
        break;
      case 'vacanciesTotal':
        if (!Number.isInteger(value) || value < 1) {
          throw badRequest('Vacancies total must be an integer of at least 1');
        }
        sanitized.vacanciesTotal = value;
        break;
      case 'pricing':
        sanitized.pricing = validatePricing(value);
        break;
      case 'status':
        if (!employerSettableStatuses.includes(value)) {
          throw badRequest(
            `Status can only be set to: ${employerSettableStatuses.join(', ')}`,
          );
        }
        sanitized.status = value;
        break;
      default:
        break;
    }
  }

  if (isCreate) {
    const required = [
      'title',
      'description',
      'occupation',
      'workType',
      'workLocation',
      'schedule',
      'vacanciesTotal',
      'pricing',
    ];
    const missing = required.filter((field) => sanitized[field] === undefined);
    if (missing.length > 0) {
      throw badRequest(`Missing required fields: ${missing.join(', ')}`);
    }
  } else if (Object.keys(sanitized).length === 0) {
    throw badRequest('At least one requirement field must be provided');
  }

  return sanitized;
}

function toMiddleware(fn) {
  return (req, res, next) => {
    try {
      fn(req);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const validateRequirementCreation = toMiddleware((req) => {
  req.validatedBody = sanitizeRequirementBody(req.body, true);
});

export const validateRequirementUpdate = toMiddleware((req) => {
  req.validatedBody = sanitizeRequirementBody(req.body, false);
});

export const validateRequirementClose = toMiddleware((req) => {
  const body = req.body ?? {};
  if (!isPlainObject(body)) {
    throw badRequest('Request body must be a JSON object');
  }
  req.validatedBody = {};
  if (body.reason !== undefined) {
    req.validatedBody.reason = requireString(body.reason, 'Close reason', 300);
  }
});

export const validateRequirementId = toMiddleware((req) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw badRequest('Requirement id is invalid');
  }
});

function parsePositiveInt(value, field, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1) {
    throw badRequest(`${field} must be a positive integer`);
  }
  return Number(value);
}

export const validateRequirementListQuery = toMiddleware((req) => {
  const page = parsePositiveInt(req.query.page, 'page', 1);
  const limit = parsePositiveInt(req.query.limit, 'limit', DEFAULT_PAGE_LIMIT);
  if (limit > MAX_PAGE_LIMIT) {
    throw badRequest(`limit must be ${MAX_PAGE_LIMIT} or fewer`);
  }

  const query = { page, limit };
  if (req.query.status !== undefined) {
    if (!REQUIREMENT_STATUSES.includes(req.query.status)) {
      throw badRequest(`status must be one of: ${REQUIREMENT_STATUSES.join(', ')}`);
    }
    query.status = req.query.status;
  }
  req.validatedQuery = query;
});
