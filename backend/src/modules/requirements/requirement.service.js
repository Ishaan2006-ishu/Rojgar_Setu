import { createAuthError } from '../auth/auth.service.js';
import EmployerProfile from '../employers/employer.model.js';
import Requirement, { LOCKED_STATUSES } from './requirement.model.js';

export async function getEmployerProfileForUser(userId) {
  const profile = await EmployerProfile.findOne({ userId });
  if (!profile) {
    throw createAuthError(403, 'An employer profile is required for this action');
  }
  return profile;
}

async function findOwnedRequirement(requirementId, userId) {
  const employer = await getEmployerProfileForUser(userId);
  const requirement = await Requirement.findById(requirementId);
  if (!requirement) {
    throw createAuthError(404, 'Requirement not found');
  }
  if (!requirement.employerId.equals(employer._id)) {
    throw createAuthError(403, 'You can only manage your own requirements');
  }
  return { employer, requirement };
}

export async function createRequirement(userId, data) {
  const employer = await getEmployerProfileForUser(userId);
  if (employer.status !== 'active') {
    throw createAuthError(403, 'Your employer profile must be active to post requirements');
  }

  return Requirement.create({
    ...data,
    employerId: employer._id,
    vacanciesFilled: 0,
  });
}

export async function listOwnRequirements(userId, { page, limit, status }) {
  const employer = await getEmployerProfileForUser(userId);
  const filter = { employerId: employer._id };
  if (status) filter.status = status;

  const [requirements, total] = await Promise.all([
    Requirement.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Requirement.countDocuments(filter),
  ]);

  return {
    requirements,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getRequirementById(requirementId, userId) {
  const requirement = await Requirement.findById(requirementId);
  if (!requirement) {
    throw createAuthError(404, 'Requirement not found');
  }

  // Drafts are private to their owner; hide them from everyone else.
  if (requirement.status === 'draft') {
    const employer = await EmployerProfile.findOne({ userId });
    if (!employer || !requirement.employerId.equals(employer._id)) {
      throw createAuthError(404, 'Requirement not found');
    }
  }
  return requirement;
}

export async function updateRequirement(requirementId, userId, changes) {
  const { employer, requirement } = await findOwnedRequirement(requirementId, userId);

  if (LOCKED_STATUSES.includes(requirement.status)) {
    throw createAuthError(409, `A ${requirement.status} requirement cannot be edited`);
  }
  if (
    changes.vacanciesTotal !== undefined &&
    changes.vacanciesTotal < requirement.vacanciesFilled
  ) {
    throw createAuthError(
      409,
      `Vacancies total cannot be lower than the ${requirement.vacanciesFilled} already filled`,
    );
  }

  // Repeat the state checks in the filter so a concurrent close or hire
  // between the read above and this write cannot be overwritten.
  const filter = {
    _id: requirement._id,
    employerId: employer._id,
    status: { $nin: LOCKED_STATUSES },
  };
  if (changes.vacanciesTotal !== undefined) {
    filter.vacanciesFilled = { $lte: changes.vacanciesTotal };
  }

  const updated = await Requirement.findOneAndUpdate(
    filter,
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!updated) {
    throw createAuthError(409, 'Requirement changed while updating; please retry');
  }
  return updated;
}

export async function closeRequirement(requirementId, userId, { reason }) {
  const { employer, requirement } = await findOwnedRequirement(requirementId, userId);
  if (requirement.status === 'closed') {
    throw createAuthError(409, 'Requirement is already closed');
  }

  const changes = { status: 'closed', closedAt: new Date() };
  if (reason) changes.closeReason = reason;

  const closed = await Requirement.findOneAndUpdate(
    { _id: requirement._id, employerId: employer._id, status: { $ne: 'closed' } },
    { $set: changes },
    { new: true },
  );
  if (!closed) {
    throw createAuthError(409, 'Requirement is already closed');
  }
  return closed;
}
