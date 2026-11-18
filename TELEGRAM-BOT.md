# Telegram CHECK bot (NBA blender)

Press **CHECK** in Telegram, from your phone, with the blender closed, and the bot replies with what's still available from today's Nick card
at live prices (same OpticOdds check as CHECK RANGE: FanDuel / Prop Builder / Pinnacle / Bet105, or an exchange with $500+ to the play-to).

## One-time setup (5 minutes)
1. **Deploy the full zip** (index.html + `api/` folder). The bot is `api/telegram.js`, on the same Vercel site as the blender.
2. **Vercel → your project → Settings → Environment Variables**, add:
   - `TELEGRAM_BOT_TOKEN` = the token from @BotFather (the same bot SALT uses is fine).
   - `OO_BACKEND` = your OpticOdds proxy, only if it is not the default `https://nfl-props-tracker-1.vercel.app/api/odds`.
   Redeploy once after adding them (Deployments → ⋯ → Redeploy).
3. **Point Telegram at the bot.** Open this once in a browser, with your token and your site's host filled in:
   `https://api.telegram.org/botTOKEN/setWebhook?url=https://YOURSITE.vercel.app/api/telegram`
   It should answer `{"ok":true,...,"description":"Webhook was set"}`.
4. **Add the bot to the chat** where you want to press CHECK (a group or channel; make it an admin), then in the blender's Morning tab click
   **🤖 CHECK BOT SETUP** and type that chat's id or @name.

## Use
- Send to Nick as usual. The blender also hands the card to the bot (toast: "Card sent to the CHECK bot (N picks)") and a **CHECK** button
  appears under the chat.
- Tap **CHECK** (or type `/check`) any time. The reply is the Copy Open Props shape: title, each pick with its best book / price / play-to and
  the other books, then a "Gone" line for anything past the play-to or pulled.

## If it doesn't answer
- "Nothing sent to Nick today yet" → send to Nick first (or re-send; the card is re-pushed every time).
- No reply at all → the webhook isn't set (step 3) or the token isn't on Vercel (step 2).
- "Check failed: OpticOdds …" → the proxy is down or `OO_BACKEND` is wrong.
