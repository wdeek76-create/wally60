# RotoWire helper for the NBA blender

RotoWire blocks browsers from calling its API directly, so this tiny Vercel
project sits in between. Your API key lives only in Vercel's settings: not
in the blender, not in this public repo.

## Set it up (one time, all in the Vercel website)

1. vercel.com → **Add New… → Project** → find **wally60** → **Import**.
2. **Root Directory** → **Edit** → pick **`vercel-rotowire`** → Continue.
   Framework Preset: **Other**. Leave everything else as is.
3. Open **Environment Variables** on that same screen and add:
   - Key: `ROTOWIRE_API_KEY`
   - Value: *your RotoWire API key* (just the key)
4. **Deploy**. When it's done, Vercel shows your address, e.g.
   `https://wally60-xxxx.vercel.app`.
5. Test it: open `https://<that address>/api/rotowire?feed=NBAInjuries`.
   You should see injury data.

## Hook up the blender

MORNING tab → **⚙** → paste `https://<that address>/api/rotowire` → OK →
**⚡ SYNC RW API**.
