# SportZone

SportZone is an Express + static frontend sports booking and tournament management app.

## Local Run

```powershell
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Database

The app now supports MongoDB for persistent production storage.

Set these environment variables on Vercel:

```text
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/sportzone?retryWrites=true&w=majority
MONGODB_DB=sportzone
JWT_SECRET=your-long-random-secret
```

If `MONGODB_URI` is not set, the app falls back to `data/db.json` locally and `/tmp/sportzone-db.json` on Vercel. The fallback is useful for testing, but Vercel `/tmp` storage is not permanent.

## Booking Slot Logic

Booking dates use India time (`Asia/Kolkata`). A slot is hidden when the same venue, date, and time already has a `Pending` or `Approved` booking.
