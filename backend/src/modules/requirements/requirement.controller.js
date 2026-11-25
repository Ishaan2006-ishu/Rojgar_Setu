import {
  closeRequirement,
  createRequirement,
  getRequirementById,
  listOwnRequirements,
  updateRequirement,
} from './requirement.service.js';

export async function create(req, res) {
  const requirement = await createRequirement(req.user._id, req.validatedBody);
  res.status(201).json({ success: true, requirement });
}

export async function listMine(req, res) {
  const { requirements, meta } = await listOwnRequirements(
    req.user._id,
    req.validatedQuery,
  );
  res.json({ success: true, requirements, meta });
}

export async function getOne(req, res) {
  const requirement = await getRequirementById(req.params.id, req.user._id);
  res.json({ success: true, requirement });
}

export async function update(req, res) {
  const requirement = await updateRequirement(
    req.params.id,
    req.user._id,
    req.validatedBody,
  );
  res.json({ success: true, requirement });
}

export async function close(req, res) {
  const requirement = await closeRequirement(
    req.params.id,
    req.user._id,
    req.validatedBody,
  );
  res.json({ success: true, requirement });
}
