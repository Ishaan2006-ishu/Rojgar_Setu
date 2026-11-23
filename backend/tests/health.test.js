import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';

async function startTestServer() {
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('health endpoint reports whether MongoDB is connected', async () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    mongoose.connection,
    'readyState',
  );
  const { server, baseUrl } = await startTestServer();

  try {
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1,
    });
    let response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      status: 'ok',
      database: 'connected',
    });

    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 0,
    });
    response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      status: 'unavailable',
      database: 'disconnected',
    });
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(
        mongoose.connection,
        'readyState',
        originalDescriptor,
      );
    } else {
      delete mongoose.connection.readyState;
    }
    await closeServer(server);
  }
});

test('unknown routes return the common error response', async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        message: 'Route not found: GET /api/unknown',
      },
    });
  } finally {
    await closeServer(server);
  }
});
