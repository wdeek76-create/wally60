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


## v3.0
- American odds everywhere, all the time (like 1.2).
- **Bottom-left switch:** `AMX ON` (green) / `AMX OFF · %/¢` (grey) -- tap OFF to make an order in the site's own prices, ON when you're done. Remembered. Alt+A does the same.
- ProphetX odds include its 2% fee on winnings.
- `Win $X`: hover a price to see how much to bet to win that amount (tap to change / turn off).
- `Fill $X`: an empty bet-slip amount box gets that amount (or the smaller max shown). Never the price box, never over what you typed, never presses Place. Tap to change / turn off.
