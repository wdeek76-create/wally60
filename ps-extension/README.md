# PropShop CSV Auto-Format (Chrome extension)

Download a **Tabs** or **Sharpr** NBA projections CSV the normal way and a PropShop-ready copy
(`TABSPS2026-11-13.csv` / `SHARPRPS2026-11-13.csv`) is written to the same folder. Upload that one to PropShop.
Any other CSV is left alone. Output is the same as the blender's EXPORT PS button.

## Install (once)
1. Chrome → `chrome://extensions` → turn on **Developer mode** (top right).
2. **Load unpacked** → pick this `ps-extension` folder.
3. On the extension's card click **Details** → turn on **Allow access to file URLs** (it needs this to read the downloaded file).

That's it. The toolbar icon shows the last conversions and an on/off switch.

## Notes
- Sharpr has no minutes column, so Minutes is blank in its PS file (PropShop accepts that).
- Players with no numbers (OUT) are dropped, same as the blender.
- To update: replace the folder's files and hit the refresh arrow on the extension card.
