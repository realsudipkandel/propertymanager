# Mira Properties

Financial books for a UK serviced-accommodation business. Gross booking revenue, platform fees, and bank payouts are stored separately.

## Run locally

Postgres is started on `127.0.0.1` only.

```bash
npm run db:local
npx prisma migrate dev
npm run db:seed
npm run dev
```

Copy `.env.example` to `.env` and `secrets.env.example` to `secrets.env`. Passwords, the database URL, `AUTH_SECRET`, and `BANK_ENCRYPTION_KEY` belong only in `secrets.env`. That file is not committed. The sign-in page does not show them.

Open http://localhost:3000 and sign in with the email and password from `secrets.env`.

`docker compose --env-file .env --env-file secrets.env up` runs the app and database on a private network. The database port is not published.

## Tests

```bash
npm test
```
