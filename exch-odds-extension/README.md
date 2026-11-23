# Exchange American Odds (Brave / Chrome, desktop)

On **Novig** and **ProphetX**, every price shown as cents / percent (54¢, 54%) or a share price ($0.54)
is shown as **American odds** instead: `54¢` -> `-117`, `40¢` -> `+150`. Live prices keep converting as they move.
It only rewrites the text you see; it never clicks or changes anything on the site.

## Install / update (Brave)
1. Download this `exch-odds-extension` folder to your PC (replace the old one).
2. `brave://extensions` -> **Developer mode** on -> **Load unpacked** (or hit the reload on it if it's already there).
3. Refresh Novig / ProphetX.

**Alt+A** flips back to the site's own prices (remembered). The "AMX" pill bottom-left shows it's running; tap it to hide it.
Prices are converted as shown (no fee added); anything under 3% or over 97% (fees etc.) is left alone.


## Making orders (v1.9)
- Click into any box / start typing: the whole page goes back to the site's own %/¢ (pill says "paused while typing"). Type the price the way the site wants it (%: -150 = 60, -110 = 52.4, +120 = 45.5).
- Click out of the box: American odds again.


## v2.0
- **ProphetX:** the 2% fee on winnings is baked into every price shown (what you actually get).
- **To-win helper:** tap the AMX pill to cycle $100 / $150 / $200 / $300 / $400 / off (remembered). Hover any converted price: "to win $200: bet $234". Shift+tap the pill hides it.
