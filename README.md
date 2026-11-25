# Rojgar_Setu

## Backend

The Express API is in [`backend/`](backend/). From that directory, copy
`.env.example` to `.env`, update `MONGO_URI` for your MongoDB instance, install
dependencies with `npm install`, and start the API with `npm run dev`.

The backend listens on `PORT` after MongoDB connects. Check its status at
`GET /api/health`.

### Authentication

The authentication API provides `POST /api/auth/register`,
`POST /api/auth/login`, `GET /api/auth/me`, and `POST /api/auth/logout`.
Registration accepts `name`, `email`, `password`, and a `capabilities` array
containing `worker`, `employer`, or both. Passwords are bcrypt-hashed.

Login returns a one-hour JWT bearer access token. Send it as
`Authorization: Bearer <token>` to protected endpoints. Each token has a
MongoDB-backed session; logout revokes only that session, and expired sessions
are removed automatically. Set `JWT_SECRET` in `backend/.env` to a unique,
random value of at least 32 characters. The sample value in `.env.example` is
for configuration illustration only and must not be used in production.

### Job requirements

Employers post work requirements under `/api/requirements`. Every endpoint
needs a bearer token, and creating, listing, editing or closing needs an
employer profile (`POST /api/employers/profile`).

| Method & path | Purpose |
| --- | --- |
| `POST /api/requirements` | Create a requirement (status `open`, or `draft`). |
| `GET /api/requirements/mine?page=1&limit=20&status=open` | List your own requirements (limit ≤ 50). |
| `GET /api/requirements/:id` | View a requirement. Drafts are visible only to their owner. |
| `PATCH /api/requirements/:id` | Owner edits allowed fields. Closed or filled requirements return 409. |
| `POST /api/requirements/:id/close` | Owner closes it, with an optional `reason`. |

A requirement has `title`, `description`, `occupation`, `requiredSkills`,
`workType` (`permanent`, `part_time`, `on_demand`, `short_term`),
`workLocation` (`coordinates: [longitude, latitude]`, optional `area`/`city`),
`schedule` (`startAt`, `endAt`, optional `durationHours`), `vacanciesTotal`
and `pricing` (`method`: `fixed`, `open_to_offers` or `negotiable`). Pricing
amounts are integer paise in `amountMinor`; a fixed price needs an amount and a
`unit` (`hour`, `day`, `month`, `job`). `vacanciesFilled` and the owner are set
by the server and cannot be sent by clients.

`npm test` runs the requirement tests against the `rojgar_setu_test` database
on the local MongoDB. They are skipped when MongoDB is not running.

## Frontend

Start the backend, then run `npm install` and `npm run dev` from `frontend/`.
The Vite development server proxies `/api` requests to `http://localhost:5000`;
set `VITE_API_BASE_URL` when the API is hosted elsewhere. The registration
screen follows the backend contract and accepts an email address (not a phone
number), password, name, and worker/employer capabilities. The login page
stores its bearer token in the current tab's session storage; protected pages
restore the user through `GET /api/auth/me`, and sign-out revokes the backend
session.
