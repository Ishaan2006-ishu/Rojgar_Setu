# Rojgar_Setu

## Backend

The Express API is in [`backend/`](backend/). From that directory, copy
`.env.example` to `.env`, update `MONGO_URI` for your MongoDB instance, install
dependencies with `npm install`, and start the API with `npm run dev`.

The backend listens on `PORT` after MongoDB connects. Check its status at
`GET /api/health`.
