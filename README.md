# Day Tracker — Last 365 Days

Simple JS app that displays the last 365 days as small squares grouped by month (each row is a month). Click any square to toggle completion; data is stored in `localStorage`.

Run locally:
```bash
node start-server.js
# then open http://localhost:3000 in your browser
```

No dependencies required.

Features added:
- Export completed days to JSON (`Export JSON` button)
- Import completed days from JSON (`Import JSON` button)
- Theme selector (Default, Dark, Pastel)
- Clear all saved days (`Clear All`)

JSON import/export format
------------------------

The app now imports and exports a simple JSON shape describing completed days.

- Export: the `Export JSON` button downloads a file containing an object with a `done` array:

```json
{
	"done": ["2025-12-30", "2025-12-25", ...]
}
```

- Import: the `Import JSON` button accepts either the same object above or a plain array of date strings. Example files are provided as [test-data.json](test-data.json).

Behavior when importing:
- Any date present in `done` will be shown green (captured).
- Any past date (before today) that is NOT present in `done` will be shown red (not captured).
- Today's date and future is neutral (grey) unless it appears in `done`, in which case it will be shown green.

To test quickly, import the provided [test-data.json](test-data.json) file.

ToDo:
- Fix homeassistant code, to pull entities directly (vs. using API)