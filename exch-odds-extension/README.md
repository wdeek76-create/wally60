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


## Making orders (v1.8)
- While you type in a box, the form around it stays in the site's %/¢ (no garbling).
- Type American odds in a price box: `-150` / `+120`, then **Enter** or **Tab** -> it fills the % the site wants (60 / 45.5). Enter only converts; press Enter again to submit.
- Or just type the % (e.g. 60 for -150).
