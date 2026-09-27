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

Open http://localhost:3000. In development the sign-in page shows the director email and password from `.env`.

`docker compose up` runs the app and database on a private network. The database port is not published.

## Tests

```bash
npm test
```
