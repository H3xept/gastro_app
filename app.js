// Gastro Tracker — offline-first PWA
// All data lives in IndexedDB on this device; nothing is uploaded.

(() => {
  'use strict';

  // ------------------------------------------------------------------ DB
  const DB_NAME = 'gastro-tracker';
  const STORE = 'entries';
  const DB_VERSION = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('type', 'type');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbAdd(entry) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => res(entry);
      tx.onerror = () => rej(tx.error);
    });
  }

  async function dbDelete(id) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async function dbAll() {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async function dbClear() {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  // ------------------------------------------------------------------ Constants
  const MEAL_TAGS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'];

  const BRISTOL = {
    1: 'Separate hard lumps (constipation)',
    2: 'Lumpy, sausage-shaped',
    3: 'Sausage with cracks',
    4: 'Smooth, soft sausage (ideal)',
    5: 'Soft blobs, clear edges',
    6: 'Mushy, ragged edges',
    7: 'Watery, no solid pieces (diarrhea)'
  };

  const TYPE_META = {
    food: { label: 'Food', emoji: '🍽️', color: 'food' },
    bloating: { label: 'Bloating', emoji: '🎈', color: 'bloating' },
    bowel: { label: 'Bowel movement', emoji: '🚽', color: 'bowel' },
    sleep: { label: 'Sleep', emoji: '🌙', color: 'sleep' }
  };

  // ------------------------------------------------------------------ Utils
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function toLocalDatetimeInput(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromLocalDatetimeInput(value) {
    if (!value) return Date.now();
    return new Date(value).getTime();
  }

  function toDateInput(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fmtDateTime(ts) {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return time;
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${date} · ${time}`;
  }

  function fmtDuration(ms) {
    if (!ms || ms < 0) return '';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.round((ms % 3_600_000) / 60_000);
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }

  function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  function endOfDay(ts) {
    const d = new Date(ts);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  function showToast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function csvEscape(value) {
    if (value === undefined || value === null) return '';
    const s = String(value);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ------------------------------------------------------------------ State
  const state = {
    entries: [],
    editingId: null
  };

  async function loadEntries() {
    state.entries = await dbAll();
    state.entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ------------------------------------------------------------------ Views
  function setView(name) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $('#view-title').textContent = { log: 'Log', history: 'History', export: 'Export' }[name];
    if (name === 'history') renderHistory();
    if (name === 'export') renderExportSummary();
    if (name === 'log') renderToday();
  }

  function entryTitle(entry) {
    const meta = TYPE_META[entry.type];
    if (entry.type === 'food') {
      return entry.data.description || 'Food';
    }
    if (entry.type === 'bloating') {
      return `Bloating · ${entry.data.severity}/10`;
    }
    if (entry.type === 'bowel') {
      return `Bowel · Bristol ${entry.data.bristol}`;
    }
    if (entry.type === 'sleep') {
      const dur = fmtDuration((entry.endTimestamp || 0) - entry.timestamp);
      return `Sleep${dur ? ` · ${dur}` : ''}`;
    }
    return meta.label;
  }

  function entryMeta(entry) {
    const parts = [];
    parts.push(fmtDateTime(entry.timestamp));
    if (entry.type === 'food' && entry.data.tag) parts.push(entry.data.tag);
    if (entry.type === 'bowel') {
      const flags = [];
      if (entry.data.urgency) flags.push(`urgency ${entry.data.urgency}/5`);
      if (entry.data.blood) flags.push('blood');
      if (entry.data.pain) flags.push('pain');
      if (entry.data.incomplete) flags.push('incomplete');
      if (flags.length) parts.push(flags.join(', '));
    }
    if (entry.type === 'sleep' && entry.data.quality) {
      parts.push(`quality ${entry.data.quality}/5`);
    }
    if (entry.type === 'sleep' && entry.endTimestamp) {
      parts.push(`${fmtDateTime(entry.timestamp)} → ${fmtDateTime(entry.endTimestamp)}`);
    }
    return parts.join(' · ');
  }

  function renderEntry(entry) {
    const meta = TYPE_META[entry.type];
    const li = document.createElement('li');
    li.className = 'entry';
    li.dataset.id = entry.id;
    li.innerHTML = `
      <div class="badge" aria-hidden="true">${meta.emoji}</div>
      <div class="entry-body">
        <p class="entry-title">${escapeHtml(entryTitle(entry))} <span class="entry-pill">${meta.label}</span></p>
        <div class="entry-meta">${escapeHtml(entryMeta(entry))}</div>
        ${entry.notes ? `<div class="entry-notes">${escapeHtml(entry.notes)}</div>` : ''}
      </div>
    `;
    li.addEventListener('click', () => openEntryModal(entry.type, entry));
    return li;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderToday() {
    const list = $('#today-list');
    list.innerHTML = '';
    const start = startOfDay(Date.now());
    const todays = state.entries.filter(e => e.timestamp >= start);
    if (!todays.length) {
      list.innerHTML = '<li class="empty">No entries yet today. Tap a button above to log one.</li>';
      return;
    }
    todays.forEach(e => list.appendChild(renderEntry(e)));
  }

  function renderHistory() {
    const list = $('#history-list');
    list.innerHTML = '';
    const fromVal = $('#filter-from').value;
    const toVal = $('#filter-to').value;
    const typeVal = $('#filter-type').value;

    const fromTs = fromVal ? startOfDay(new Date(fromVal).getTime()) : -Infinity;
    const toTs = toVal ? endOfDay(new Date(toVal).getTime()) : Infinity;

    const filtered = state.entries.filter(e => {
      if (e.timestamp < fromTs || e.timestamp > toTs) return false;
      if (typeVal && e.type !== typeVal) return false;
      return true;
    });

    if (!filtered.length) {
      list.innerHTML = '<li class="empty">No entries match these filters.</li>';
      return;
    }

    let lastDate = '';
    filtered.forEach(e => {
      const d = new Date(e.timestamp).toDateString();
      if (d !== lastDate) {
        const header = document.createElement('li');
        header.className = 'section-title';
        header.style.listStyle = 'none';
        header.style.marginTop = lastDate ? '16px' : '0';
        header.textContent = new Date(e.timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        list.appendChild(header);
        lastDate = d;
      }
      list.appendChild(renderEntry(e));
    });
  }

  function renderExportSummary() {
    const counts = { food: 0, bloating: 0, bowel: 0, sleep: 0 };
    state.entries.forEach(e => { if (counts[e.type] !== undefined) counts[e.type]++; });
    const total = state.entries.length;
    const oldest = state.entries.length ? state.entries[state.entries.length - 1].timestamp : null;
    const summary = $('#export-summary');
    if (!total) {
      summary.innerHTML = '<strong>No entries yet.</strong> Log a few and come back.';
      return;
    }
    summary.innerHTML = `
      <strong>${total}</strong> entries since <strong>${new Date(oldest).toLocaleDateString()}</strong><br>
      🍽️ ${counts.food} food · 🎈 ${counts.bloating} bloating · 🚽 ${counts.bowel} bowel · 🌙 ${counts.sleep} sleep
    `;
  }

  // ------------------------------------------------------------------ Forms
  function buildForm(type, entry) {
    const form = $('#entry-form');
    form.innerHTML = '';
    const data = entry?.data || {};
    const ts = entry?.timestamp ?? Date.now();

    const meta = TYPE_META[type];
    $('#modal-title').textContent = `${meta.emoji} ${entry ? 'Edit' : 'New'} ${meta.label.toLowerCase()}`;

    if (type === 'sleep') {
      const endTs = entry?.endTimestamp ?? Date.now();
      form.insertAdjacentHTML('beforeend', `
        <div class="row">
          <label>Went to bed
            <input type="datetime-local" name="start" value="${toLocalDatetimeInput(ts)}" required />
          </label>
          <label>Woke up
            <input type="datetime-local" name="end" value="${toLocalDatetimeInput(endTs)}" required />
          </label>
        </div>
      `);
    } else {
      form.insertAdjacentHTML('beforeend', `
        <label>When
          <input type="datetime-local" name="time" value="${toLocalDatetimeInput(ts)}" required />
        </label>
      `);
    }

    if (type === 'food') {
      form.insertAdjacentHTML('beforeend', `
        <label>What did you eat / drink?
          <textarea name="description" placeholder="e.g. Oat porridge with banana, black coffee" required>${escapeHtml(data.description || '')}</textarea>
        </label>
        <label>Meal
          <div class="chips" data-chip-group="tag">
            ${MEAL_TAGS.map(t => `<button type="button" class="chip${data.tag === t ? ' selected' : ''}" data-value="${t}">${t}</button>`).join('')}
          </div>
        </label>
        <label>Portion (optional)
          <input type="text" name="portion" placeholder="e.g. small bowl, 1 cup" value="${escapeHtml(data.portion || '')}" />
        </label>
      `);
    }

    if (type === 'bloating') {
      const sev = data.severity ?? 5;
      form.insertAdjacentHTML('beforeend', `
        <div class="slider-row">
          <div class="slider-head">
            <label for="severity">Severity</label>
            <span class="slider-value" data-slider-value="severity">${sev}/10</span>
          </div>
          <input id="severity" type="range" name="severity" min="1" max="10" step="1" value="${sev}" />
        </div>
        <label>Where? (optional)
          <input type="text" name="location" placeholder="e.g. upper abdomen, lower right" value="${escapeHtml(data.location || '')}" />
        </label>
      `);
    }

    if (type === 'bowel') {
      const bristol = data.bristol ?? 4;
      const urgency = data.urgency ?? 0;
      form.insertAdjacentHTML('beforeend', `
        <div>
          <label style="margin-bottom:6px;">Bristol stool scale</label>
          <div class="bristol-grid" data-bristol>
            ${[1,2,3,4,5,6,7].map(n => `<button type="button" class="bristol-btn${bristol === n ? ' selected' : ''}" data-value="${n}">${n}</button>`).join('')}
          </div>
          <div class="bristol-desc" data-bristol-desc>${BRISTOL[bristol]}</div>
        </div>
        <div class="slider-row">
          <div class="slider-head">
            <label for="urgency">Urgency</label>
            <span class="slider-value" data-slider-value="urgency">${urgency ? urgency + '/5' : 'none'}</span>
          </div>
          <input id="urgency" type="range" name="urgency" min="0" max="5" step="1" value="${urgency}" />
        </div>
        <div class="chips" data-chip-group="flags" data-multi="true">
          <button type="button" class="chip${data.blood ? ' selected' : ''}" data-value="blood">Blood</button>
          <button type="button" class="chip${data.pain ? ' selected' : ''}" data-value="pain">Pain</button>
          <button type="button" class="chip${data.incomplete ? ' selected' : ''}" data-value="incomplete">Felt incomplete</button>
          <button type="button" class="chip${data.mucus ? ' selected' : ''}" data-value="mucus">Mucus</button>
        </div>
      `);
    }

    if (type === 'sleep') {
      const quality = data.quality ?? 3;
      form.insertAdjacentHTML('beforeend', `
        <div class="slider-row">
          <div class="slider-head">
            <label for="quality">Quality</label>
            <span class="slider-value" data-slider-value="quality">${quality}/5</span>
          </div>
          <input id="quality" type="range" name="quality" min="1" max="5" step="1" value="${quality}" />
        </div>
        <label>Wake-ups during the night (optional)
          <input type="number" name="wakeups" min="0" max="20" value="${data.wakeups ?? ''}" />
        </label>
      `);
    }

    form.insertAdjacentHTML('beforeend', `
      <label>Notes (optional)
        <textarea name="notes" placeholder="Anything else worth recording…">${escapeHtml(entry?.notes || '')}</textarea>
      </label>
    `);

    $$('input[type="range"]', form).forEach(input => {
      input.addEventListener('input', () => {
        const display = $(`[data-slider-value="${input.name}"]`, form);
        if (!display) return;
        if (input.name === 'urgency') {
          display.textContent = input.value === '0' ? 'none' : `${input.value}/5`;
        } else {
          const max = input.max || 10;
          display.textContent = `${input.value}/${max}`;
        }
      });
    });

    $$('[data-chip-group]:not([data-multi])', form).forEach(group => {
      group.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const wasSelected = chip.classList.contains('selected');
        $$('.chip', group).forEach(c => c.classList.remove('selected'));
        if (!wasSelected) chip.classList.add('selected');
      });
    });

    $$('[data-multi]', form).forEach(group => {
      group.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        chip.classList.toggle('selected');
      });
    });

    const bristolGroup = $('[data-bristol]', form);
    if (bristolGroup) {
      bristolGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.bristol-btn');
        if (!btn) return;
        $$('.bristol-btn', bristolGroup).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        $('[data-bristol-desc]', form).textContent = BRISTOL[+btn.dataset.value];
      });
    }
  }

  function readForm(type) {
    const form = $('#entry-form');
    const fd = new FormData(form);
    const notes = (fd.get('notes') || '').toString().trim();

    if (type === 'sleep') {
      const start = fromLocalDatetimeInput(fd.get('start'));
      const end = fromLocalDatetimeInput(fd.get('end'));
      if (end <= start) {
        showToast('Wake-up time must be after bedtime.');
        return null;
      }
      const quality = +fd.get('quality') || 3;
      const wakeups = fd.get('wakeups') === '' || fd.get('wakeups') == null ? null : +fd.get('wakeups');
      return {
        type: 'sleep',
        timestamp: start,
        endTimestamp: end,
        data: { quality, wakeups },
        notes
      };
    }

    const timestamp = fromLocalDatetimeInput(fd.get('time'));
    const data = {};

    if (type === 'food') {
      data.description = (fd.get('description') || '').toString().trim();
      if (!data.description) { showToast('Please describe what you ate or drank.'); return null; }
      const tagChip = $('[data-chip-group="tag"] .chip.selected', form);
      if (tagChip) data.tag = tagChip.dataset.value;
      const portion = (fd.get('portion') || '').toString().trim();
      if (portion) data.portion = portion;
    }

    if (type === 'bloating') {
      data.severity = +fd.get('severity') || 5;
      const location = (fd.get('location') || '').toString().trim();
      if (location) data.location = location;
    }

    if (type === 'bowel') {
      const bristolBtn = $('[data-bristol] .bristol-btn.selected', form);
      data.bristol = bristolBtn ? +bristolBtn.dataset.value : 4;
      const urgency = +fd.get('urgency') || 0;
      if (urgency) data.urgency = urgency;
      $$('[data-multi="true"] .chip.selected', form).forEach(c => {
        data[c.dataset.value] = true;
      });
    }

    return { type, timestamp, data, notes };
  }

  // ------------------------------------------------------------------ Modal
  function openEntryModal(type, entry = null) {
    state.editingId = entry?.id || null;
    buildForm(type, entry);
    $('#entry-delete').hidden = !entry;
    $('#modal').setAttribute('aria-hidden', 'false');
  }

  function closeEntryModal() {
    state.editingId = null;
    $('#modal').setAttribute('aria-hidden', 'true');
  }

  async function saveEntry() {
    const form = $('#entry-form');
    let type;
    if (form.querySelector('[name="start"]')) type = 'sleep';
    else if (form.querySelector('[name="description"]')) type = 'food';
    else if (form.querySelector('[name="severity"]')) type = 'bloating';
    else type = 'bowel';

    const parsed = readForm(type);
    if (!parsed) return;

    const entry = {
      id: state.editingId || uuid(),
      ...parsed,
      updatedAt: Date.now()
    };
    if (!state.editingId) entry.createdAt = Date.now();

    await dbAdd(entry);
    await loadEntries();
    closeEntryModal();
    showToast(state.editingId ? 'Updated' : 'Logged');
    refreshCurrentView();
  }

  async function deleteEntry() {
    if (!state.editingId) return;
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    await dbDelete(state.editingId);
    await loadEntries();
    closeEntryModal();
    showToast('Deleted');
    refreshCurrentView();
  }

  function refreshCurrentView() {
    const active = $('.view.active');
    if (!active) return;
    if (active.id === 'view-log') renderToday();
    if (active.id === 'view-history') renderHistory();
    if (active.id === 'view-export') renderExportSummary();
  }

  // ------------------------------------------------------------------ Export
  function entriesInRange() {
    const fromVal = $('#export-from').value;
    const toVal = $('#export-to').value;
    const fromTs = fromVal ? startOfDay(new Date(fromVal).getTime()) : -Infinity;
    const toTs = toVal ? endOfDay(new Date(toVal).getTime()) : Infinity;
    return state.entries
      .filter(e => e.timestamp >= fromTs && e.timestamp <= toTs)
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  function exportCSV() {
    const rows = entriesInRange();
    if (!rows.length) { showToast('No entries in this range.'); return; }
    const header = [
      'date', 'time', 'type', 'description',
      'severity', 'bristol', 'urgency', 'flags',
      'sleep_start', 'sleep_end', 'sleep_hours', 'sleep_quality', 'wakeups',
      'meal_tag', 'portion', 'location', 'notes'
    ];
    const lines = [header.join(',')];
    for (const e of rows) {
      const d = new Date(e.timestamp);
      const date = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const flags = [];
      if (e.data?.blood) flags.push('blood');
      if (e.data?.pain) flags.push('pain');
      if (e.data?.incomplete) flags.push('incomplete');
      if (e.data?.mucus) flags.push('mucus');
      const sleepStart = e.type === 'sleep' ? new Date(e.timestamp).toISOString() : '';
      const sleepEnd = e.type === 'sleep' && e.endTimestamp ? new Date(e.endTimestamp).toISOString() : '';
      const sleepHours = e.type === 'sleep' && e.endTimestamp
        ? ((e.endTimestamp - e.timestamp) / 3_600_000).toFixed(2) : '';
      const row = [
        date, time, e.type,
        e.type === 'food' ? (e.data.description || '') : '',
        e.type === 'bloating' ? (e.data.severity || '') : '',
        e.type === 'bowel' ? (e.data.bristol || '') : '',
        e.type === 'bowel' ? (e.data.urgency || '') : '',
        flags.join('|'),
        sleepStart, sleepEnd, sleepHours,
        e.type === 'sleep' ? (e.data.quality || '') : '',
        e.type === 'sleep' ? (e.data.wakeups ?? '') : '',
        e.type === 'food' ? (e.data.tag || '') : '',
        e.type === 'food' ? (e.data.portion || '') : '',
        e.type === 'bloating' ? (e.data.location || '') : '',
        e.notes || ''
      ];
      lines.push(row.map(csvEscape).join(','));
    }
    const filename = `gastro-${toDateInput(rows[0].timestamp)}_to_${toDateInput(rows[rows.length-1].timestamp)}.csv`;
    downloadFile(filename, lines.join('\n'), 'text/csv;charset=utf-8');
    showToast('CSV downloaded');
  }

  function exportJSON() {
    const rows = entriesInRange();
    if (!rows.length) { showToast('No entries in this range.'); return; }
    const payload = {
      app: 'gastro-tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: rows
    };
    const filename = `gastro-${toDateInput(rows[0].timestamp)}_to_${toDateInput(rows[rows.length-1].timestamp)}.json`;
    downloadFile(filename, JSON.stringify(payload, null, 2), 'application/json');
    showToast('JSON downloaded');
  }

  // ------------------------------------------------------------------ Import
  async function importJSON(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const entries = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(entries)) throw new Error('Invalid backup file.');
      let added = 0;
      for (const raw of entries) {
        if (!raw || !raw.type || !raw.timestamp) continue;
        const entry = {
          id: raw.id || uuid(),
          type: raw.type,
          timestamp: raw.timestamp,
          endTimestamp: raw.endTimestamp,
          data: raw.data || {},
          notes: raw.notes || '',
          createdAt: raw.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        await dbAdd(entry);
        added++;
      }
      await loadEntries();
      refreshCurrentView();
      showToast(`Imported ${added} entries`);
    } catch (err) {
      showToast('Import failed — file not recognised.');
      console.error(err);
    }
  }

  // ------------------------------------------------------------------ Wire-up
  function init() {
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    $$('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => openEntryModal(btn.dataset.type));
    });

    $('#modal-close').addEventListener('click', closeEntryModal);
    $('#entry-cancel').addEventListener('click', closeEntryModal);
    $('#entry-save').addEventListener('click', saveEntry);
    $('#entry-delete').addEventListener('click', deleteEntry);
    $('#modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') closeEntryModal();
    });

    ['filter-from', 'filter-to', 'filter-type'].forEach(id => {
      $('#' + id).addEventListener('change', renderHistory);
    });

    $('#export-csv').addEventListener('click', exportCSV);
    $('#export-json').addEventListener('click', exportJSON);
    $('#export-print').addEventListener('click', () => {
      const from = $('#export-from').value;
      const to = $('#export-to').value;
      $('#filter-from').value = from;
      $('#filter-to').value = to;
      $('#filter-type').value = '';
      setView('history');
      setTimeout(() => window.print(), 200);
    });

    $('#settings-btn').addEventListener('click', () => {
      updateStorageStats();
      $('#settings-modal').setAttribute('aria-hidden', 'false');
    });
    $('#settings-close').addEventListener('click', () => $('#settings-modal').setAttribute('aria-hidden', 'true'));
    $('#settings-modal').addEventListener('click', (e) => {
      if (e.target.id === 'settings-modal') $('#settings-modal').setAttribute('aria-hidden', 'true');
    });
    $('#clear-btn').addEventListener('click', async () => {
      if (!confirm('Erase ALL entries? This cannot be undone. Consider exporting a JSON backup first.')) return;
      await dbClear();
      await loadEntries();
      refreshCurrentView();
      updateStorageStats();
      showToast('All data erased');
    });
    $('#import-btn').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) await importJSON(file);
      e.target.value = '';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeEntryModal();
        $('#settings-modal').setAttribute('aria-hidden', 'true');
      }
    });

    const today = new Date();
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 13);
    $('#export-from').value = toDateInput(twoWeeksAgo.getTime());
    $('#export-to').value = toDateInput(today.getTime());
  }

  function updateStorageStats() {
    const el = $('#storage-stats');
    const total = state.entries.length;
    if (!total) { el.textContent = 'No entries stored yet.'; return; }
    const oldest = new Date(state.entries[state.entries.length - 1].timestamp).toLocaleDateString();
    const newest = new Date(state.entries[0].timestamp).toLocaleDateString();
    el.textContent = `${total} entries from ${oldest} to ${newest}.`;
  }

  // ------------------------------------------------------------------ Boot
  (async () => {
    init();
    await loadEntries();
    renderToday();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
      });
    }
  })();
})();
