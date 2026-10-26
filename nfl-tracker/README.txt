DEPLOY (Vercel Drop — same way you deployed before)
====================================================
1. Go to vercel.com -> your project "nfl-props-tracker-1"
2. Settings -> Environment Variables -> Add:
      Name:  OPTICODDS_API_KEY
      Value: (paste your OpticOdds key)
   Save. Then add a second one:
      Name:  ROTOWIRE_API_KEY
      Value: (paste your RotoWire API key)
   Save. (The Blender tab's ROTOWIRE source pulls from it automatically.)
3. Go back to the project Overview page.
4. Drag THIS WHOLE FOLDER (nfl-props-tracker-deploy) onto the page.
   Vercel deploys it. Wait for "Ready".
5. Open the site -> click "⚙ OpticOdds" -> "Test connection".
   Should say "✓ Connected. OpticOdds returned N sports."
6. Click a game in the ticker -> "📊 Live Odds".

FILES
=====
index.html     your tracker (calls /api/odds on the same site)
blender.html   the NFL Blender — opens inside the tracker's "Blender" tab (first tab).
               To update the blender later, replace this file with the new version
               (keep the name blender.html) and redeploy.
api/odds.js    tiny server function: adds your key, calls OpticOdds, returns data
api/rotowire.js  server function for RotoWire (adds ROTOWIRE_API_KEY, the key never reaches the page)
package.json   tells Vercel the api file is modern JS

If you ever host index.html somewhere else (GitHub Pages), open ⚙ OpticOdds
in the tool and set the backend to:  https://nfl-props-tracker-1.vercel.app/api/odds

SEND TO DISCORD + SENT TRACKER
- On the Ensemble source, "📤 Send to Discord" builds the same image as "🖼 Discord Card" and
  posts it to your Discord webhook (asked for the first time; change it on the Sent tab).
  The webhook URL is saved only in this browser. Each send pings role 1555588738191589538
  (change or turn off with "Change role" on the Sent tab).
- Every pick that was actually drawn on that image is logged to the "📤 Sent" tab, at the best
  price shown on the card. Grades follow the Ensemble automatically; W / L / P on a row
  overrides by hand ("auto" hands it back). Sending the same pick again doesn't double it.
- "📤 Send Nick Card" posts the Nick Card to its OWN webhook and pings its own role (both asked
  on the first send; change either on the Sent tab). The Nick card MUST tag a role: with no role
  set it asks, and sends nothing until one is entered. Nick sends are not logged to Sent.

SENT TAB: TEXT VERSION + PASTE
- Each Send to Discord also copies the card's picks as text, one per line:
    Cam Ward: u0.5 Pass TD +174
  The Sent tab has "Copy text" buttons per week for the same thing.
- "Paste sent picks" on the Sent tab adds lines in that format (your results format works too:
  "Bo Nix: o32.5 Pass Att -115 LOSS (29) = -1.15u"). WIN/LOSS/PUSH on a line grades it; a line
  without one grades itself from any source's graded actual for that player + market.

DISCORD RECAP + STORAGE (Sent tab)
- Discord recap: pick a week -> preview, "Copy recap", or "Post to Discord" (Partners webhook,
  plain text, no role tag). Same layout as Copy Week Recap: the Week line and the pick lines are
  what went out on Discord (card prices); MTD / YTD are the overall model (Ensemble with the
  dashboard's tier + Yardage settings).
- Storage: how much of this browser's ~5 MB is used, the biggest saved items, and whether the
  Sent list's backup database works. "Clear old backup copies" removes only old cleanup backups.
