import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import mongoose from 'mongoose';

async function startServer() {
  await connectDatabase();

  const server = app.listen(env.port, () => {
    console.log(`Backend server listening on port ${env.port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received; closing server`);
    server.close(async (error) => {
      if (error) {
        console.error('Failed to close HTTP server:', error);
        process.exitCode = 1;
        return;
      }

      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        console.error('Failed to disconnect from MongoDB:', disconnectError);
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  console.error('Failed to start backend server:', error);
  process.exitCode = 1;
});
