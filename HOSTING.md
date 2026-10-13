# Hosting Guide

This guide describes how the Expire Reminder application is hosted, which services it needs, and how to deploy a new version.

## Application services

| Service | Purpose | Current provider |
| --- | --- | --- |
| React frontend + Express API | Serves the web application and REST API from one Node.js process | Railway web service |
| MySQL | Stores users, sessions, products, and dashboard data | Railway MySQL service |
| GitHub repository | Source code and automatic deployment trigger | `phoenix-030/Food-expiry` |

The backend serves the built frontend from `frontend/dist`, so only one public web service is required.

## Current production deployment

- Application URL: `https://food-expiry-reminder-production.up.railway.app`
- Health check: `https://food-expiry-reminder-production.up.railway.app/health`
- Railway project: `lucky-elegance`
- Environment: `production`
- Public service: `food-expiry-reminder`
- Database service: `MySQL`

The app connects to MySQL over Railway's private network. It does **not** use a local database in production.

## Railway deployment process

1. Push the application code to the `main` branch of GitHub.
2. Railway detects the commit and builds the `food-expiry-reminder` service.
3. Railway runs this build command:

   ```bash
   npm install --prefix backend && npm install --include=dev --prefix frontend && npm run build --prefix frontend
   ```

4. Railway starts the application with:

   ```bash
   node backend/server.js
   ```

5. Before opening the HTTP server, the backend connects to MySQL and creates or updates the required tables.
6. Railway checks `GET /health`. A successful response means the web process is running.
7. The Railway public domain forwards traffic to the app port selected by Railway through the `PORT` environment variable.

### Railway environment variables

Configure the following on the **food-expiry-reminder** service. Railway's variable references keep database credentials out of the application repository.

| Variable | Railway value |
| --- | --- |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | A long, unique secret generated for this service |
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `DB_USER` | `${{MySQL.MYSQLUSER}}` |
| `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
| `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `DB_SSL` | `false` for Railway's private MySQL network |

`PORT` is supplied automatically by Railway. Do not hard-code it.

### Railway MySQL requirements

Create a MySQL service in the same Railway project and keep it on the private network. The app requires permission to create and modify these tables:

- `users`
- `user_sessions`
- `products`
- `scanned_history`
- `sustainability_stats`

The application now waits for this schema initialization to complete before it accepts web requests. This prevents registration from failing on a fresh database because the `users` table has not been created yet.

### Railway verification

After a deployment:

1. Confirm the deployment status is **SUCCESS** in Railway.
2. Open `/health` and confirm it returns HTTP 200 with `status: "ok"`.
3. Create a test account on `/register`.
4. Confirm registration returns successfully and the user can log in.
5. Check Railway logs for `Database initialization complete.` and for any database errors.

## Render deployment process

The repository includes [render.yaml](./render.yaml) for deploying the same application to Render.

Render needs the same components as Railway:

1. A Node web service connected to this GitHub repository.
2. A reachable MySQL database.
3. Database credentials supplied as Render environment variables.

Use these commands for the Render web service:

```bash
# Build command
npm install --prefix backend && npm install --include=dev --prefix frontend && npm run build --prefix frontend

# Start command
node backend/server.js
```

Use `/health` as the health check path.

### Render environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | Set to `production`. |
| `JWT_SECRET` | Yes | Generate a long random value. |
| `DB_HOST` | Yes | Hostname of a MySQL database reachable from Render. |
| `DB_PORT` | Yes | Usually `3306`. Do not use the web app port. |
| `DB_USER` | Yes | MySQL username. |
| `DB_PASSWORD` | Yes | MySQL password. |
| `DB_NAME` | Yes | MySQL database name. |
| `DB_SSL` | Depends on provider | Set to `true` only if the database provider requires TLS. |

Render cannot use Railway's private MySQL host. To connect a Render deployment to that database, use Railway's public proxy credentials or choose a database provider that allows connections from Render. Keep all credentials in the provider's environment-variable settings, never in Git.

## Common deployment issue: registration server error

If registration displays `Server error during registration`, inspect the application logs first.

| Log message | Cause | Fix |
| --- | --- | --- |
| `Table '<database>.users' doesn't exist` | Database schema did not finish initializing. | Redeploy the current version and verify the startup log shows `Database initialization complete.` |
| `ECONNREFUSED` for MySQL | Database host or port is wrong, or the database is unavailable. | Verify `DB_HOST`, `DB_PORT`, and database availability. |
| `Access denied` | MySQL username or password is incorrect. | Update `DB_USER` and `DB_PASSWORD`. |
| `Unknown database` | `DB_NAME` does not exist. | Create the database or use the name supplied by the hosting provider. |

## Updating production

1. Make and test the code change locally.
2. Commit it to Git.
3. Push it to `main`.
4. Wait for Railway's deployment to complete.
5. Run the verification steps above before sharing the release.

For a deployment that changes database structure, keep the migration safe to run more than once. The application uses `CREATE TABLE IF NOT EXISTS` and column checks for this reason.
