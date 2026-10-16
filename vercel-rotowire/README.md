# RotoWire proxy for the NBA blender

Keeps your RotoWire API key on Vercel. The key is never in this repo or in the page.

## Deploy (new Vercel project)

1. vercel.com → **Add New… → Project** → import the **wally60** repo.
2. **Root Directory** → click *Edit* → choose **`vercel-rotowire`**.
   Framework Preset: **Other**. Leave the build settings empty.
3. Open **Environment Variables** (on the same screen, before deploying) and add:
   - **Name:** `ROTOWIRE_FEED_URL`
   - **Value:** your RotoWire feed URL with your key in it, **without** the
     `&feed=...` part. The proxy adds `feed=NBAInjuries` / `NBALineups` /
     `NBANews` itself.
4. Click **Deploy**.
5. Open `https://<your-project>.vercel.app/api/rotowire?feed=NBAInjuries`.
   You should see injury data.

## Point the blender at it

NBA blender → **MORNING** tab → **⚙** next to *SYNC RW API* → paste
`https://<your-project>.vercel.app/api/rotowire` → OK → **⚡ SYNC RW API**.

(Paste the proxy URL only, never the RotoWire URL with the key. The blender refuses
anything that looks like it has a key in it.)

## Alternative: add it to the existing OpticOdds project

Copy `api/rotowire.js` into `nfl-props-tracker-1`'s `api/` folder, add the
same `ROTOWIRE_FEED_URL` variable there, and redeploy. The blender already
points at `https://nfl-props-tracker-1.vercel.app/api/rotowire`, so you can skip the ⚙ step.
