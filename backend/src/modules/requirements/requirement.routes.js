import { Router } from 'express';
import { requireAuthentication } from '../auth/auth.middleware.js';
import { close, create, getOne, listMine, update } from './requirement.controller.js';
import {
  validateRequirementClose,
  validateRequirementCreation,
  validateRequirementId,
  validateRequirementListQuery,
  validateRequirementUpdate,
} from './requirement.validator.js';

const router = Router();

router.use(requireAuthentication);

router.post('/', validateRequirementCreation, create);
// '/mine' must be registered before '/:id' so it is not treated as an id.
router.get('/mine', validateRequirementListQuery, listMine);
router.get('/:id', validateRequirementId, getOne);
router.patch('/:id', validateRequirementId, validateRequirementUpdate, update);
router.post('/:id/close', validateRequirementId, validateRequirementClose, close);

export default router;
