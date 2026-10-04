# Hosting and operational checks

The optional Caddy profile supports a Linux host with Docker Compose, a domain pointed at the host, and inbound ports 80/443. No deployment is required to run the assignment locally.

1. Copy `.env.example` to `.env`; generate a fresh JWT secret and strong database password. URL-encode special characters in database credentials if necessary.
2. Set `DOMAIN=tracker.example.com`, `CLIENT_URL=https://tracker.example.com`, `TRUST_PROXY=1`, `APP_PORT=127.0.0.1:3000` and `SEED=false`.
3. Run `docker compose --profile app --profile prod up -d --build`.
4. Confirm `docker compose --profile app --profile prod ps`: database/application healthy, migration exited successfully. Verify HTTPS login, deep links and live notification delivery. Confirm `/api/nope` returns JSON 404.

The database host port is bound to loopback. Caddy handles TLS renewal and WebSocket upgrades. The application runs as `node`; verify with `docker compose exec app whoami`. Use `docker compose --profile app --profile prod down` to preserve data; adding `-v` deletes volumes.

## Backups

On a Linux host, write a PostgreSQL custom-format backup:

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > tracker.dump
```

Store backups outside the host and test restore into a separate database before relying on them. To restore into an already-created empty recovery database (never the live database):

```sh
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d tracker_recovery --no-owner' < tracker.dump
```

Keep database credentials consistent with the persisted volume: changing `.env` does not change passwords inside an existing PostgreSQL volume. Rotate them through PostgreSQL and then update the application configuration.

## Release checks

- Build and run tests before release; migration failures must prevent startup.
- Apply migrations a second time to verify idempotency.
- Restart without deleting volumes and confirm records survive.
- Verify a nested UI URL reloads, unknown API URLs remain JSON, and assets load.
- Connect two users and check notification isolation and unread counts.
- Stop the application and inspect graceful shutdown logs.
- Keep demo seeding disabled on production. Provide initial privileged accounts through a controlled provisioning process.
