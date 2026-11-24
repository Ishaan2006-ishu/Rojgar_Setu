import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { createSession } from '../src/modules/auth/auth.service.js';
import Session from '../src/modules/auth/session.model.js';
import EmployerProfile from '../src/modules/employers/employer.model.js';
import User from '../src/modules/users/user.model.js';
import WorkerProfile from '../src/modules/workers/worker.model.js';

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

function createProfileStubs(Model, profiles) {
  return {
    create: Model.create,
    findOne: Model.findOne,
    findOneAndUpdate: Model.findOneAndUpdate,
    install() {
      Model.findOne = async (filter) =>
        profiles.get(String(filter.userId)) ?? null;
      Model.create = async (data) => {
        const key = String(data.userId);
        if (profiles.has(key)) {
          const error = new Error('Duplicate key');
          error.code = 11000;
          throw error;
        }
        const profile = new Model(data);
        profiles.set(key, profile);
        return profile;
      };
      Model.findOneAndUpdate = async (filter, update) => {
        const profile = profiles.get(String(filter.userId));
        if (!profile) return null;
        Object.assign(profile, update.$set);
        return profile;
      };
    },
    restore() {
      Model.create = this.create;
      Model.findOne = this.findOne;
      Model.findOneAndUpdate = this.findOneAndUpdate;
    },
  };
}

test('worker and employer profile endpoints enforce ownership and validation', async () => {
  const originals = {
    userFindById: User.findById,
    userUpdateOne: User.updateOne,
    sessionCreate: Session.create,
    sessionFindOne: Session.findOne,
  };
  const workerProfiles = new Map();
  const employerProfiles = new Map();
  const workerStubs = createProfileStubs(WorkerProfile, workerProfiles);
  const employerStubs = createProfileStubs(EmployerProfile, employerProfiles);
  const users = new Map();
  const sessions = new Map();
  const user = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Profile Tester',
    email: 'profile@example.com',
    capabilities: ['worker'],
  };
  users.set(String(user._id), user);
  const employerWithoutCoordinates = new EmployerProfile({
    userId: user._id,
    employerType: 'individual',
    displayName: 'Area-only employer',
    location: { area: 'Central' },
  });
  await assert.doesNotReject(() => employerWithoutCoordinates.validate());
  workerStubs.install();
  employerStubs.install();

  User.findById = async (id) => users.get(String(id)) ?? null;
  User.updateOne = async (filter, update) => {
    const storedUser = users.get(String(filter._id));
    if (storedUser) {
      const capability = update.$addToSet.capabilities;
      if (!storedUser.capabilities.includes(capability)) {
        storedUser.capabilities.push(capability);
      }
    }
  };
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

  const { server, baseUrl } = await startTestServer();

  try {
    const { accessToken } = await createSession(user);
    const authorization = { authorization: `Bearer ${accessToken}` };

    let response = await fetch(`${baseUrl}/api/workers/profile`, {
      method: 'POST',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        occupation: ' Carpenter ',
        skills: [' Joinery ', 'Repairs'],
        location: { coordinates: [77.2, 28.6], city: 'Delhi' },
        userId: new mongoose.Types.ObjectId(),
      }),
    });
    assert.equal(response.status, 201);
    const workerResult = await response.json();
    assert.equal(workerResult.profile.occupation, 'Carpenter');
    assert.equal(String(workerResult.profile.userId), String(user._id));

    response = await fetch(`${baseUrl}/api/employers/profile`, {
      method: 'POST',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        employerType: 'business',
        displayName: 'Local Works',
        location: { coordinates: [77.2, 28.6], city: 'Delhi' },
      }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(user.capabilities, ['worker', 'employer']);

    response = await fetch(`${baseUrl}/api/workers/profile`, {
      method: 'POST',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        occupation: 'Duplicate',
        skills: ['Skill'],
        location: { coordinates: [0, 0] },
      }),
    });
    assert.equal(response.status, 409);

    response = await fetch(`${baseUrl}/api/employers/profile`, {
      method: 'POST',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        employerType: 'individual',
        displayName: 'Duplicate',
      }),
    });
    assert.equal(response.status, 409);

    response = await fetch(`${baseUrl}/api/workers/profile/me`, {
      headers: authorization,
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).profile.occupation, 'Carpenter');

    response = await fetch(`${baseUrl}/api/employers/profile/me`, {
      headers: authorization,
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).profile.displayName, 'Local Works');

    response = await fetch(`${baseUrl}/api/workers/profile/me`, {
      method: 'PATCH',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        occupation: 'Cabinet Maker',
        userId: new mongoose.Types.ObjectId(),
      }),
    });
    assert.equal(response.status, 200);
    const workerUpdate = await response.json();
    assert.equal(workerUpdate.profile.occupation, 'Cabinet Maker');
    assert.equal(String(workerUpdate.profile.userId), String(user._id));

    response = await fetch(`${baseUrl}/api/employers/profile/me`, {
      method: 'PATCH',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'paused', userId: 'another-user' }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).profile.status, 'paused');

    response = await fetch(`${baseUrl}/api/workers/profile`, {
      method: 'POST',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        occupation: 'Invalid',
        skills: ['Skill'],
        location: { coordinates: [181, 90] },
      }),
    });
    assert.equal(response.status, 400);

    response = await fetch(`${baseUrl}/api/employers/profile`, {
      method: 'POST',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        employerType: 'business',
        displayName: 'Invalid Location',
        location: { coordinates: [77, -91] },
      }),
    });
    assert.equal(response.status, 400);

    response = await fetch(`${baseUrl}/api/workers/profile`, {
      method: 'POST',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({
        occupation: 'Missing skills',
        skills: [],
        location: { coordinates: [0, 0] },
      }),
    });
    assert.equal(response.status, 400);

    workerProfiles.delete(String(user._id));
    response = await fetch(`${baseUrl}/api/workers/profile/me`, {
      headers: authorization,
    });
    assert.equal(response.status, 404);
    employerProfiles.delete(String(user._id));
    response = await fetch(`${baseUrl}/api/employers/profile/me`, {
      headers: authorization,
    });
    assert.equal(response.status, 404);

    response = await fetch(`${baseUrl}/api/workers/profile/me`);
    assert.equal(response.status, 401);
    response = await fetch(`${baseUrl}/api/employers/profile/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
    });
    assert.equal(response.status, 401);
    response = await fetch(`${baseUrl}/api/employers/profile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ employerType: 'business', displayName: 'No Auth' }),
    });
    assert.equal(response.status, 401);
  } finally {
    User.findById = originals.userFindById;
    User.updateOne = originals.userUpdateOne;
    Session.create = originals.sessionCreate;
    Session.findOne = originals.sessionFindOne;
    workerStubs.restore();
    employerStubs.restore();
    await closeServer(server);
  }
});
