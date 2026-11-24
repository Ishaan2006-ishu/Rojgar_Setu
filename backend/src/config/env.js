import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT ?? 5000);
const mongoUri = process.env.MONGO_URI?.trim();
const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret = process.env.JWT_SECRET;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

if (!mongoUri) {
  throw new Error('MONGO_URI is required');
}

if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test, or production');
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

if (
  nodeEnv === 'production' &&
  jwtSecret.startsWith('replace-with-')
) {
  throw new Error('Set JWT_SECRET to a unique random value in production');
}

export const env = {
  port,
  mongoUri,
  nodeEnv,
  jwtSecret,
};
