import { createAuthError } from '../auth/auth.service.js';
import User from '../users/user.model.js';
import EmployerProfile from './employer.model.js';

function handleDuplicateProfile(error) {
  if (error.code === 11000) {
    throw createAuthError(409, 'An employer profile already exists for this account');
  }
  throw error;
}

export async function createEmployerProfile(req, res) {
  if (await EmployerProfile.findOne({ userId: req.user._id })) {
    throw createAuthError(409, 'An employer profile already exists for this account');
  }

  let profile;
  try {
    profile = await EmployerProfile.create({
      ...req.validatedBody,
      userId: req.user._id,
    });
  } catch (error) {
    handleDuplicateProfile(error);
  }

  await User.updateOne(
    { _id: req.user._id },
    { $addToSet: { capabilities: 'employer' } },
  );
  res.status(201).json({ success: true, profile });
}

export async function getEmployerProfile(req, res) {
  const profile = await EmployerProfile.findOne({ userId: req.user._id });
  if (!profile) {
    throw createAuthError(404, 'Employer profile not found');
  }

  res.json({ success: true, profile });
}

export async function updateEmployerProfile(req, res) {
  const profile = await EmployerProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: req.validatedBody },
    { new: true, runValidators: true },
  );
  if (!profile) {
    throw createAuthError(404, 'Employer profile not found');
  }

  res.json({ success: true, profile });
}
