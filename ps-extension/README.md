# PropShop CSV Auto-Format (Chrome extension)

Download an NBA projections CSV the normal way — **Tabs, Sharpr, STOK (Data Hub Stats), RG (projections-nba), Saber,
RotoWire or Dimers** — and it is replaced by the PropShop version, named with the source and the time it came down: `RG-NBA 2.17pm.csv`, `TABS-NBA 9.40am.csv`, ...
Upload that to PropShop (the blender's Upload tab takes it too). Any other CSV is left alone. Output is the same as the blender's EXPORT PS button.
Want the raw export kept as well? Tick **Keep the original file too** in the toolbar popup.

## Install (once)
1. Chrome → `chrome://extensions` → turn on **Developer mode** (top right).
2. **Load unpacked** → pick this `ps-extension` folder.
3. On the extension's card click **Details** → turn on **Allow access to file URLs** (it needs this to read the downloaded file).

That's it. The toolbar icon shows the last conversions and an on/off switch.

## Notes
- Sharpr, RG and Dimers exports have no minutes column, so Minutes is blank in their PS files (PropShop accepts that).
- An export with no numbers in it yet (RG before it publishes, a header-only Sharpr file) gets a "nothing to convert" notice instead of an empty file.
- Players with no numbers (OUT) are dropped, same as the blender.
- Each file name carries the download time, so re-downloading later in the day never overwrites the earlier one.
- To update: replace the folder's files and hit the refresh arrow on the extension card.
