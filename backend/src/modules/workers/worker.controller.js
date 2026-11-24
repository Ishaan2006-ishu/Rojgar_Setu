import { createAuthError } from '../auth/auth.service.js';
import User from '../users/user.model.js';
import WorkerProfile from './worker.model.js';

function handleDuplicateProfile(error) {
  if (error.code === 11000) {
    throw createAuthError(409, 'A worker profile already exists for this account');
  }
  throw error;
}

export async function createWorkerProfile(req, res) {
  if (await WorkerProfile.findOne({ userId: req.user._id })) {
    throw createAuthError(409, 'A worker profile already exists for this account');
  }

  let profile;
  try {
    profile = await WorkerProfile.create({
      ...req.validatedBody,
      userId: req.user._id,
    });
  } catch (error) {
    handleDuplicateProfile(error);
  }

  await User.updateOne(
    { _id: req.user._id },
    { $addToSet: { capabilities: 'worker' } },
  );
  res.status(201).json({ success: true, profile });
}

export async function getWorkerProfile(req, res) {
  const profile = await WorkerProfile.findOne({ userId: req.user._id });
  if (!profile) {
    throw createAuthError(404, 'Worker profile not found');
  }

  res.json({ success: true, profile });
}

export async function updateWorkerProfile(req, res) {
  const profile = await WorkerProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: req.validatedBody },
    { new: true, runValidators: true },
  );
  if (!profile) {
    throw createAuthError(404, 'Worker profile not found');
  }

  res.json({ success: true, profile });
}
