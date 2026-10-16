DEPLOY (Vercel Drop — same way you deployed before)
====================================================
1. Go to vercel.com -> your project "nfl-props-tracker-1"
2. Settings -> Environment Variables -> Add:
      Name:  OPTICODDS_API_KEY
      Value: (paste your OpticOdds key)
   Save.
3. Go back to the project Overview page.
4. Drag THIS WHOLE FOLDER (nfl-props-tracker-deploy) onto the page.
   Vercel deploys it. Wait for "Ready".
5. Open the site -> click "⚙ OpticOdds" -> "Test connection".
   Should say "✓ Connected. OpticOdds returned N sports."
6. Click a game in the ticker -> "📊 Live Odds".

FILES
=====
index.html     your tracker (calls /api/odds on the same site)
api/odds.js    tiny server function: adds your key, calls OpticOdds, returns data
package.json   tells Vercel the api file is modern JS

If you ever host index.html somewhere else (GitHub Pages), open ⚙ OpticOdds
in the tool and set the backend to:  https://nfl-props-tracker-1.vercel.app/api/odds
