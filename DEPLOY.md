# Deploy Sleeper Trade Finder (phones + league mates)

Local `localhost` only works on your PC. Deploy once, then share an invite link.

## 1) Create a free Postgres database (Neon)

1. Go to [https://neon.tech](https://neon.tech) and create a project
2. Copy the **connection string** (starts with `postgresql://...`)
3. Keep it handy for Vercel env vars

## 2) Push this repo to GitHub

If the project isn’t on GitHub yet:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
cd C:\Users\Garre\Projects\sleeper-trade-finder
git status
git add .
git commit -m "Prepare Postgres deploy for Vercel"
# create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/sleeper-trade-finder.git
git push -u origin main
```

## 3) Deploy on Vercel

1. Go to [https://vercel.com](https://vercel.com) → **Add New Project** → import the GitHub repo
2. Framework: **Next.js** (auto-detected)
3. Add environment variables:

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon connection string + `&connect_timeout=15` (avoids cold-start timeouts on Vercel) |
| `AUTH_SECRET` | long random string — set once and **do not change** (changing it logs everyone out) |

4. Deploy

Vercel build runs `prisma migrate deploy` then `next build`, which creates tables automatically.

## 4) Use the live site

1. Open `https://YOUR-APP.vercel.app`
2. Import your Sleeper league again (local SQLite data does **not** transfer)
3. Save the **invite code** and **admin code**
4. Share with league mates:

```text
https://YOUR-APP.vercel.app/join/YOUR_INVITE_CODE
```

They open that on their phones → claim their team → set values.

## 5) Local development after Postgres switch

Point local `.env` at the **same Neon DB** (or a second Neon branch):

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="dev-secret"
```

Then:

```powershell
npm.cmd install
npx prisma migrate deploy
npm.cmd run dev
```

## Notes

- Keep the **admin code** private
- Share only the **invite** link/code
- Recompute star baselines after import on the live site
- If deploy fails on migrate, confirm `DATABASE_URL` is set for Production (and Preview if you use preview deploys)
