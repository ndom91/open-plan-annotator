export const DEV_PLAN = `# Add user management API with JWT authentication

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

### Step 3: Add the user service

Implement a \`UserService\` class to encapsulate business logic and keep the route handlers thin.

\`\`\`typescript
import { db } from "../db/schema";

interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

export class UserService {
  async create(input: CreateUserInput): Promise<User> {
    const existing = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, input.email),
    });
    if (existing) {
      throw new ConflictError(\`User with email \${input.email} already exists\`);
    }

    const hashedPassword = await Bun.password.hash(input.password, { algorithm: "bcrypt", cost: 12 }); // Use cost factor 12 for production-grade security; lower values are faster but less resistant to brute-force attacks
    const [user] = await db
      .insert(users)
      .values({ ...input, password: hashedPassword })
      .returning();

    return user;
  }

  async findById(id: number): Promise<User | null> {
    return db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, id),
    });
  }

  async list(cursor?: number, limit = 20): Promise<User[]> {
    return db.query.users.findMany({
      where: cursor ? (users, { gt }) => gt(users.id, cursor) : undefined,
      limit,
      orderBy: (users, { asc }) => asc(users.id),
    });
  }
}
\`\`\`

### Step 4: Add authentication

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
