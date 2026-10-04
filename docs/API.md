# API reference

All endpoints are under `/api` on the same port as the web app (default `http://localhost:3000`).
The assignment lists the paths without the prefix. The prefix lets one Express server deliver
the API, Socket.IO and the React app without the paths colliding.

A runnable version of everything below, with tests and example responses, is in
[`docs/postman/`](postman/).

## Conventions

- **Auth:** `Authorization: Bearer <token>`. You get the token from register or login.
  Tokens last `JWT_EXPIRES_IN` (default 1 day).
- **Success:** `{ "success": true, "data": ..., "meta"?: ... }`.
- **Error:** `{ "success": false, "error": { "code", "message", "details"? } }`. Validation
  errors list every field in `details: [{ location, path, message }]`.
- **Lists** take `page` (from 1) and `limit` (default 10, max 100 unless noted). They return
  `meta: { page, limit, total, totalPages, hasNext, hasPrev }`. Every sort adds `id` as a
  tie-breaker, so pages never overlap.
- **Out of scope = 404.** A record you are not allowed to see answers 404, never 403, so ids cannot
  be probed. A record you can see but not change answers 403.
- **Ids** are UUIDs. A malformed id is a 400 before it reaches the database.

## Endpoints

| Area          | Method and path                        | Who                                         | Notes                                                                                                |
| ------------- | -------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Health        | `GET /health`                          | public                                      | Also checks the database (503 if it is down)                                                         |
| Auth          | `POST /auth/register`                  | public                                      | `{ name, email, password }`. Always creates a MEMBER                                                 |
|               | `POST /auth/login`                     | public                                      | `{ email, password }` gives `{ token, user }`                                                        |
|               | `GET /auth/me`                         | any                                         | The current user, reloaded from the database                                                         |
| Users         | `GET /users`                           | Admin, Manager                              | A Manager only ever gets MEMBER users. Query: `role`, `q`, `sortBy` (createdAt, name, email)         |
|               | `POST /users`                          | Admin                                       | `{ name, email, password, role }`                                                                    |
|               | `PATCH /users/:id/role`                | Admin                                       | `{ role }`. Not your own role. Not a Manager who still owns projects                                 |
| Projects      | `POST /projects`                       | Admin, Manager                              | `{ name, managerId? }`. A Manager becomes the manager. An Admin must pass a MANAGER's id             |
|               | `GET /projects`                        | scoped                                      | Admin: all. Manager: own. Member: joined. Query: `q`, `sortBy` (createdAt, name)                     |
|               | `GET /projects/:id`                    | scoped                                      | Includes `_count.members` and `_count.workItems`                                                     |
|               | `PATCH /projects/:id`                  | owner, Admin                                | `{ name?, managerId? }`. Only an Admin may change `managerId`                                        |
|               | `DELETE /projects/:id`                 | owner, Admin                                | 409 while it has work items                                                                          |
| Members       | `GET /projects/:id/members`            | scoped                                      | Query: `q`, `sortBy` (addedAt, name)                                                                 |
|               | `POST /projects/:id/members`           | owner, Admin                                | `{ userIds: [...] }`. MEMBER users only. Returns `{ added }`                                         |
|               | `DELETE /projects/:id/members/:userId` | owner, Admin                                | 409 while they have unfinished work in the project                                                   |
| Board         | `GET /projects/:id/board`              | scoped                                      | Every column in one request. Query: `type` (TASK, TICKET), `assigneeId`, `q`, `perColumn` (max 50)   |
| Work items    | `POST /work-items`                     | by type                                     | TASK: project Manager or Admin. TICKET: anyone, with an optional project they can see                |
|               | `GET /work-items`                      | scoped                                      | Filters below                                                                                        |
|               | `GET /work-items/:id`                  | scoped                                      | Includes `permissions` and `allowedTransitions` for the caller                                       |
|               | `PATCH /work-items/:id`                | by capability                               | Project Manager or Admin: every field. Assignee: `status` only                                       |
|               | `DELETE /work-items/:id`               | Admin                                       | Comments and notifications go with it                                                                |
| Comments      | `GET /work-items/:id/comments`         | anyone who sees the item                    | Oldest first. `limit` max 50, `order`                                                                |
|               | `POST /work-items/:id/comments`        | requester, assignee, project Manager, Admin | `{ body }`, 1 to 2000 characters. 30 per minute per user                                             |
| Notifications | `GET /notifications`                   | own                                         | `meta.unreadCount` included. Query: `unread`, `type`, `limit` (max 50). Admin: `scope=all`, `userId` |
|               | `GET /notifications/unread-count`      | own                                         | `{ count }`                                                                                          |
|               | `PATCH /notifications/:id/read`        | own                                         | Idempotent. Someone else's is a 404                                                                  |
|               | `PATCH /notifications/read-all`        | own                                         | `{ updated, unreadCount }`                                                                           |
| Dashboard     | `GET /dashboard/summary`               | any                                         | The caller's counts for the "Your work" page                                                         |

### Work item filters (`GET /work-items`)

| Parameter                                | Example               | Meaning                                                       |
| ---------------------------------------- | --------------------- | ------------------------------------------------------------- |
| `type`                                   | `TASK`                | TASK or TICKET                                                |
| `status`                                 | `TODO,IN_PROGRESS`    | One or more statuses, comma-separated                         |
| `priority`                               | `HIGH,URGENT`         | One or more priorities                                        |
| `projectId`, `assigneeId`, `requesterId` | uuid                  | Exact match. A project outside your scope returns nothing     |
| `mine`                                   | `assigned` / `raised` | The caller's own items                                        |
| `overdue`                                | `true`                | Due date in the past and not DONE or CLOSED                   |
| `dueFrom`, `dueTo`                       | ISO dates             | Due date range                                                |
| `q`                                      | `login`               | Case-insensitive search in title and description              |
| `sortBy`, `order`                        | `priority`, `desc`    | createdAt, updatedAt, dueDate (no date last), priority, title |

### Create and update bodies

```jsonc
// POST /work-items
{ "type": "TASK", "title": "...", "description": "...", "projectId": "uuid",
  "priority": "MEDIUM", "assigneeId": "uuid", "dueDate": "2026-10-10T12:00:00Z" }

// PATCH /work-items/:id (any subset)
{ "title": "...", "description": "...", "priority": "HIGH", "status": "IN_PROGRESS",
  "assigneeId": "uuid or null", "dueDate": "ISO date or null" }
```

`type`, `projectId`, `requesterId` and `status` (on create) are never accepted. The schemas are
strict, so unknown fields are a 400.

## Status workflow

| Type   | From        | To                             |
| ------ | ----------- | ------------------------------ |
| TASK   | TODO        | IN_PROGRESS                    |
|        | IN_PROGRESS | TODO, IN_REVIEW                |
|        | IN_REVIEW   | IN_PROGRESS, DONE              |
|        | DONE        | IN_PROGRESS                    |
| TICKET | OPEN        | IN_PROGRESS, ESCALATED, CLOSED |
|        | IN_PROGRESS | OPEN, ESCALATED, RESOLVED      |
|        | ESCALATED   | IN_PROGRESS, RESOLVED          |
|        | RESOLVED    | IN_PROGRESS, CLOSED            |
|        | CLOSED      | (final)                        |

Only a Manager or Admin can move a ticket to ESCALATED. Other moves are a 409
`INVALID_TRANSITION`, whose `details.allowed` lists the valid ones.

## Error codes

| Status   | Codes                                                                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400      | `VALIDATION_ERROR`, `BAD_JSON`, `ASSIGNEE_NOT_IN_PROJECT`, `INVALID_MANAGER`, `INVALID_MEMBER`, `INVALID_INPUT`                                                                                                                                                              |
| 401      | `UNAUTHENTICATED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`                                                                                                                                                                                                   |
| 403      | `FORBIDDEN`, `FORBIDDEN_FIELD` (lists the fields you may not change)                                                                                                                                                                                                         |
| 404      | `NOT_FOUND`                                                                                                                                                                                                                                                                  |
| 409      | `EMAIL_TAKEN`, `PROJECT_NAME_TAKEN`, `PROJECT_HAS_WORK_ITEMS`, `MEMBER_HAS_ACTIVE_WORK`, `MANAGER_OWNS_PROJECTS`, `CANNOT_CHANGE_OWN_ROLE`, `INVALID_TRANSITION`, `STALE_STATE` (someone changed the status first, so reload), `CONSTRAINT_VIOLATION`, `RELATION_CONSTRAINT` |
| 413      | `PAYLOAD_TOO_LARGE` (bodies over 100 kB)                                                                                                                                                                                                                                     |
| 429      | `RATE_LIMITED`: 10 failed logins or 10 registrations per 15 minutes per IP, 30 comments per minute per user, 1000 requests per 15 minutes overall                                                                                                                            |
| 500, 503 | `INTERNAL_ERROR` (no details are ever sent), `SERVICE_UNAVAILABLE` (database down)                                                                                                                                                                                           |

## Real-time events (Socket.IO)

Connect to the same origin (path `/socket.io`) with `auth: { token }`. A missing, invalid or
expired token is refused with the error `UNAUTHENTICATED`. The server closes the socket when the
token expires. Each user joins a private room, so events only ever reach their owner, in every
open tab.

| Event                  | Payload                                | When                                       |
| ---------------------- | -------------------------------------- | ------------------------------------------ |
| `notification:count`   | `{ unreadCount }`                      | Right after connecting                     |
| `notification:new`     | `{ notification, unreadCount }`        | A notification for you was saved           |
| `notification:updated` | `{ ids: [...] or "all", unreadCount }` | You marked notifications read (in any tab) |

The socket only pushes. Every change goes through the REST API, where permissions are checked.
