import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Session from '../src/modules/auth/session.model.js';
import User from '../src/modules/users/user.model.js';

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

test('authentication endpoints register, authenticate, and revoke sessions', async () => {
  const originals = {
    createUser: User.create,
    findUser: User.findOne,
    findUserById: User.findById,
    createSession: Session.create,
    findSession: Session.findOne,
    updateSession: Session.updateOne,
  };
  const users = new Map();
  const sessions = new Map();
  const { server, baseUrl } = await startTestServer();

  User.findOne = (filter) => ({
    select: async () => users.get(filter.email) ?? null,
  });
  User.create = async (data) => {
    const user = new User(data);
    user.createdAt = new Date();
    users.set(user.email, user);
    return user;
  };
  User.findById = async (id) => users.get(
    [...users.values()].find((user) => String(user._id) === String(id))?.email,
  ) ?? null;
  Session.create = async (data) => {
    const session = {
      ...data,
      _id: new mongoose.Types.ObjectId(),
      revokedAt: null,
    };
    sessions.set(String(session._id), session);
    return session;
  };
  Session.findOne = async (filter) => {
    const session = sessions.get(String(filter._id));
    if (
      !session ||
      String(session.userId) !== String(filter.userId) ||
      session.revokedAt !== null ||
      session.expiresAt <= filter.expiresAt.$gt
    ) {
      return null;
    }

    return session;
  };
  Session.updateOne = async (filter, update) => {
    const session = sessions.get(String(filter._id));
    if (session && session.revokedAt === null) {
      session.revokedAt = update.$set.revokedAt;
    }
  };

  try {
    let response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Rojgar User',
        email: '  USER@example.com ',
        password: 'a-secure-password',
        capabilities: ['worker', 'employer'],
      }),
    });
    assert.equal(response.status, 201);
    const registration = await response.json();
    assert.deepEqual(registration.user.capabilities, ['worker', 'employer']);
    assert.equal(registration.user.email, 'user@example.com');
    assert.equal('passwordHash' in registration.user, false);

    const storedUser = users.get('user@example.com');
    assert.notEqual(storedUser.passwordHash, 'a-secure-password');
    assert.equal(
      await bcrypt.compare('a-secure-password', storedUser.passwordHash),
      true,
    );

    response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate',
        email: 'user@example.com',
        password: 'another-secure-password',
        capabilities: ['worker'],
      }),
    });
    assert.equal(response.status, 409);

    response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'incorrect-password',
      }),
    });
    assert.equal(response.status, 401);

    response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'a-secure-password',
      }),
    });
    assert.equal(response.status, 200);
    const login = await response.json();
    assert.equal(login.tokenType, 'Bearer');
    assert.equal(login.user.id, String(storedUser._id));

    response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'a-secure-password',
      }),
    });
    assert.equal(response.status, 200);
    const secondLogin = await response.json();

    response = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(response.status, 401);

    const authorization = { authorization: `Bearer ${login.accessToken}` };
    response = await fetch(`${baseUrl}/api/auth/me`, { headers: authorization });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.email, 'user@example.com');

    response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: authorization,
    });
    assert.equal(response.status, 200);

    response = await fetch(`${baseUrl}/api/auth/me`, { headers: authorization });
    assert.equal(response.status, 401);

    response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${secondLogin.accessToken}` },
    });
    assert.equal(response.status, 200);
  } finally {
    User.create = originals.createUser;
    User.findOne = originals.findUser;
    User.findById = originals.findUserById;
    Session.create = originals.createSession;
    Session.findOne = originals.findSession;
    Session.updateOne = originals.updateSession;
    await closeServer(server);
  }
});

test('registration rejects invalid capability values', async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Rojgar User',
        email: 'user@example.com',
        password: 'a-secure-password',
        capabilities: ['admin'],
      }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
  } finally {
    await closeServer(server);
  }
});
