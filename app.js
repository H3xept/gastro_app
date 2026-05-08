// Gut Tracker — main app controller.
// Tab navigation, entry dialog, history rendering, exports.

const TYPES = {
  food: {
    label: "Food",
    icon: "🍽️",
    title: (e) => e.data.description || "Food",
    meta: (e) => {
      const bits = [];
      if (e.data.portion) bits.push(cap(e.data.portion));
      if (e.data.tags && e.data.tags.length) bits.push(e.data.tags.join(", "));
      return bits.join(" · ");
    },
    fields: [
      {
        key: "description",
        type: "text",
        label: "What did you eat / drink?",
        placeholder: "e.g. Oat porridge with banana",
        required: true,
      },
      {
        key: "portion",
        type: "seg",
        label: "Portion",
        options: [
          ["small", "Small"],
          ["medium", "Medium"],
          ["large", "Large"],
        ],
        default: "medium",
      },
      {
        key: "tags",
        type: "checks",
        label: "Tags (optional)",
        options: [
          "dairy",
          "gluten",
          "spicy",
          "fatty",
          "fried",
          "high-fibre",
          "caffeine",
          "alcohol",
          "sugar",
          "processed",
        ],
      },
    ],
  },

  bloating: {
    label: "Bloating",
    icon: "🎈",
    title: (e) => `Bloating ${e.data.severity}/10`,
    meta: (e) => {
      const bits = [];
      if (e.data.pain != null) bits.push(`Pain ${e.data.pain}/10`);
      if (e.data.location) bits.push(cap(e.data.location));
      return bits.join(" · ");
    },
    fields: [
      {
        key: "severity",
        type: "seg",
        label: "Bloating severity",
        options: range(0, 10).map((n) => [n, String(n)]),
        default: 5,
        labels: ["None", "Severe"],
        cast: Number,
      },
      {
        key: "pain",
        type: "seg",
        label: "Pain / cramping",
        options: range(0, 10).map((n) => [n, String(n)]),
        default: 0,
        labels: ["None", "Severe"],
        cast: Number,
      },
      {
        key: "location",
        type: "seg",
        label: "Location",
        options: [
          ["whole", "Whole"],
          ["upper", "Upper"],
          ["lower", "Lower"],
          ["left", "Left"],
          ["right", "Right"],
        ],
        default: "whole",
      },
    ],
  },

  bm: {
    label: "Bowel movement",
    icon: "💩",
    title: (e) => `Bristol type ${e.data.bristol}`,
    meta: (e) => {
      const bits = [];
      const flags = [];
      if (e.data.urgency && e.data.urgency !== "none")
        bits.push(`${cap(e.data.urgency)} urgency`);
      if (e.data.flags) flags.push(...e.data.flags);
      if (flags.length) bits.push(flags.join(", "));
      return bits.join(" · ");
    },
    fields: [
      {
        key: "bristol",
        type: "seg",
        label: "Bristol stool scale",
        options: range(1, 7).map((n) => [n, String(n)]),
        default: 4,
        labels: ["1 = hard lumps", "7 = liquid"],
        cast: Number,
        help: "1 lumps · 2 lumpy sausage · 3 cracked sausage · 4 smooth · 5 soft blobs · 6 mushy · 7 liquid",
      },
      {
        key: "urgency",
        type: "seg",
        label: "Urgency",
        options: [
          ["none", "None"],
          ["mild", "Mild"],
          ["urgent", "Urgent"],
        ],
        default: "none",
      },
      {
        key: "flags",
        type: "checks",
        label: "Anything notable?",
        options: ["blood", "mucus", "pain", "incomplete", "straining"],
      },
    ],
  },

  sleep: {
    label: "Sleep",
    icon: "😴",
    title: (e) => {
      const h = sleepHoursFromEntry(e);
      return h != null ? `${h.toFixed(1)}h sleep` : "Sleep";
    },
    meta: (e) => {
      const bits = [];
      if (e.data.bedtime) bits.push(`Bed ${formatTimeShort(e.data.bedtime)}`);
      if (e.data.quality != null) bits.push(`Quality ${e.data.quality}/5`);
      if (e.data.wakeups) bits.push(`${e.data.wakeups} wake-ups`);
      return bits.join(" · ");
    },
    fields: [
      {
        key: "bedtime",
        type: "datetime",
        label: "Went to bed",
        required: true,
      },
      {
        key: "quality",
        type: "seg",
        label: "Sleep quality",
        options: range(1, 5).map((n) => [n, String(n)]),
        default: 3,
        labels: ["1 = poor", "5 = great"],
        cast: Number,
      },
      {
        key: "wakeups",
        type: "number",
        label: "Night wake-ups",
        default: 0,
        min: 0,
        max: 30,
        cast: Number,
      },
    ],
  },
};

// ------------ DOM helpers ------------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v != null && v !== false) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ------------ Date helpers ------------

function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

function fromLocalInputValue(value) {
  // datetime-local has no zone. Treat as local time.
  if (!value) return null;
  return new Date(value).toISOString();
}

function formatTimeShort(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function isToday(iso) {
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

function sleepHoursFromEntry(e) {
  if (!e.data.bedtime || !e.time) return null;
  const ms = new Date(e.time) - new Date(e.data.bedtime);
  return ms > 0 ? ms / 3_600_000 : null;
}

// ------------ State ------------

const state = {
  currentView: "log",
  editingId: null,
  editingType: null,
  formValues: {},
};

// ------------ View switching ------------

function showView(name) {
  state.currentView = name;
  $$(".view").forEach((v) => v.classList.toggle("hidden", v.dataset.view !== name));
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name === "history") renderHistory();
  if (name === "export") renderSummary();
}

$$(".tab").forEach((t) =>
  t.addEventListener("click", () => showView(t.dataset.view)),
);

// ------------ Quick buttons ------------

$$(".quick").forEach((b) =>
  b.addEventListener("click", () => openEntry(b.dataset.open)),
);

const QUICK_ADD = {
  coffee: { description: "Coffee", tags: ["caffeine"] },
  milk: { description: "Milk", tags: ["dairy"] },
  coffee_milk: { description: "Coffee with milk", tags: ["caffeine", "dairy"] },
};

async function quickLogFood(kind) {
  const preset = QUICK_ADD[kind];
  if (!preset) return;
  const now = new Date().toISOString();
  await DB.put({
    type: "food",
    time: now,
    data: { description: preset.description, portion: "medium", tags: preset.tags },
    notes: null,
    createdAt: now,
  });
  toast(`Logged ${preset.description}`);
  await refreshAll();
}

$$("[data-quickadd]").forEach((b) =>
  b.addEventListener("click", () => quickLogFood(b.dataset.quickadd)),
);

// ------------ Dialog / form rendering ------------

const dialog = $("#entry-dialog");
const dynamicFields = $("#dynamic-fields");
const dialogTitle = $("#dialog-title");
const entryTimeInput = $("#entry-time");
const entryNotesInput = $("#entry-notes");
const deleteBtn = $("#delete-entry");

$$("[data-close]").forEach((b) =>
  b.addEventListener("click", () => dialog.close()),
);

function openEntry(type, existing = null) {
  state.editingType = type;
  state.editingId = existing ? existing.id : null;
  state.formValues = {};

  const cfg = TYPES[type];
  dialogTitle.textContent = (existing ? "Edit " : "New ") + cfg.label.toLowerCase();
  deleteBtn.hidden = !existing;

  // entry time: for sleep this is wake time, for the rest it's "when"
  const timeLabel = type === "sleep" ? "Woke up" : "When";
  $("#entry-time").previousElementSibling.textContent = timeLabel;
  entryTimeInput.value = toLocalInputValue(
    existing ? existing.time : new Date(),
  );
  entryNotesInput.value = existing ? existing.notes || "" : "";

  // Build dynamic fields
  dynamicFields.innerHTML = "";
  for (const f of cfg.fields) {
    const init =
      existing && existing.data[f.key] !== undefined
        ? existing.data[f.key]
        : f.default;
    if (init !== undefined) state.formValues[f.key] = init;
    dynamicFields.appendChild(buildField(f));
  }

  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function buildField(f) {
  const wrap = el("div", { class: "field" });
  wrap.appendChild(el("label", {}, f.label));

  if (f.type === "text") {
    const input = el("input", {
      type: "text",
      placeholder: f.placeholder || "",
      value: state.formValues[f.key] || "",
      required: !!f.required,
    });
    input.addEventListener("input", () => (state.formValues[f.key] = input.value));
    wrap.appendChild(input);
  } else if (f.type === "datetime") {
    const input = el("input", { type: "datetime-local" });
    input.value = state.formValues[f.key]
      ? toLocalInputValue(state.formValues[f.key])
      : toLocalInputValue(new Date(Date.now() - 8 * 3600 * 1000));
    state.formValues[f.key] = fromLocalInputValue(input.value);
    input.addEventListener("change", () => {
      state.formValues[f.key] = fromLocalInputValue(input.value);
    });
    wrap.appendChild(input);
  } else if (f.type === "number") {
    const input = el("input", {
      type: "number",
      min: f.min,
      max: f.max,
      value: state.formValues[f.key] ?? "",
    });
    input.addEventListener("input", () => {
      state.formValues[f.key] = input.value === "" ? null : Number(input.value);
    });
    wrap.appendChild(input);
  } else if (f.type === "seg") {
    const seg = el("div", { class: "seg" });
    const buttons = [];
    f.options.forEach(([value, label]) => {
      const b = el("button", { type: "button" }, label);
      b.addEventListener("click", () => {
        state.formValues[f.key] = f.cast ? f.cast(value) : value;
        buttons.forEach((x) => x.classList.toggle("active", x === b));
      });
      const isActive =
        state.formValues[f.key] === (f.cast ? f.cast(value) : value);
      if (isActive) b.classList.add("active");
      buttons.push(b);
      seg.appendChild(b);
    });
    wrap.appendChild(seg);
    if (f.labels) {
      const lbl = el("div", { class: "seg-label" },
        el("span", {}, f.labels[0]),
        el("span", {}, f.labels[1] || ""),
      );
      wrap.appendChild(lbl);
    }
    if (f.help) {
      wrap.appendChild(el("div", { class: "seg-label" }, f.help));
    }
  } else if (f.type === "checks") {
    const row = el("div", { class: "checkbox-row" });
    const current = new Set(state.formValues[f.key] || []);
    state.formValues[f.key] = Array.from(current);
    f.options.forEach((opt) => {
      const cb = el("input", { type: "checkbox", value: opt });
      if (current.has(opt)) cb.checked = true;
      cb.addEventListener("change", () => {
        if (cb.checked) current.add(opt);
        else current.delete(opt);
        state.formValues[f.key] = Array.from(current);
      });
      const lbl = el("label", { class: "check" }, cb, el("span", {}, cap(opt)));
      row.appendChild(lbl);
    });
    wrap.appendChild(row);
  }

  return wrap;
}

$("#entry-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const type = state.editingType;
  if (!type) return;

  const time = fromLocalInputValue(entryTimeInput.value) || new Date().toISOString();
  const notes = entryNotesInput.value.trim() || null;

  // Strip empties / nulls from data
  const data = {};
  for (const [k, v] of Object.entries(state.formValues)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    data[k] = v;
  }

  // Required-field check
  const cfg = TYPES[type];
  for (const f of cfg.fields) {
    if (f.required && (data[f.key] == null || data[f.key] === "")) {
      toast(`Please fill in “${f.label}”`);
      return;
    }
  }

  const entry = {
    type,
    time,
    data,
    notes,
    createdAt: state.editingId ? undefined : new Date().toISOString(),
  };
  if (state.editingId) entry.id = state.editingId;

  // Preserve createdAt for edits
  if (state.editingId) {
    const existing = await DB.get(state.editingId);
    if (existing) entry.createdAt = existing.createdAt;
  }

  await DB.put(entry);
  dialog.close();
  toast(state.editingId ? "Updated" : "Saved");
  await refreshAll();
});

deleteBtn.addEventListener("click", async () => {
  if (!state.editingId) return;
  if (!confirm("Delete this entry?")) return;
  await DB.remove(state.editingId);
  dialog.close();
  toast("Deleted");
  await refreshAll();
});

// ------------ Lists ------------

function renderEntryItem(e) {
  const cfg = TYPES[e.type];
  const meta = cfg.meta(e) || "";
  const li = el(
    "li",
    { class: "entry", "data-id": e.id },
    el("span", { class: "entry-icon" }, cfg.icon),
    el(
      "div",
      { class: "entry-body" },
      el(
        "div",
        { class: "entry-title" },
        el("span", {}, cfg.title(e) + (e.notes ? " ·" : "")),
        el("span", { class: "entry-time" }, formatTimeShort(e.time)),
      ),
      meta || e.notes
        ? el(
            "div",
            { class: "entry-meta" },
            [meta, e.notes].filter(Boolean).join(" — "),
          )
        : null,
    ),
  );
  li.addEventListener("click", () => openEntry(e.type, e));
  return li;
}

async function renderToday() {
  const list = $("#today-list");
  const all = (await DB.all()).filter((e) => isToday(e.time));
  all.sort((a, b) => new Date(b.time) - new Date(a.time));
  list.innerHTML = "";
  if (all.length === 0) {
    list.appendChild(el("li", { class: "empty" }, "No entries yet today. Tap a button above to log one."));
    return;
  }
  for (const e of all) list.appendChild(renderEntryItem(e));
}

async function renderHistory() {
  const list = $("#history-list");
  const filterEls = $$(".filters input[type=checkbox]");
  const active = new Set(
    filterEls.filter((c) => c.checked).map((c) => c.value),
  );
  const all = (await DB.all())
    .filter((e) => active.has(e.type))
    .sort((a, b) => new Date(b.time) - new Date(a.time));

  list.innerHTML = "";
  if (all.length === 0) {
    list.appendChild(el("li", { class: "empty" }, "Nothing matches your filters yet."));
    return;
  }

  let lastDay = null;
  for (const e of all) {
    const day = formatDayLabel(e.time);
    if (day !== lastDay) {
      list.appendChild(el("li", { class: "day-divider" }, day));
      lastDay = day;
    }
    list.appendChild(renderEntryItem(e));
  }
}

$$(".filters input[type=checkbox]").forEach((cb) =>
  cb.addEventListener("change", renderHistory),
);

async function renderEntryCount() {
  const all = await DB.all();
  $("#entry-count").textContent = all.length
    ? `${all.length} entr${all.length === 1 ? "y" : "ies"}`
    : "";
}

async function refreshAll() {
  await Promise.all([renderToday(), renderEntryCount()]);
  if (state.currentView === "history") await renderHistory();
  if (state.currentView === "export") await renderSummary();
}

// ------------ Export & summary ------------

function inRange(e, fromIso, toIso) {
  const t = new Date(e.time).getTime();
  if (fromIso && t < new Date(fromIso).getTime()) return false;
  if (toIso && t > new Date(toIso).getTime()) return false;
  return true;
}

function getExportRange() {
  const fromV = $("#export-from").value;
  const toV = $("#export-to").value;
  const from = fromV ? new Date(fromV + "T00:00:00").toISOString() : null;
  const to = toV ? new Date(toV + "T23:59:59.999").toISOString() : null;
  return { from, to };
}

async function getExportEntries() {
  const { from, to } = getExportRange();
  const all = await DB.all();
  return all
    .filter((e) => inRange(e, from, to))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function entriesToCSV(entries) {
  const cols = [
    "id",
    "type",
    "time_iso",
    "date",
    "time",
    "notes",
    // food
    "food_description",
    "food_portion",
    "food_tags",
    // bloating
    "bloating_severity",
    "bloating_pain",
    "bloating_location",
    // bm
    "bristol",
    "urgency",
    "bm_flags",
    // sleep
    "sleep_bedtime_iso",
    "sleep_wake_iso",
    "sleep_hours",
    "sleep_quality",
    "sleep_wakeups",
  ];
  const rows = [cols.join(",")];
  for (const e of entries) {
    const d = new Date(e.time);
    const date = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const time = d.toLocaleTimeString([], { hour12: false });
    const r = {
      id: e.id,
      type: e.type,
      time_iso: e.time,
      date,
      time,
      notes: e.notes || "",
    };
    if (e.type === "food") {
      r.food_description = e.data.description || "";
      r.food_portion = e.data.portion || "";
      r.food_tags = (e.data.tags || []).join("|");
    } else if (e.type === "bloating") {
      r.bloating_severity = e.data.severity ?? "";
      r.bloating_pain = e.data.pain ?? "";
      r.bloating_location = e.data.location || "";
    } else if (e.type === "bm") {
      r.bristol = e.data.bristol ?? "";
      r.urgency = e.data.urgency || "";
      r.bm_flags = (e.data.flags || []).join("|");
    } else if (e.type === "sleep") {
      r.sleep_bedtime_iso = e.data.bedtime || "";
      r.sleep_wake_iso = e.time;
      const h = sleepHoursFromEntry(e);
      r.sleep_hours = h != null ? h.toFixed(2) : "";
      r.sleep_quality = e.data.quality ?? "";
      r.sleep_wakeups = e.data.wakeups ?? "";
    }
    rows.push(cols.map((c) => csvEscape(r[c] ?? "")).join(","));
  }
  return rows.join("\n");
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function dateStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

$("#export-csv").addEventListener("click", async () => {
  const entries = await getExportEntries();
  if (entries.length === 0) return toast("No entries in range");
  downloadBlob(
    entriesToCSV(entries),
    `gut-tracker-${dateStamp()}.csv`,
    "text/csv;charset=utf-8",
  );
});

$("#export-json").addEventListener("click", async () => {
  const entries = await getExportEntries();
  if (entries.length === 0) return toast("No entries in range");
  downloadBlob(
    JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2),
    `gut-tracker-${dateStamp()}.json`,
    "application/json",
  );
});

$("#export-summary").addEventListener("click", async () => {
  const entries = await getExportEntries();
  if (entries.length === 0) return toast("No entries in range");
  downloadBlob(
    buildSummaryHTML(entries),
    `gut-tracker-summary-${dateStamp()}.html`,
    "text/html;charset=utf-8",
  );
});

$("#wipe").addEventListener("click", async () => {
  if (!confirm("Erase ALL entries? This cannot be undone.")) return;
  if (!confirm("Really delete everything?")) return;
  await DB.clearAll();
  toast("All data erased");
  await refreshAll();
});

async function renderSummary() {
  const entries = await getExportEntries();
  const summary = $("#summary");
  if (entries.length === 0) {
    summary.innerHTML = "";
    summary.appendChild(el("div", { class: "row" },
      el("span", {}, "No entries in range"), el("span", {}, "—"),
    ));
    return;
  }
  const counts = { food: 0, bloating: 0, bm: 0, sleep: 0 };
  let bloatingSum = 0, bloatingN = 0;
  let bristolSum = 0, bristolN = 0;
  let sleepSum = 0, sleepN = 0;
  let qualitySum = 0, qualityN = 0;
  for (const e of entries) {
    counts[e.type]++;
    if (e.type === "bloating" && typeof e.data.severity === "number") {
      bloatingSum += e.data.severity;
      bloatingN++;
    }
    if (e.type === "bm" && typeof e.data.bristol === "number") {
      bristolSum += e.data.bristol;
      bristolN++;
    }
    if (e.type === "sleep") {
      const h = sleepHoursFromEntry(e);
      if (h != null) {
        sleepSum += h;
        sleepN++;
      }
      if (typeof e.data.quality === "number") {
        qualitySum += e.data.quality;
        qualityN++;
      }
    }
  }
  const first = entries[0].time;
  const last = entries[entries.length - 1].time;
  const days = Math.max(
    1,
    Math.round((new Date(last) - new Date(first)) / 86_400_000) + 1,
  );

  const rows = [
    ["Date range", `${first.slice(0, 10)} → ${last.slice(0, 10)} (${days} day${days === 1 ? "" : "s"})`],
    ["Food entries", `${counts.food}`],
    ["Bloating entries", `${counts.bloating}${bloatingN ? ` · avg ${(bloatingSum / bloatingN).toFixed(1)}/10` : ""}`],
    ["Bowel movements", `${counts.bm}${bristolN ? ` · avg Bristol ${(bristolSum / bristolN).toFixed(1)}` : ""}`],
    ["Sleep entries", `${counts.sleep}${sleepN ? ` · avg ${(sleepSum / sleepN).toFixed(1)}h` : ""}${qualityN ? `, quality ${(qualitySum / qualityN).toFixed(1)}/5` : ""}`],
  ];
  summary.innerHTML = "";
  for (const [k, v] of rows) {
    summary.appendChild(
      el("div", { class: "row" }, el("span", {}, k), el("span", {}, v)),
    );
  }
}

$("#export-from").addEventListener("change", renderSummary);
$("#export-to").addEventListener("change", renderSummary);

function buildSummaryHTML(entries) {
  const byDay = new Map();
  for (const e of entries) {
    const day = e.time.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(e);
  }

  const rowFor = (e) => {
    const cfg = TYPES[e.type];
    const time = formatTimeShort(e.time);
    let detail = cfg.title(e);
    const meta = cfg.meta(e);
    if (meta) detail += ` — ${meta}`;
    if (e.notes) detail += ` (${e.notes})`;
    return `<tr><td>${time}</td><td>${cfg.icon} ${cfg.label}</td><td>${escapeHtml(detail)}</td></tr>`;
  };

  const days = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => {
      const sorted = list.sort((a, b) => new Date(a.time) - new Date(b.time));
      return `
        <h3>${day} — ${new Date(day).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</h3>
        <table><thead><tr><th>Time</th><th>Type</th><th>Detail</th></tr></thead>
        <tbody>${sorted.map(rowFor).join("")}</tbody></table>`;
    })
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Gut Tracker Summary</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; color: #1a2138; max-width: 800px; margin: 32px auto; padding: 0 24px; }
  h1 { margin-bottom: 4px; }
  h3 { margin-top: 28px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eef0f5; vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
  td:first-child { white-space: nowrap; color: #64748b; width: 70px; }
  td:nth-child(2) { white-space: nowrap; width: 130px; }
  .meta { color: #64748b; font-size: 13px; }
  @media print { body { margin: 0; padding: 12px 16px; } h3 { page-break-inside: avoid; } }
</style></head>
<body>
  <h1>Gut Tracker Summary</h1>
  <p class="meta">Exported ${new Date().toLocaleString()} · ${entries.length} entries</p>
  ${days}
  <p class="meta" style="margin-top:32px">To save as PDF: open this file and use your browser's Print → Save as PDF.</p>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

// ------------ Toast ------------

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

// ------------ Init ------------

(function init() {
  // Default export range: last 14 days → today
  const today = new Date();
  const past = new Date();
  past.setDate(today.getDate() - 13);
  const ymd = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  $("#export-to").value = ymd(today);
  $("#export-from").value = ymd(past);

  refreshAll();
})();
