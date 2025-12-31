class DayTrackerCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) throw new Error('Please define an entity (calendar) in the card configuration');
    this.config = Object.assign({ title: 'Day Tracker', entities: [config.entity] }, config);
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.update();
  }

  getCardSize() { return 6; }

  async update() {
    if (!this._hass) return;
    // compute months: current month and previous 11 months
    const today = new Date();
    today.setHours(0,0,0,0);

    const months = [];
    for (let i = 0; i < 12; i++){
      const first = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = first.getFullYear();
      const month = first.getMonth();
      const daysInMonth = new Date(year, month+1, 0).getDate();
      const arr = [];
      for (let d = 1; d <= daysInMonth; d++){
        const dt = new Date(year, month, d);
        // include all days for current month, previous months only up to today
        if (i === 0) arr.push(new Date(dt));
        else { if (dt > today) break; arr.push(new Date(dt)); }
      }
      months.push({ year, month, days: arr });
    }

    // fetch events from configured calendars between first day (oldest) and last day (current month end)
    const oldest = months[months.length-1].days[0];
    const lastMonth = months[0];
    const lastDayArr = lastMonth.days[lastMonth.days.length - 1];
    const startISO = new Date(oldest.getFullYear(), oldest.getMonth(), 1).toISOString();
    const endISO = new Date(lastDayArr.getFullYear(), lastDayArr.getMonth(), lastDayArr.getDate(), 23,59,59).toISOString();

    const doneDates = new Set();

    // Helper: try several methods to fetch calendar events for an entity
    const fetchEventsForEntity = async (entity) => {
      const results = null;
      const pathWithQuery = `calendars/${entity}?start_time=${encodeURIComponent(startISO)}&end_time=${encodeURIComponent(endISO)}`;

      // 1) Try callWS with several likely message types/params
      if (this._hass && typeof this._hass.callWS === 'function') {
        const wsAttempts = [
          { type: 'calendar/events', entity_id: entity, start_time: startISO, end_time: endISO },
          { type: 'calendar/list_events', entity_id: entity, start_time: startISO, end_time: endISO },
          { type: 'calendar/get_events', entity_id: entity, start_time: startISO, end_time: endISO },
          { type: 'calendars/list_events', entity_id: entity, start_time: startISO, end_time: endISO }
        ];
        for (const msg of wsAttempts) {
          try {
            const r = await this._hass.callWS(msg);
            if (Array.isArray(r)) return r;
            // some responses may wrap events
            if (r && Array.isArray(r.events)) return r.events;
          } catch (e) {
            // continue to next attempt
            console.debug('callWS attempt failed', msg.type, e);
          }
        }
      }

      // 2) Try callApi if available (handles auth/session)
      if (this._hass && typeof this._hass.callApi === 'function') {
        try {
          const r = await this._hass.callApi('GET', pathWithQuery);
          if (Array.isArray(r)) return r;
          if (r && Array.isArray(r.events)) return r.events;
        } catch (e) {
          console.debug('callApi failed for', entity, e);
        }
      }

      // 3) Fallback to fetch with same-origin credentials (session cookie)
      try {
        const url = `/api/${pathWithQuery}`;
        const resp = await fetch(url, { credentials: 'same-origin' });
        if (resp.ok) {
          const r = await resp.json();
          if (Array.isArray(r)) return r;
          if (r && Array.isArray(r.events)) return r.events;
        } else {
          console.debug('fetch same-origin failed', entity, resp.status);
        }
      } catch (e) {
        console.debug('fetch same-origin error', e);
      }

      // 4) If user provided an access token in config, try Authorization header
      if (this.config && this.config.token) {
        try {
          const url = `/api/${pathWithQuery}`;
          const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + this.config.token } });
          if (resp.ok) {
            const r = await resp.json();
            if (Array.isArray(r)) return r;
            if (r && Array.isArray(r.events)) return r.events;
          } else {
            console.debug('fetch with token failed', resp.status);
          }
        } catch (e) {
          console.debug('fetch with token error', e);
        }
      }

      // nothing worked
      return null;
    };

    for (const entity of this.config.entities) {
      try {
        const events = await fetchEventsForEntity(entity);
        if (!events) continue;
        events.forEach(ev => {
          const s = ev.start || ev.start_time || ev.start_date || ev.start_date_time;
          if (!s) return;
          const d = new Date(s);
          if (isNaN(d)) return;
          doneDates.add(d.toISOString().slice(0,10));
        });
      } catch (err) {
        console.error('calendar fetch', entity, err);
      }
    }

    // render
    this.shadowRoot.innerHTML = this.template();
    const container = this.shadowRoot.querySelector('.tracker');
    // fill months oldest-first (top -> oldest)
    months.slice().reverse().forEach(m => {
      const row = document.createElement('div'); row.className = 'month-row';
      const label = document.createElement('div'); label.className = 'month-label';
      label.textContent = new Date(m.year, m.month, 1).toLocaleString(undefined,{month:'short', year:'numeric'});
      row.appendChild(label);
      const daysWrap = document.createElement('div'); daysWrap.className = 'days-wrap';
      m.days.forEach(d => {
        const iso = d.toISOString().slice(0,10);
        const sq = document.createElement('div'); sq.className = 'day-square'; sq.dataset.date = iso; sq.title = iso;
        // week start marker (Sunday)
        if (d.getDay() === 0) sq.classList.add('week-start');
        const todayIso = new Date().toISOString().slice(0,10);
        if (doneDates.has(iso)) sq.classList.add('done');
        else if (iso < todayIso) sq.classList.add('not-done');
        daysWrap.appendChild(sq);
      });
      row.appendChild(daysWrap);
      container.appendChild(row);
    });

    // update summary
    const all = this.shadowRoot.querySelectorAll('.day-square').length;
    const done = this.shadowRoot.querySelectorAll('.day-square.done').length;
    const summary = this.shadowRoot.querySelector('.summary');
    if (summary) summary.textContent = `${done}/${all} days — ${Math.round(done/all*100)}% complete`;
  }

  render(){
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = this.template();
  }

  template(){
    const style = `
      :host{display:block;font-family:system-ui,Arial;margin:10px}
      .summary{font-weight:600;margin-bottom:6px}
      .tracker{display:flex;flex-direction:column;gap:8px}
      .month-row{display:flex;align-items:center}
      .month-label{width:96px;flex:0 0 96px;color:#666}
      .days-wrap{display:flex;gap:6px;overflow:auto;padding-bottom:4px}
      .day-square{width:14px;height:14px;background:#eee;border-radius:3px}
      .day-square.done{background:#4caf50}
      .day-square.not-done{background:#f87171}
      .day-square.week-start::before{content:'';position:absolute}
    `;
    return `<style>${style}</style>
      <div class="card">
        <div class="summary">${this.config.title}</div>
        <div class="tracker"></div>
      </div>`;
  }
}

customElements.define('day-tracker-card', DayTrackerCard);

/*
Usage (Lovelace YAML):

resources:
  - url: /local/day-tracker-card.js
    type: module

cards:
  - type: 'custom:day-tracker-card'
    title: 'My Calendar Progress'
    entity: calendar.my_calendar   # or use entities: [calendar.one, calendar.two]

Notes:
- The card fetches events from Home Assistant's calendar API endpoint for the given calendar entity id(s).
- It marks days green if any event exists on that date, red for past dates without events, and grey for today and future days (unless an event exists).
*/
