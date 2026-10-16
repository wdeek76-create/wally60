# RotoWire feed proxy (NBA blender)

Keeps the RotoWire API key on Vercel so it never sits in the public `wally60`
repo or in the page.

## Setup (one time)

1. Copy `api/rotowire.js` into the `api/` folder of the Vercel project that
   already serves the OpticOdds backend (`nfl-props-tracker-1`), next to
   `api/odds`. Commit + push so Vercel redeploys.
2. In Vercel → that project → **Settings → Environment Variables**, add:
   - **Name:** `ROTOWIRE_FEED_URL`
   - **Value:** the RotoWire feed URL you already use, key included, *without*
     the `feed=` parameter. If your URL normally ends `&feed=NBAInjuries`,
     drop that part.
3. Redeploy (Vercel → Deployments → Redeploy) so the variable takes effect.
4. Check it: open `https://nfl-props-tracker-1.vercel.app/api/rotowire?feed=NBAInjuries`.
   You should see JSON, not an error.

In the blender's **MORNING** tab, **⚡ SYNC RW API** then pulls NBAInjuries,
NBANews and NBALineups. It defaults to the same Vercel host as the OpticOdds
backend, and **⚙** changes it. **TEST FEEDS** shows what each feed returns.
