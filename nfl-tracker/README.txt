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
