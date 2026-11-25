import { Router } from 'express';
import { requireAuthentication } from '../auth/auth.middleware.js';
import {
  createWorkerProfile,
  getWorkerProfile,
  updateWorkerProfile,
} from './worker.controller.js';
import {
  validateWorkerCreation,
  validateWorkerUpdate,
} from './worker.validator.js';

const router = Router();

router.post('/profile', requireAuthentication, validateWorkerCreation, createWorkerProfile);
router.get('/profile/me', requireAuthentication, getWorkerProfile);
router.patch('/profile/me', requireAuthentication, validateWorkerUpdate, updateWorkerProfile);

export default router;
