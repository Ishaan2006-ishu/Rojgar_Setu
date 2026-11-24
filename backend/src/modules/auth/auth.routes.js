import { Router } from 'express';
import {
  getCurrentUser,
  login,
  logout,
  register,
} from './auth.controller.js';
import { requireAuthentication } from './auth.middleware.js';
import { validateLogin, validateRegistration } from './auth.validator.js';

const router = Router();

router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.get('/me', requireAuthentication, getCurrentUser);
router.post('/logout', requireAuthentication, logout);

export default router;
