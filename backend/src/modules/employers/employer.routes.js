import { Router } from 'express';
import { requireAuthentication } from '../auth/auth.middleware.js';
import {
  createEmployerProfile,
  getEmployerProfile,
  updateEmployerProfile,
} from './employer.controller.js';
import {
  validateEmployerCreation,
  validateEmployerUpdate,
} from './employer.validator.js';

const router = Router();

router.post('/profile', requireAuthentication, validateEmployerCreation, createEmployerProfile);
router.get('/profile/me', requireAuthentication, getEmployerProfile);
router.patch('/profile/me', requireAuthentication, validateEmployerUpdate, updateEmployerProfile);

export default router;
