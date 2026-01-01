(function(){
  function fmtDate(d){ return d.toISOString().slice(0,10); }
  function monthLabel(year, monthIndex){
    const dt = new Date(year, monthIndex, 1);
    return dt.toLocaleString(undefined,{month:'short', year:'numeric'});
  }

  const app = document.getElementById('app');
  const today = new Date();
  today.setHours(0,0,0,0);

  // Build an array of the current month and previous 11 months (12 months total)
  const months = [];
  for (let i = 0; i < 12; i++){
    const first = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = first.getFullYear();
    const month = first.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++){
      const dt = new Date(year, month, d);
      // Include all days in the current month (i===0), including future ones; for previous months these will all be <= today
      if (i === 0) arr.push(dt);
      else {
        if (dt > today) break;
        arr.push(dt);
      }
    }
    months.push({year, month, days: arr});
  }

  const summary = document.createElement('div');
  summary.className = 'summary';
  app.appendChild(summary);

  const container = document.createElement('div');
  container.className = 'tracker';

  // Render months: oldest first (12 months back -> current)
  months.slice().reverse().forEach(m => {
    const row = document.createElement('div');
    row.className = 'month-row';

    const label = document.createElement('div');
    label.className = 'month-label';
    label.textContent = monthLabel(m.year, m.month);
    row.appendChild(label);

    const daysWrap = document.createElement('div');
    daysWrap.className = 'days-wrap';

    m.days.forEach(d => {
      const iso = fmtDate(d);
      const sq = document.createElement('div');
      sq.className = 'day-square';
      sq.dataset.date = iso;
      sq.title = iso;
      // Mark week starts (Sunday) to draw a subtle separator line
      if (d.getDay() === 0) sq.classList.add('week-start');

      // Render state: done (green) if stored, not-done (red) if past and not done, today remains neutral unless done
      const stored = localStorage.getItem('day-'+iso);
      const todayIso = new Date().toISOString().slice(0,10);
      if (stored === '1') sq.classList.add('done');
      else if (iso < todayIso) sq.classList.add('not-done');

      sq.addEventListener('click', () => {
        sq.classList.toggle('done');
        const todayIso2 = new Date().toISOString().slice(0,10);
        if (sq.classList.contains('done')) {
          localStorage.setItem('day-'+iso,'1');
          sq.classList.remove('not-done');
        } else {
          localStorage.removeItem('day-'+iso);
          // if the date is in the past, mark as not-done visually
          if (iso < todayIso2) sq.classList.add('not-done');
          else sq.classList.remove('not-done');
        }
        updateSummary();
      });
      daysWrap.appendChild(sq);
    });

    row.appendChild(daysWrap);
    container.appendChild(row);
  });

  app.appendChild(container);

  // Toolbar bindings
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const themeSelect = document.getElementById('themeSelect');
  const showWeekSep = document.getElementById('showWeekSep');

  exportBtn.addEventListener('click', () => exportData());
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { applyImport(JSON.parse(r.result)); }
      catch(err){ alert('Invalid JSON'); }
      importFile.value = '';
    };
    r.readAsText(f);
  });

  themeSelect.addEventListener('change', () => {
    document.documentElement.setAttribute('data-theme', themeSelect.value);
  });

  // Week separator toggle (persist preference)
  const weekPref = localStorage.getItem('showWeekSeparators');
  if (weekPref === '1') {
    document.documentElement.classList.add('show-week-separators');
    if (showWeekSep) showWeekSep.checked = true;
  }
  if (showWeekSep) showWeekSep.addEventListener('change', () => {
    if (showWeekSep.checked) {
      document.documentElement.classList.add('show-week-separators');
      localStorage.setItem('showWeekSeparators','1');
    } else {
      document.documentElement.classList.remove('show-week-separators');
      localStorage.removeItem('showWeekSeparators');
    }
  });

  function exportData(){
    const done = [];
    Object.keys(localStorage).forEach(k => {
      if (!k.startsWith('day-')) return;
      const d = k.slice(4);
      const v = localStorage.getItem(k);
      if (v === '1') done.push(d);
    });
    const blob = new Blob([JSON.stringify({done}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'day-tracker.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function applyImport(obj){
    // Accept either an array (treated as done list) or {done: []}
    const done = Array.isArray(obj) ? obj : obj && Array.isArray(obj.done) ? obj.done : null;
    if (!Array.isArray(done)) { alert('JSON must be an array or {done: []}'); return; }
    // clear existing day- keys
    Object.keys(localStorage).forEach(k => { if (k.startsWith('day-')) localStorage.removeItem(k); });
    // set done keys
    done.forEach(d => localStorage.setItem('day-'+d,'1'));
    // update DOM: mark done or not-done (past dates without done)
    const todayIso = new Date().toISOString().slice(0,10);
    container.querySelectorAll('.day-square').forEach(sq => {
      const iso = sq.dataset.date;
      sq.classList.remove('done','not-done');
      if (localStorage.getItem('day-'+iso) === '1') sq.classList.add('done');
      else if (iso < todayIso) sq.classList.add('not-done');
    });
    updateSummary();
  }

  function updateSummary(){
    const all = container.querySelectorAll('.day-square').length;
    const done = container.querySelectorAll('.day-square.done').length;
    const pct = all ? Math.round(done / all * 100) : 0;
    summary.textContent = `${done}/${all} days — ${pct}% complete`;
  }

  updateSummary();
})();
