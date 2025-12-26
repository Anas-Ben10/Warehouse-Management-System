# WMS (Angular + Node API) — Offline-first

## Run (Docker Desktop)
1) Install Docker Desktop and start it.
2) In this folder:
```bash
docker compose up -d --build
```

3) First time only (creates tables + seeds demo users/items/locations):
```bash
docker compose exec api npx prisma db push
docker compose exec api npm run seed
```

4) Open:
- App: http://localhost:5173
- API: http://localhost:8080/api/health

Default admin:
- Email: admin@local.test
- Password: ChangeMe!12345

## Offline behavior
- If you submit a transaction while **offline**, it is stored in IndexedDB.
- When you’re back online, press **Sync now** (top bar) or open the Sync page.
