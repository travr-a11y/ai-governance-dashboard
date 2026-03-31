# TASK-02 — Data Ingestion Tab + PIN Lock

**File to edit:** `index.html` (then sync `src/dashboard.jsx`)
**Estimated lines touched:** ~80 lines (nav bar, PIN gate component, App render restructure)
**Prerequisite:** TASK-01 complete (or can be done independently)

---

## Context

The dashboard currently shows Module 1 (Data Ingestion) as the first section on page load.
When sharing the dashboard URL with the Frank Group team, we do not want them to accidentally
re-upload or clear the data. The fix is:

- Add a two-tab nav: **Dashboard** (default) | **Admin**
- The Admin tab contains Module 1 (Data Ingestion) and any future admin-only modules
- Navigating to the Admin tab shows a PIN entry screen
- Correct PIN unlocks the tab for the session (React state — resets on page reload)
- Wrong PIN shows an inline error; no lockout logic needed for this internal tool

---

## Step 1 — Add PIN constant

Near the top of the `<script>` block (after `COACHING_KEYWORDS`, ~line 110), add:

```js
const ADMIN_PIN = "frank2026";   // change here to rotate; keep out of public repo if sensitive
```

> Note: since `index.html` is served as a static file, anyone who views source can read the PIN.
> For a truly private admin area, the repo must be private on GitHub and the PIN rotated
> periodically. This level of protection is sufficient to prevent accidental data changes by
> non-technical team members.

---

## Step 2 — Add `PinGate` component

Insert this component before `Module1` (~line 546):

```jsx
function PinGate({ onUnlock }) {
  const [pin, setPin]   = React.useState("");
  const [error, setError] = React.useState(false);

  const attempt = () => {
    if (pin === ADMIN_PIN) {
      onUnlock();
    } else {
      setError(true);
      setPin("");
    }
  };

  return React.createElement("div", {
    style: {
      maxWidth: 360, margin: "80px auto", padding: 32,
      background: "#fff", borderRadius: 12,
      border: `1px solid ${COLOURS.advisory}`,
      boxShadow: "0 4px 24px rgba(30,22,69,0.10)",
      textAlign: "center",
    },
  },
    React.createElement("div", {
      style: { fontSize: 18, fontWeight: 700, color: COLOURS.advisory, marginBottom: 8 },
    }, "Admin area"),
    React.createElement("div", {
      style: { fontSize: 13, color: COLOURS.captionText, marginBottom: 20 },
    }, "Enter the admin PIN to manage data uploads."),
    React.createElement("input", {
      type: "password", autoComplete: "off", placeholder: "PIN",
      value: pin,
      onChange: e => { setPin(e.target.value); setError(false); },
      onKeyDown: e => e.key === "Enter" && attempt(),
      style: {
        width: "100%", padding: "10px 14px", fontSize: 18,
        border: `1px solid ${error ? "#e74c3c" : "#d1d5db"}`,
        borderRadius: 6, marginBottom: 8, outline: "none",
        letterSpacing: "0.3em", textAlign: "center", boxSizing: "border-box",
      },
    }),
    error && React.createElement("div", {
      style: { fontSize: 12, color: "#e74c3c", marginBottom: 10 },
    }, "Incorrect PIN — try again."),
    React.createElement("button", {
      onClick: attempt,
      style: {
        background: COLOURS.advisory, color: "#fff", border: "none",
        borderRadius: 6, padding: "10px 28px", fontSize: 14,
        fontWeight: 600, cursor: "pointer", width: "100%",
      },
    }, "Unlock")
  );
}
```

---

## Step 3 — Add tab state to `App`

Inside the `App` function, add two new state variables near the top of the function body:

```js
const [activeTab,   setActiveTab]   = React.useState("dashboard");
const [adminUnlocked, setAdminUnlocked] = React.useState(false);
```

---

## Step 4 — Add `TabBar` component

Insert this small component before `App`:

```jsx
function TabBar({ activeTab, onSelect }) {
  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "admin",     label: "Admin" },
  ];
  return React.createElement("div", {
    style: {
      display: "flex", gap: 0, borderBottom: `2px solid ${COLOURS.advisory}`,
      marginBottom: 0, background: "#fff",
    },
  },
    tabs.map(t =>
      React.createElement("button", {
        key: t.id,
        onClick: () => onSelect(t.id),
        style: {
          padding: "10px 28px", fontSize: 14, fontWeight: 600,
          background: activeTab === t.id ? COLOURS.advisory : "transparent",
          color: activeTab === t.id ? "#fff" : COLOURS.advisory,
          border: "none", borderBottom: "none", cursor: "pointer",
          borderRadius: activeTab === t.id ? "6px 6px 0 0" : 0,
          transition: "background 0.15s",
        },
      }, t.label)
    )
  );
}
```

---

## Step 5 — Restructure `App` render

Find the main `return` of `App` (currently renders all modules in a vertical stack).
Wrap it in a tab-aware structure:

**Before (simplified):**
```jsx
return (
  <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
    <header>...</header>
    <Module1 ... />
    <Module2 ... />
    ...
  </div>
);
```

**After:**
```jsx
return (
  <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
    <header>...</header>
    <TabBar activeTab={activeTab} onSelect={tab => {
      setActiveTab(tab);
      if (tab !== "admin") { /* no-op */ }
    }} />

    {/* ADMIN TAB */}
    {activeTab === "admin" && (
      adminUnlocked
        ? <Module1 {...module1Props} />
        : <PinGate onUnlock={() => setAdminUnlocked(true)} />
    )}

    {/* DASHBOARD TAB */}
    {activeTab === "dashboard" && (
      <>
        {!rows.length && (
          <div style={{
            background: "#f5f3ff", border: `1px solid ${COLOURS.advisory}`,
            borderRadius: 8, padding: "16px 20px", margin: "20px 0",
            fontSize: 14, color: COLOURS.advisory, textAlign: "center",
          }}>
            No data loaded yet. Go to the <strong>Admin</strong> tab to upload CSV files.
          </div>
        )}
        <Module2 ... />
        <Module3 ... />
        <Module4 ... />
        <Module5 ... />
        <Module7 ... />
        <Module8 ... />
        <Module9 ... />
        <Module6 ... />   {/* Savings at bottom */}
      </>
    )}
  </div>
);
```

> Note: `module1Props` is a destructured object of all the props currently passed to `<Module1>`.
> Extract them to a const above the return for cleanliness.

---

## Step 6 — Empty-state guard on Dashboard tab

When no CSV has been loaded (`rows.length === 0`), the Dashboard tab shows a friendly prompt
(shown in the snippet above) instead of empty charts. This replaces the current behaviour where
Module 1 is the first thing a viewer sees.

---

## Acceptance criteria

- [ ] Page loads showing the Dashboard tab (Module 2–9 visible)
- [ ] Admin tab click → PIN entry screen appears
- [ ] Wrong PIN → inline error, field clears
- [ ] Correct PIN (`frank2026`) → Module 1 appears
- [ ] Admin tab stays unlocked for the session; navigating away and back does not re-lock
- [ ] Page refresh resets the lock (adminUnlocked resets to false)
- [ ] Dashboard tab with no data shows the "Go to Admin tab" prompt

---

## Files changed
- `index.html` — ADMIN_PIN constant, PinGate component, TabBar component, App state + render
- `src/dashboard.jsx` — sync same sections
