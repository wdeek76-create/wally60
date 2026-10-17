# NFL blender: auto-pull RotoWire projections (plan)

Goal: the ROTOWIRE source in `NFLblender.html` fills from RotoWire's API, so the
weekly RW CSVs (MASTER / RBWRTE / QB) don't have to be uploaded. This is the same
setup that now works in the NHL SOG blender, where the API matched the CSV
476/503 exactly. The other 26 were rounding, and the 1 left was two players
with the same name.

## What we already know works (from NHL)

- **The key lives in Vercel, never in the page.** RotoWire blocks web pages from
  calling `api.rotowire.com` directly (CORS), so a pasted RotoWire link
  just says "couldn't reach". The page calls a small Vercel helper
  (`api/rotowire.js`), which adds the key from the `ROTOWIRE_API_KEY`
  environment variable. Redeploy after setting it.
- **Address pattern:** `https://api.rotowire.com/<Sport>/<League>/<Feed>.php?key=…&format=json`.
  The NFL link you already have is `Football/NFL/WeeklyProjections.php?key=…&week=5`.
- **The data comes grouped.** NHL came back as 28 team rows, each holding a
  `Players` list. The reader has to dig out every `Players` list and take the
  team code from the parent row. NFL may be shaped the same way, or flat.
- **Numbers carry extra decimals.** The API gives 3 decimals and the CSV shows 2,
  so round to match the CSV and PropShop exactly.
- **Same-name players exist.** Match on name + team + position, never name
  alone. NHL's case was Vancouver's two Elias Petterssons; NFL has the same
  risk.

## Steps

### 1. Vercel helper (`api/rotowire.js`)

The current file covers NBA and NHL. Add an NFL entry, and pass `week` through:

```js
NFLWeeklyProj: ["Football/NFL", ["WeeklyProjections.php"]],
```

In the handler, forward `req.query.week` (if present) onto the RotoWire URL as
`&week=N`. Deploy it to the project the NFL page is hosted on, with
`ROTOWIRE_API_KEY` set. Alternatively, the NFL page can call the NHL or NBA
site's helper by its full address.

### 2. NFL page: fetch

Copy the NHL functions, swapping only the feed name:

- `_nhlRwCandidates`, which tries:
  - a saved helper address;
  - this site's own `/api/rotowire`;
  - the OpticOdds backend's site with `/api/rotowire`.
- `_nhlRwFetch`
- `_nhlRwPlayerLists` / `_nhlRwRows` (finds `Players` lists at any depth)
- `_nhlRwPick`, `_nhlRwFlat`, `_nhlRwNum`

**Week:** use the NFL week the page already works out for the slate.
Let it be overridden by hand from the ⚙ box.

### 3. NFL page: map each API player to the RW CSV shape

`parseRW()` returns objects like this, and the API rows must be turned into
exactly this shape:

```
{ rawName, norm: norm(name), team, pos,
  fpts, pass_cmp, pass_att, pass_yds, pass_td,
  rush_att, rush_yds, rush_td, rec, rec_yds, rec_td, targets }
```

RotoWire's real field names are unknown until we see them, the same as with
NHL. Build the mapper tolerantly. Passing, rushing and receiving fields
probably sit under nested groups, e.g. `Passing.Yards`, `Rushing.Attempts`,
`Receiving.Receptions`. Key on the group name plus the stat name, never the
bare stat: "YDS" and "TD" repeat across sections, just like in the CSV.

### 4. Load it into the existing RW slot

The NFL RW slot is built from parts by `_rebuildRWSlot(parts, label)`. The
parts are `master`, `rbwrte` and `qb`, merged in that order, with earlier
parts winning.

- Store the API rows as `parts.master` and label the slot
  `"RotoWire API <time>"`.
- Then call `buildSlots(); updateBadges(); runMerge();`, the same as
  `loadRWPart` does.
- A hand-uploaded RW file wins for the week. The auto-pull only fills an
  empty slot or replaces an earlier API load. The ⚡ button always pulls.
- Pull when the page opens and then every 20–30 minutes. NFL projections
  move less than NHL, so it can be slower.
- Only accept a pull that reads at least ~150 players with stats. Otherwise
  leave the slot alone, since RotoWire may not have posted yet.

### 5. Prove it before trusting it (same buttons as NHL)

- **TEST** shows:
  - how many rows came back, the field names, and one player's flattened
    fields;
  - which field each stat was read from;
  - the API key is never shown.
- **VERIFY vs CSV**: pick the RW CSV for the same week, parse it with
  `parseRW()`, and compare every player and every stat to the API pull.
  - It shows how many are identical, which differ (both numbers), and who's
    only in one list.
  - Matching is on name + team + position, narrowing by team and then
    position when two players share a name.
  - It changes nothing.

Keep uploading the CSV until VERIFY comes back almost all identical. Then let
the API take over.

## Open questions TEST will answer

1. Does the RotoWire plan include NFL projections? The NFL link suggests yes.
2. Does the weekly feed need `week=` every time, or does it default to the
   current week?
3. Are QB pass attempts and completions in the main feed? If they are, the
   separate QB CSV part isn't needed.
4. What are the exact stat field names? The mapper's lookup list gets set
   from the TEST output.
