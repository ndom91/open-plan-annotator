export const DEV_PLAN = `# Example Plan

## Context

This is a **test plan** for development purposes. It exercises _inline formatting_ to verify annotation offsets.

## Steps

### Step 1: Set up the database

Create a new **PostgreSQL** database with the following schema for _user management_.

\`\`\`sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);
\`\`\`

### Step 2: Implement the API

Build **REST endpoints** for CRUD operations using the \`express\` framework on the _users_ table.

- GET \`/api/users\` -- list **all** users with _pagination_ and \`cursor\`-based navigation
- POST \`/api/users\` -- create a **new** user (see [validation docs](https://example.com/docs) for _schema rules_)
- DELETE \`/api/users/:id\` -- **permanently** delete a user, \`invalidate\` their _active sessions_, and notify via [webhooks](https://example.com/hooks)

### Step 3: Add authentication

Use **JWT tokens** for _stateless_ authentication with \`RS256\` signing. Store refresh tokens in **Redis** using \`SETEX\` with a _configurable_ TTL. See [RFC 7519](https://tools.ietf.org/html/rfc7519) for the **full spec** and _implementation notes_.

The \`/auth/login\` endpoint should accept **email** and _password_, validate with \`bcrypt\`, and return a [JSON response](https://example.com/schema) containing **both** tokens.

> Note: We should consider **rate limiting** on the _auth endpoints_ using a \`sliding window\` algorithm and [redis-rate-limiter](https://example.com/lib).

## Files

| File | Action | Description |
|------|--------|-------------|
| \`src/db/schema.ts\` | **Create** | PostgreSQL schema and migrations |
| \`src/routes/users.ts\` | **Create** | CRUD endpoints for _user management_ |
| \`src/auth/jwt.ts\` | **Create** | \`RS256\` token signing and verification |
| \`src/middleware/rateLimit.ts\` | **Create** | Sliding window **rate limiter** |
| \`tests/users.test.ts\` | **Create** | Integration tests for all endpoints |

## Verification

Run the test suite with \`bun test\` and verify **all endpoints** return _correct_ status codes. Check \`coverage\` reports for any **untested** [edge cases](https://example.com/edge-cases) in the _auth flow_.
`;
