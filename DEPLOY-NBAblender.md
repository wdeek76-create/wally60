# Deploying the NBA blender (nbablender-3)

The blender page and the RotoWire helper (`api/rotowire.js`) are ONE Vercel project. Deploy them together, every time:

    NBAblender.html     the blender (also served as the home page)
    index.html          same file, for projects that serve index.html
    api/rotowire.js     the RotoWire helper (needs ROTOWIRE_API_KEY in the project's Environment Variables)
    package.json
    vercel.json

Uploading only the HTML removes the helper and every RotoWire feed starts answering NOT_FOUND.
`nba-blender.zip` already contains all of the above. Unzip it and deploy the whole folder.
