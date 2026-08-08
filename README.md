# Sleeper Trade Finder

League web app for Sleeper fantasy football. Import a league, collect each manager’s **personal player values** (seeded from a community/market baseline), and run a Madden/2K-style **Trade Finder** that matches deals using the **partner’s** valuations.

## Access model (no passwords)

- No email/password accounts
- Commissioner finds a league via **Sleeper username** or **league ID**
- Import creates **invite code** (share) + **admin code** (private)
- Access is an httpOnly cookie on that browser

## Deploy for phones / league mates

See **[DEPLOY.md](./DEPLOY.md)** — uses **Vercel + Neon Postgres**.

Local SQLite is no longer used. Point `DATABASE_URL` at Postgres for both local and production.

## Quick start (local, after you have a Postgres URL)

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
cd C:\Users\Garre\Projects\sleeper-trade-finder
copy .env.example .env
# edit .env — set DATABASE_URL + AUTH_SECRET
npm.cmd install
npx prisma migrate deploy
npm.cmd run dev
```

Or run `start-dev.cmd` once `.env` has a `postgresql://` URL.

## Star values (2K-style)

Assets are rated **0–5★ in 0.5 steps**. Baseline blends format ADP + projections/actuals, then adjusts for TE premium, age, and positional scarcity from Sleeper settings.

**My values** shows Your ★ / League ★ (live median) / Market ★.

## Invite flow

Share: `https://YOUR-APP/join/<inviteCode>`

Managers claim their Sleeper team and set personal boards. Trade Finder uses partner values first.
