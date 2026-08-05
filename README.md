# Beacon

Beacon is a small full-stack customer support chat application. Users can create an account, chat with an AI assistant, and return to their previous conversations.

## Stack

- React and Vite
- Node.js and Express
- MongoDB Atlas with Mongoose
- JWT authentication with HTTP-only cookies
- Vercel AI SDK with OpenRouter
- Docker Compose

## Features

- Signup, login, logout, and session restoration
- Password hashing with bcrypt
- Private, user-scoped conversations
- Streaming assistant responses
- Paginated conversation and message history
- Markdown rendering for assistant messages
- Rate limiting and request validation
- Responsive chat interface

## Project structure

```text
client/       React application
server/       Express API, authentication, chat logic, and database models
Dockerfile    Production image for the complete application
compose.yaml  Local production build
```

In development, Vite proxies API requests to Express. In production, Express serves the built React application, so the UI and API use the same origin.

## Run locally

Requirements:

- Node.js 22.22 or later
- npm 10 or later
- MongoDB connection string
- OpenRouter API key

Install dependencies and create the environment file:

```bash
npm install
cp .env.example .env
```

Add your MongoDB and OpenRouter credentials to `.env`, then run:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Run with Docker

Using the same root `.env`, start the application with:

```bash
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173). Docker runs the compiled production build; use `npm run dev` when you need hot reload.

## Environment variables

| Variable | Required | Description |
|---|---:|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret containing at least 32 characters |
| `CLIENT_ORIGIN` | Yes | Browser origin allowed to make authenticated mutations |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `OPENROUTER_MODEL` | No | Model name; defaults to `openrouter/free` |
| `NODE_ENV` | No | `development`, `test`, or `production` |
| `PORT` | No | Express port; defaults to `4000` |

Generate a JWT secret with:

```bash
openssl rand -base64 48
```

Local development reads the root `.env` and defaults to `NODE_ENV=development`. Docker and Railway use the production build and deployment environment variables. The React client has no environment file because it always calls the same-origin API. Secure cookies are enabled automatically for production HTTPS origins.

## API

| Method | Route | Description |
|---|---|---|
| `POST` | `/auth/signup` | Create an account and session |
| `POST` | `/auth/login` | Start a session |
| `POST` | `/auth/logout` | End the current session |
| `GET` | `/auth/session` | Return the signed-in user |
| `POST` | `/chat/send` | Send a message and stream the assistant response |
| `GET` | `/chat/history` | Return paginated conversation summaries |
| `GET` | `/chat/history/:conversationId` | Return a paginated conversation log |
| `GET` | `/health` | Health check |

Authentication is stored in an HTTP-only JWT cookie. Chat routes only return conversations owned by the signed-in user.

## Commands

```bash
npm run dev        # start the client and server in watch mode
npm run build      # build the client and server
npm test           # run the test suites
npm run typecheck  # run TypeScript checks
npm run lint       # run ESLint
```

## Deploy to Railway

Create one Railway service from the repository. Railway detects the root `Dockerfile` automatically.

Set these variables on the service:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN` using the generated Railway URL or custom domain
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` if you do not want the default

Use `/health` as the health-check path and generate one public domain for the service. Railway supplies `PORT` automatically.

MongoDB Atlas must allow connections from the Railway service. Keep `.env` files out of source control.
