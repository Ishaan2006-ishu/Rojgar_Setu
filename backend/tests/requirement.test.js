import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { createSession } from '../src/modules/auth/auth.service.js';
import EmployerProfile from '../src/modules/employers/employer.model.js';
import Requirement from '../src/modules/requirements/requirement.model.js';
import User from '../src/modules/users/user.model.js';

// These are integration tests against a real MongoDB test database, because
// the requirement workflow relies on query filters (ownership, state,
// pagination) that stubs would not exercise. They are skipped when MongoDB is
// not reachable so the rest of the suite still runs.
const mongoUri = process.env.MONGO_URI;
let mongoAvailable = false;
try {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
  mongoAvailable = true;
} catch {
  console.warn(`Skipping requirement tests: MongoDB not reachable at ${mongoUri}`);
}

if (mongoAvailable && !mongoose.connection.name.endsWith('_test')) {
  throw new Error(
    `Refusing to run destructive tests against non-test database "${mongoose.connection.name}"`,
  );
}

const hour = 60 * 60 * 1000;

function validRequirement(overrides = {}) {
  const start = Date.now() + 24 * hour;
  return {
    title: 'Need two warehouse helpers',
    description: 'Unload and arrange incoming goods.',
    occupation: 'Helper',
    requiredSkills: ['loading', 'loading', 'stacking'],
    workType: 'short_term',
    workLocation: { coordinates: [77.2, 28.62], area: 'Okhla', city: 'Delhi' },
    schedule: {
      startAt: new Date(start).toISOString(),
      endAt: new Date(start + 8 * hour).toISOString(),
      durationHours: 8,
    },
    vacanciesTotal: 2,
    pricing: { method: 'fixed', amountMinor: 90000, unit: 'day' },
    ...overrides,
  };
}

describe('requirement endpoints', { skip: !mongoAvailable }, () => {
  let server;
  let baseUrl;
  const tokens = {};

  async function makeUser(key, { employer = true } = {}) {
    const user = await User.create({
      name: `User ${key}`,
      email: `${key}@example.com`,
      passwordHash: 'not-a-real-hash',
      capabilities: employer ? ['employer'] : ['worker'],
    });
    if (employer) {
      await EmployerProfile.create({
        userId: user._id,
        employerType: 'individual',
        displayName: `Employer ${key}`,
      });
    }
    const { accessToken } = await createSession(user);
    tokens[key] = accessToken;
  }

  async function api(method, path, { as, body } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (as) headers.authorization = `Bearer ${tokens[as]}`;
    const response = await fetch(`${baseUrl}/api/requirements${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  async function createAs(as, overrides) {
    const { status, body } = await api('POST', '/', {
      as,
      body: validRequirement(overrides),
    });
    assert.equal(status, 201, JSON.stringify(body));
    return body.requirement;
  }

  before(async () => {
    await mongoose.connection.dropDatabase();
    await Requirement.syncIndexes();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    await makeUser('alice');
    await makeUser('bob');
    await makeUser('wendy', { employer: false });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test('requires authentication', async () => {
    const { status } = await api('POST', '/', { body: validRequirement() });
    assert.equal(status, 401);
  });

  test('employer can create a requirement; server controls owner fields', async () => {
    const { status, body } = await api('POST', '/', {
      as: 'alice',
      body: validRequirement({
        vacanciesFilled: 2,
        employerId: new mongoose.Types.ObjectId().toString(),
      }),
    });
    assert.equal(status, 201);
    const { requirement } = body;
    assert.equal(requirement.status, 'open');
    assert.equal(requirement.vacanciesFilled, 0);
    assert.deepEqual(requirement.requiredSkills, ['loading', 'stacking']);
    assert.equal(requirement.pricing.currency, 'INR');
    assert.deepEqual(requirement.workLocation.coordinates, [77.2, 28.62]);

    const owner = await EmployerProfile.findOne({
      userId: (await User.findOne({ email: 'alice@example.com' }))._id,
    });
    assert.equal(requirement.employerId, String(owner._id));
  });

  test('user without an employer profile cannot create', async () => {
    const { status } = await api('POST', '/', { as: 'wendy', body: validRequirement() });
    assert.equal(status, 403);
  });

  test('create rejects invalid input', async () => {
    const now = Date.now();
    const cases = [
      ['missing fields', { title: 'Only a title' }],
      [
        'endAt before startAt',
        validRequirement({
          schedule: {
            startAt: new Date(now + 5 * hour).toISOString(),
            endAt: new Date(now + 2 * hour).toISOString(),
          },
        }),
      ],
      [
        'schedule in the past',
        validRequirement({
          schedule: {
            startAt: new Date(now - 5 * hour).toISOString(),
            endAt: new Date(now - 2 * hour).toISOString(),
          },
        }),
      ],
      ['fixed price without amount', validRequirement({ pricing: { method: 'fixed' } })],
      [
        'fractional amount',
        validRequirement({ pricing: { method: 'fixed', amountMinor: 10.5, unit: 'day' } }),
      ],
      ['zero vacancies', validRequirement({ vacanciesTotal: 0 })],
      ['unknown work type', validRequirement({ workType: 'freelance' })],
      ['bad coordinates', validRequirement({ workLocation: { coordinates: [200, 28] } })],
      ['client sets closed status', validRequirement({ status: 'closed' })],
    ];
    for (const [name, body] of cases) {
      const response = await api('POST', '/', { as: 'alice', body });
      assert.equal(response.status, 400, `${name}: ${JSON.stringify(response.body)}`);
      assert.equal(response.body.success, false);
    }

    const offers = await api('POST', '/', {
      as: 'alice',
      body: validRequirement({ pricing: { method: 'open_to_offers' } }),
    });
    assert.equal(offers.status, 201, 'open_to_offers needs no amount');
  });

  test('any logged-in user can view an open requirement; drafts stay private', async () => {
    const open = await createAs('alice');
    const viewed = await api('GET', `/${open._id}`, { as: 'wendy' });
    assert.equal(viewed.status, 200);
    assert.equal(viewed.body.requirement.title, open.title);

    const draft = await createAs('alice', { status: 'draft' });
    assert.equal((await api('GET', `/${draft._id}`, { as: 'alice' })).status, 200);
    assert.equal((await api('GET', `/${draft._id}`, { as: 'bob' })).status, 404);
    assert.equal((await api('GET', `/${draft._id}`, { as: 'wendy' })).status, 404);
  });

  test('invalid and unknown ids return 400 and 404', async () => {
    assert.equal((await api('GET', '/not-an-id', { as: 'alice' })).status, 400);
    const unknown = new mongoose.Types.ObjectId();
    assert.equal((await api('GET', `/${unknown}`, { as: 'alice' })).status, 404);
    assert.equal(
      (await api('PATCH', `/${unknown}`, { as: 'alice', body: { title: 'x' } })).status,
      404,
    );
  });

  test('owner can edit allowed fields only', async () => {
    const requirement = await createAs('alice');
    const { status, body } = await api('PATCH', `/${requirement._id}`, {
      as: 'alice',
      body: { title: 'Need three helpers', vacanciesTotal: 3, vacanciesFilled: 3 },
    });
    assert.equal(status, 200);
    assert.equal(body.requirement.title, 'Need three helpers');
    assert.equal(body.requirement.vacanciesTotal, 3);
    assert.equal(body.requirement.vacanciesFilled, 0);

    const empty = await api('PATCH', `/${requirement._id}`, {
      as: 'alice',
      body: { vacanciesFilled: 1 },
    });
    assert.equal(empty.status, 400);
  });

  test('another employer cannot edit or close my requirement', async () => {
    const requirement = await createAs('alice');
    const edit = await api('PATCH', `/${requirement._id}`, {
      as: 'bob',
      body: { title: 'Hijacked' },
    });
    assert.equal(edit.status, 403);
    const close = await api('POST', `/${requirement._id}/close`, { as: 'bob' });
    assert.equal(close.status, 403);
    const worker = await api('POST', `/${requirement._id}/close`, { as: 'wendy' });
    assert.equal(worker.status, 403);

    const unchanged = await Requirement.findById(requirement._id);
    assert.equal(unchanged.title, requirement.title);
    assert.equal(unchanged.status, 'open');
  });

  test('vacancies cannot be reduced below filled count', async () => {
    const requirement = await createAs('alice', { vacanciesTotal: 3 });
    await Requirement.updateOne({ _id: requirement._id }, { vacanciesFilled: 2 });
    const response = await api('PATCH', `/${requirement._id}`, {
      as: 'alice',
      body: { vacanciesTotal: 1 },
    });
    assert.equal(response.status, 409);
  });

  test('closing works once and locks the requirement', async () => {
    const requirement = await createAs('alice');
    const closed = await api('POST', `/${requirement._id}/close`, {
      as: 'alice',
      body: { reason: 'Found workers offline' },
    });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.requirement.status, 'closed');
    assert.equal(closed.body.requirement.closeReason, 'Found workers offline');
    assert.ok(closed.body.requirement.closedAt);

    const again = await api('POST', `/${requirement._id}/close`, { as: 'alice' });
    assert.equal(again.status, 409);
    const edit = await api('PATCH', `/${requirement._id}`, {
      as: 'alice',
      body: { title: 'Reopen?' },
    });
    assert.equal(edit.status, 409);
  });

  test('lists only my requirements with pagination and status filter', async () => {
    for (let i = 0; i < 3; i += 1) await createAs('bob', { title: `Bob job ${i}` });
    await createAs('bob', { status: 'paused' });

    const page1 = await api('GET', '/mine?page=1&limit=2', { as: 'bob' });
    assert.equal(page1.status, 200);
    assert.equal(page1.body.requirements.length, 2);
    assert.deepEqual(page1.body.meta, { page: 1, limit: 2, total: 4, totalPages: 2 });
    const page2 = await api('GET', '/mine?page=2&limit=2', { as: 'bob' });
    assert.equal(page2.body.requirements.length, 2);
    const ids = new Set([...page1.body.requirements, ...page2.body.requirements].map((r) => r._id));
    assert.equal(ids.size, 4);

    const paused = await api('GET', '/mine?status=paused', { as: 'bob' });
    assert.equal(paused.body.meta.total, 1);
    assert.equal(paused.body.requirements[0].status, 'paused');

    for (const query of ['?limit=51', '?page=0', '?page=abc', '?status=deleted']) {
      assert.equal((await api('GET', `/mine${query}`, { as: 'bob' })).status, 400, query);
    }
    assert.equal((await api('GET', '/mine', { as: 'wendy' })).status, 403);
  });
});
