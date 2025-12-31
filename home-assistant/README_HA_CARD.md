Home Assistant Day Tracker Card

Install
1. Copy `day-tracker-card.js` to your Home Assistant `www` folder (e.g. `/config/www/day-tracker-card.js`).
2. Add the resource to Lovelace (Configuration → Dashboards → Resources) with URL `/local/day-tracker-card.js` and type `module`.
3. Add the card to a Lovelace view using YAML or the UI.

Example Lovelace YAML

```yaml
- type: 'custom:day-tracker-card'
  title: 'Calendar Progress'
  entity: calendar.work
  # or
  # entities:
  #   - calendar.work
  #   - calendar.personal
```

Behavior
- The card requests events from Home Assistant's calendar API for the last 12 months (current month + previous 11 months).
- Dates with events are shown green.
- Past dates without events are shown red.
- Today stays grey unless it has events.

Notes
- The card uses the endpoint `/api/calendars/<entity_id>?start_time=...&end_time=...` to fetch events. This works when used from the Home Assistant UI (session cookies).
- The card is read-only; creating events should be done via the calendar integration or other cards.
