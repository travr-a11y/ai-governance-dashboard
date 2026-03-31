import React, { useState, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

// ─── Constants ───────────────────────────────────────────────────────────────

const USERS_MAP = {
  "trowley@frankadvisory.com.au": { name: "Travis Rowley", entity: "Frank Advisory", isBenchmark: true },
  "alex@frankadvisory.com.au":    { name: "Alex", entity: "Frank Advisory" },
  "andrea@frankadvisory.com.au":  { name: "Andrea", entity: "Frank Advisory" },
  "rsharma@frankadvisory.com.au": { name: "Reginald", entity: "Frank Advisory" },
  "tbrcic@franklaw.com.au":       { name: "Tamara", entity: "Frank Law" },
  "bagar@franklaw.com.au":        { name: "Bahar", entity: "Frank Law" },
  "bwoodward@franklaw.com.au":    { name: "Ben", entity: "Frank Law" },
  "rlyons@franklaw.com.au":       { name: "Rhys", entity: "Frank Law" },
};

const SPEND_LIMITS = {
  "alex@frankadvisory.com.au":    null,
  "andrea@frankadvisory.com.au":  null,
  "bagar@franklaw.com.au":        20,
  "bwoodward@franklaw.com.au":    null,
  "rlyons@franklaw.com.au":       50,
  "rsharma@frankadvisory.com.au": 190,
  "tbrcic@franklaw.com.au":       10,
  "trowley@frankadvisory.com.au": null,
};

const MODEL_CLASS = {
  "claude_opus_4_6":            "Opus",
  "claude_opus_4_5_20251101":   "Opus",
  "claude_sonnet_4_6":          "Sonnet",
  "claude_sonnet_4_5_20250929": "Sonnet",
  "claude_haiku_4_5_20251001":  "Haiku",
};

const COLOURS = {
  opus:    "#e74c3c",
  sonnet:  "#2d7d5f",
  haiku:   "#3a86c8",
  advisory:"#1a3a5c",
  law:     "#2d7d5f",
  tier1:   "#1a3a5c",
  tier2:   "#2d7d5f",
  tier3:   "#f59e0b",
  tier4:   "#9ca3af",
};

const MODEL_RECOMMENDATIONS = [
  { task: "Daily Cowork sessions, drafting, emails", model: "Sonnet", reason: "Fast, sufficient quality, 1/5 Opus cost" },
  { task: "Sheet Agent data processing",             model: "Sonnet or Haiku", reason: "Repetitive; Opus overkill" },
  { task: "Research queries",                        model: "Sonnet", reason: "Most research doesn't need Opus reasoning depth" },
  { task: "Complex M&A analysis, LBO logic",         model: "Opus", reason: "High-stakes, multi-step reasoning" },
  { task: "Contract review (complex)",               model: "Opus", reason: "Nuance and accuracy critical" },
  { task: "Claude Code (general)",                   model: "Sonnet", reason: "Code generation is Sonnet-sufficient" },
  { task: "Claude Code (complex architecture)",      model: "Opus", reason: "Deliberate choice only" },
  { task: "Chat — quick questions",                  model: "Haiku or Sonnet", reason: "Reserve Opus for deep work" },
];

const DEFAULT_INITIATIVES = [
  { id: "1", name: "Get all 8 seats active",           owner: "Trav",        targetMetric: "active_users_count",    targetValue: 8,          lowerIsBetter: false, statusOverride: null },
  { id: "2", name: "Frank Law onboarding",             owner: "Trav",        targetMetric: "frank_law_adoption_pct",targetValue: 100,        lowerIsBetter: false, statusOverride: null },
  { id: "3", name: "Sonnet as default model",          owner: "AI Committee",targetMetric: "org_opus_pct",          targetValue: 50,         lowerIsBetter: true,  statusOverride: null },
  { id: "4", name: "Average fluency score",            owner: "AI Committee",targetMetric: "avg_fluency_score",     targetValue: 60,         lowerIsBetter: false, statusOverride: null },
  { id: "5", name: "Team token milestone (org AI depth)",owner: "Trav",      targetMetric: "total_tokens",          targetValue: 1000000000, lowerIsBetter: false, statusOverride: null },
];

// ─── Sample Data ──────────────────────────────────────────────────────────────

const SAMPLE_DATA = [
  { user_email:"trowley@frankadvisory.com.au", product:"Cowork",       model:"claude_opus_4_6",          total_requests:45,  total_prompt_tokens:2800000,  total_completion_tokens:420000,  total_net_spend_usd:38.50 },
  { user_email:"trowley@frankadvisory.com.au", product:"Cowork",       model:"claude_sonnet_4_6",        total_requests:62,  total_prompt_tokens:1900000,  total_completion_tokens:280000,  total_net_spend_usd:8.20 },
  { user_email:"trowley@frankadvisory.com.au", product:"Claude Code",  model:"claude_sonnet_4_6",        total_requests:120, total_prompt_tokens:3200000,  total_completion_tokens:540000,  total_net_spend_usd:14.60 },
  { user_email:"trowley@frankadvisory.com.au", product:"Research",     model:"claude_sonnet_4_6",        total_requests:18,  total_prompt_tokens:680000,   total_completion_tokens:95000,   total_net_spend_usd:3.10 },
  { user_email:"alex@frankadvisory.com.au",    product:"Cowork",       model:"claude_opus_4_6",          total_requests:310, total_prompt_tokens:180000000,total_completion_tokens:8500000, total_net_spend_usd:280.00 },
  { user_email:"alex@frankadvisory.com.au",    product:"Chat",         model:"claude_opus_4_6",          total_requests:28,  total_prompt_tokens:4200000,  total_completion_tokens:620000,  total_net_spend_usd:18.90 },
  { user_email:"alex@frankadvisory.com.au",    product:"Research",     model:"claude_sonnet_4_6",        total_requests:12,  total_prompt_tokens:890000,   total_completion_tokens:120000,  total_net_spend_usd:3.20 },
  { user_email:"rsharma@frankadvisory.com.au", product:"Cowork",       model:"claude_opus_4_6",          total_requests:8,   total_prompt_tokens:9800000,  total_completion_tokens:1200000, total_net_spend_usd:82.00 },
  { user_email:"rsharma@frankadvisory.com.au", product:"Sheet Agent",  model:"claude_opus_4_6",          total_requests:3,   total_prompt_tokens:4500000,  total_completion_tokens:480000,  total_net_spend_usd:36.00 },
  { user_email:"andrea@frankadvisory.com.au",  product:"Cowork",       model:"claude_sonnet_4_6",        total_requests:22,  total_prompt_tokens:540000,   total_completion_tokens:88000,   total_net_spend_usd:2.40 },
  { user_email:"andrea@frankadvisory.com.au",  product:"Chat",         model:"claude_haiku_4_5_20251001",total_requests:35,  total_prompt_tokens:220000,   total_completion_tokens:42000,   total_net_spend_usd:0.30 },
  { user_email:"tbrcic@franklaw.com.au",       product:"Chat",         model:"claude_opus_4_6",          total_requests:5,   total_prompt_tokens:180000,   total_completion_tokens:28000,   total_net_spend_usd:2.10 },
  { user_email:"tbrcic@franklaw.com.au",       product:"Cowork",       model:"claude_sonnet_4_6",        total_requests:8,   total_prompt_tokens:210000,   total_completion_tokens:34000,   total_net_spend_usd:0.95 },
];

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { data: [], errors: ["File appears empty"] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const required = ["user_email","model","product","total_requests","total_prompt_tokens","total_completion_tokens","total_net_spend_usd"];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length > 0) return { data: [], errors: [`Missing columns: ${missing.join(", ")}`] };
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    const numFields = ["total_requests","total_prompt_tokens","total_completion_tokens","total_net_spend_usd","total_gross_spend_usd"];
    numFields.forEach(f => { row[f] = parseFloat(row[f]) || 0; });
    data.push(row);
  }
  return { data, errors: [] };
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function aggregateData(rows, audRate) {
  const byUser = {};
  rows.forEach(row => {
    const emailRaw = row.user_email || "";
    const email = emailRaw.toLowerCase();
    // Try to find matching key case-insensitively
    const mappedKey = Object.keys(USERS_MAP).find(k => k.toLowerCase() === email) || emailRaw;
    if (!byUser[mappedKey]) {
      byUser[mappedKey] = {
        email: mappedKey,
        modelBreakdown: {},
        productBreakdown: {},
        totalSpendUSD: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalRequests: 0,
      };
    }
    const u = byUser[mappedKey];
    u.totalSpendUSD        += row.total_net_spend_usd || 0;
    u.totalPromptTokens    += row.total_prompt_tokens || 0;
    u.totalCompletionTokens+= row.total_completion_tokens || 0;
    u.totalRequests        += row.total_requests || 0;

    const cls = MODEL_CLASS[row.model] || "Other";
    if (!u.modelBreakdown[cls]) u.modelBreakdown[cls] = { spend: 0, tokens: 0, requests: 0 };
    u.modelBreakdown[cls].spend    += row.total_net_spend_usd || 0;
    u.modelBreakdown[cls].tokens   += (row.total_prompt_tokens || 0) + (row.total_completion_tokens || 0);
    u.modelBreakdown[cls].requests += row.total_requests || 0;

    const prod = row.product || "Unknown";
    if (!u.productBreakdown[prod]) u.productBreakdown[prod] = { spend: 0, tokens: 0, requests: 0 };
    u.productBreakdown[prod].spend    += row.total_net_spend_usd || 0;
    u.productBreakdown[prod].tokens   += (row.total_prompt_tokens || 0) + (row.total_completion_tokens || 0);
    u.productBreakdown[prod].requests += row.total_requests || 0;
  });

  // Add zero-spend users from USERS_MAP
  Object.keys(USERS_MAP).forEach(k => {
    const lower = k.toLowerCase();
    const exists = Object.keys(byUser).find(e => e.toLowerCase() === lower);
    if (!exists) {
      byUser[k] = { email: k, modelBreakdown: {}, productBreakdown: {}, totalSpendUSD: 0, totalPromptTokens: 0, totalCompletionTokens: 0, totalRequests: 0 };
    }
  });

  const allUsers = Object.values(byUser);
  const orgAvgTokens = allUsers.reduce((s, u) => s + u.totalPromptTokens + u.totalCompletionTokens, 0) / Math.max(allUsers.filter(u => u.totalRequests > 0).length, 1);

  return allUsers.map(u => {
    const mapKey = Object.keys(USERS_MAP).find(k => k.toLowerCase() === u.email.toLowerCase());
    const info = mapKey ? USERS_MAP[mapKey] : null;
    const totalTokens = u.totalPromptTokens + u.totalCompletionTokens;
    const opusSpend = u.modelBreakdown["Opus"]?.spend || 0;
    const opusPct = u.totalSpendUSD > 0 ? (opusSpend / u.totalSpendUSD) * 100 : 0;
    const surfaceCount = Object.keys(u.productBreakdown).length;

    const tokenVolumeScore = orgAvgTokens > 0 ? Math.min(100, (totalTokens / orgAvgTokens) * 50) : 0;
    const surfaceDiversityScore = Math.min(100, surfaceCount * 20);
    const recencyScore = u.totalRequests > 0 ? 100 : 0;
    const fluencyScore = tokenVolumeScore * 0.5 + surfaceDiversityScore * 0.3 + recencyScore * 0.2;

    let fluencyTier;
    if (fluencyScore >= 70)      fluencyTier = 1;
    else if (fluencyScore >= 40) fluencyTier = 2;
    else if (fluencyScore >= 10) fluencyTier = 3;
    else                         fluencyTier = 4;

    const limitKey = Object.keys(SPEND_LIMITS).find(k => k.toLowerCase() === u.email.toLowerCase());
    const spendLimit = limitKey !== undefined ? SPEND_LIMITS[limitKey] : undefined;
    const spendAUD = u.totalSpendUSD * audRate;
    const spendUtilisation = spendLimit ? (spendAUD / spendLimit) * 100 : null;

    // Entity fallback
    let entity = info?.entity;
    if (!entity) {
      if (u.email.toLowerCase().includes("frankadvisory")) entity = "Frank Advisory";
      else if (u.email.toLowerCase().includes("franklaw")) entity = "Frank Law";
      else entity = "Unknown Entity";
    }

    return {
      email: u.email,
      name: info?.name || u.email,
      entity,
      isBenchmark: info?.isBenchmark || false,
      totalSpendUSD: u.totalSpendUSD,
      totalSpendAUD: spendAUD,
      totalPromptTokens: u.totalPromptTokens,
      totalCompletionTokens: u.totalCompletionTokens,
      totalTokens,
      totalRequests: u.totalRequests,
      avgTokensPerRequest: u.totalRequests > 0 ? totalTokens / u.totalRequests : 0,
      modelBreakdown: u.modelBreakdown,
      productBreakdown: u.productBreakdown,
      opusPct,
      surfaceCount,
      fluencyScore,
      fluencyTier,
      spendLimit: spendLimit ?? null,
      spendUtilisation,
    };
  }).sort((a, b) => b.totalTokens - a.totalTokens);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = n => n == null || isNaN(n) ? "0" : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmtDec = (n, d=1) => n == null || isNaN(n) ? "0" : n.toFixed(d);
const fmtUSD = n => `$${fmtDec(n || 0, 2)}`;
const fmtAUD = n => `A$${fmtDec(n || 0, 2)}`;
const fmtTokens = n => {
  if (!n) return "0";
  if (n >= 1e9) return `${fmtDec(n/1e9, 1)}B`;
  if (n >= 1e6) return `${fmtDec(n/1e6, 1)}M`;
  if (n >= 1e3) return `${fmtDec(n/1e3, 1)}K`;
  return `${n}`;
};

const tierLabel  = t => ["","Super User","Active","Getting Started","Not Started"][t] || "";
const tierColour = t => [COLOURS.tier4, COLOURS.tier1, COLOURS.tier2, COLOURS.tier3, COLOURS.tier4][t] || COLOURS.tier4;

function opusFlag(pct) {
  if (pct > 80) return "red";
  if (pct > 50) return "amber";
  return "green";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ tier }) {
  const colors = { 1:"#1a3a5c", 2:"#2d7d5f", 3:"#f59e0b", 4:"#9ca3af" };
  return (
    <span style={{ background: colors[tier], color: "#fff", padding:"2px 8px", borderRadius:9999, fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>
      {tier === 1 ? "★ " : ""}{tierLabel(tier)}
    </span>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{ borderBottom:"2px solid #1a3a5c", marginBottom:16, paddingBottom:6 }}>
      <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"#1a3a5c", textTransform:"uppercase", letterSpacing:1 }}>{title}</h2>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:20, ...style }}>
      {children}
    </div>
  );
}

function StatBox({ label, value, sub, colour }) {
  return (
    <div style={{ textAlign:"center", padding:"12px 16px", background:"#f8fafc", borderRadius:8, border:"1px solid #e5e7eb" }}>
      <div style={{ fontSize:28, fontWeight:800, color: colour || "#1a3a5c" }}>{value}</div>
      <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// ─── Module 1: Data Ingestion ─────────────────────────────────────────────────

function Module1({ onData, onSettings, settings, fileName, dataInfo, onClear }) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError]       = useState(null);

  const handleFile = useCallback(file => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const { data, errors } = parseCSV(e.target.result);
      if (errors.length) { setError(errors[0]); return; }
      setError(null);
      // Parse date range from filename
      const match = file.name.match(/(\d{4}-\d{2}-\d{2})[-_to]+(\d{4}-\d{2}-\d{2})/);
      const dateRange = match ? `${match[1]} to ${match[2]}` : "Unknown period";
      onData(data, file.name, dateRange);
    };
    reader.readAsText(file);
  }, [onData]);

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  return (
    <Card>
      <SectionHeader title="Module 1 — Data Ingestion" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        {/* Primary upload */}
        <div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:6, color:"#374151" }}>Claude.ai Team Spend CSV</div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("csvInput").click()}
            style={{ border:`2px dashed ${dragOver?"#1a3a5c":"#d1d5db"}`, borderRadius:8, padding:"24px 16px", textAlign:"center", cursor:"pointer", background: dragOver?"#eff6ff":"#f9fafb", transition:"all .15s" }}
          >
            <div style={{ fontSize:13, color:"#6b7280" }}>
              {fileName ? `✓ ${fileName}` : "Drag & drop or click to upload"}
            </div>
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>CSV format required</div>
          </div>
          <input id="csvInput" type="file" accept=".csv" style={{ display:"none" }} onChange={e => handleFile(e.target.files[0])} />
        </div>
        {/* Settings */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div>
            <label style={{ fontSize:12, color:"#374151", fontWeight:600 }}>AUD/USD Rate</label>
            <input type="number" step="0.01" value={settings.audRate} onChange={e => onSettings({ audRate: parseFloat(e.target.value) || 1.55 })}
              style={{ width:"100%", border:"1px solid #d1d5db", borderRadius:6, padding:"4px 8px", fontSize:13, marginTop:2 }} />
          </div>
          <div>
            <label style={{ fontSize:12, color:"#374151", fontWeight:600 }}>Opus:Sonnet Cost Ratio</label>
            <input type="number" step="0.5" value={settings.opusSonnetRatio} onChange={e => onSettings({ opusSonnetRatio: parseFloat(e.target.value) || 5 })}
              style={{ width:"100%", border:"1px solid #d1d5db", borderRadius:6, padding:"4px 8px", fontSize:13, marginTop:2 }} />
          </div>
          <div>
            <label style={{ fontSize:12, color:"#374151", fontWeight:600 }}>Total Seats</label>
            <input type="number" value={settings.totalSeats} onChange={e => onSettings({ totalSeats: parseInt(e.target.value) || 8 })}
              style={{ width:"100%", border:"1px solid #d1d5db", borderRadius:6, padding:"4px 8px", fontSize:13, marginTop:2 }} />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:6, padding:"10px 14px", fontSize:13, color:"#dc2626", marginBottom:12 }}>
          <strong>CSV Error:</strong> {error}<br/>
          <span style={{ fontSize:12 }}>Expected columns: user_email, account_uuid, product, model, total_requests, total_prompt_tokens, total_completion_tokens, total_net_spend_usd</span>
        </div>
      )}

      {dataInfo && (
        <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:6, padding:"8px 14px", fontSize:13, color:"#166534", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>✓ {dataInfo}</span>
          <button onClick={onClear} style={{ background:"none", border:"1px solid #166534", color:"#166534", borderRadius:4, padding:"2px 10px", fontSize:12, cursor:"pointer" }}>Clear</button>
        </div>
      )}
    </Card>
  );
}

// ─── Module 2: North Star — AI Adoption ──────────────────────────────────────

function Module2({ users, settings, metrics }) {
  const active = users.filter(u => u.totalRequests > 0);
  const advisory = users.filter(u => u.entity === "Frank Advisory");
  const law = users.filter(u => u.entity === "Frank Law");
  const advisoryActive = advisory.filter(u => u.totalRequests > 0).length;
  const lawActive = law.filter(u => u.totalRequests > 0).length;
  const adoptionPct = (active.length / settings.totalSeats) * 100;

  return (
    <Card>
      <SectionHeader title="Module 2 — AI Adoption (North Star)" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        <StatBox label="Org Adoption" value={`${fmtDec(adoptionPct, 0)}%`} sub={`${active.length} / ${settings.totalSeats} seats`} colour="#1a3a5c" />
        <StatBox label="Frank Advisory" value={`${advisoryActive} / ${advisory.length}`} sub="seats active" colour={COLOURS.advisory} />
        <StatBox label="Frank Law" value={`${lawActive} / ${law.length}`} sub="seats active" colour={COLOURS.law} />
        <StatBox label="Avg Fluency Score" value={fmtDec(metrics.avg_fluency_score, 0)} sub="/ 100" colour={COLOURS.tier2} />
      </div>

      {/* Model Efficiency secondary metric */}
      <div style={{ background:"#f8fafc", borderRadius:6, padding:"10px 14px", marginBottom:16, fontSize:13 }}>
        <span style={{ fontWeight:600, color:"#374151" }}>Model Efficiency Ratio: </span>
        <span style={{ color: metrics.org_opus_pct > 80 ? "#dc2626" : metrics.org_opus_pct > 50 ? "#f59e0b" : "#166534" }}>
          {fmtDec(100 - metrics.org_opus_pct, 0)}% non-Opus spend
        </span>
        <span style={{ color:"#9ca3af", marginLeft:8 }}>({fmtDec(metrics.org_opus_pct, 0)}% Opus)</span>
      </div>

      {/* Tier breakdown */}
      <div style={{ fontSize:13, fontWeight:600, color:"#374151", marginBottom:8 }}>Digital Fluency Tiers</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
        {users.map(u => (
          <div key={u.email} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"8px 10px", background:"#f9fafb", borderRadius:8, border:"1px solid #e5e7eb", minWidth:90 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background: tierColour(u.fluencyTier), display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:12 }}>
              {u.fluencyTier === 1 ? "★" : `T${u.fluencyTier}`}
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:"#374151", textAlign:"center" }}>{u.name}</div>
            <div style={{ fontSize:10, color:"#6b7280" }}>{fmtDec(u.fluencyScore, 0)} pts</div>
            <Badge tier={u.fluencyTier} />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Module 3: Model Governance ───────────────────────────────────────────────

function Module3({ users, metrics }) {
  const [showRecs, setShowRecs] = useState(false);

  const pieData = [
    { name:"Opus",   value: metrics.org_opus_pct },
    { name:"Sonnet", value: metrics.org_sonnet_pct },
    { name:"Haiku",  value: metrics.org_haiku_pct },
  ].filter(d => d.value > 0);

  const flagged = users.filter(u => u.opusPct > 80 && u.totalRequests > 0);

  return (
    <Card>
      <SectionHeader title="Module 3 — Model Governance" />
      <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:24 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:"#6b7280", marginBottom:8, textAlign:"center" }}>Org-wide Model Split</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({name,value}) => `${name} ${fmtDec(value,0)}%`} labelLine={false} fontSize={11}>
                {pieData.map(entry => (
                  <Cell key={entry.name} fill={COLOURS[entry.name.toLowerCase()] || "#ccc"} />
                ))}
              </Pie>
              <Tooltip formatter={v => `${fmtDec(v,1)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:"#6b7280", marginBottom:8 }}>Per-user Model Breakdown</div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #e5e7eb" }}>
                {["User","Entity","Opus%","Sonnet%","Haiku%","Status"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"4px 8px", color:"#6b7280", fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.filter(u => u.totalRequests > 0).map(u => {
                const flag = opusFlag(u.opusPct);
                const flagColour = { red:"#dc2626", amber:"#f59e0b", green:"#166534" }[flag];
                return (
                  <tr key={u.email} style={{ borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"4px 8px", fontWeight: u.isBenchmark ? 700 : 400 }}>
                      {u.name} {u.isBenchmark && <span style={{ fontSize:10, color:"#6b7280" }}>(Benchmark)</span>}
                    </td>
                    <td style={{ padding:"4px 8px", color:"#6b7280" }}>{u.entity}</td>
                    <td style={{ padding:"4px 8px", color: COLOURS.opus, fontWeight:600 }}>{fmtDec(u.opusPct,0)}%</td>
                    <td style={{ padding:"4px 8px", color: COLOURS.sonnet }}>{fmtDec(u.modelBreakdown?.Sonnet?.spend ? (u.modelBreakdown.Sonnet.spend/u.totalSpendUSD*100) : 0, 0)}%</td>
                    <td style={{ padding:"4px 8px", color: COLOURS.haiku }}>{fmtDec(u.modelBreakdown?.Haiku?.spend ? (u.modelBreakdown.Haiku.spend/u.totalSpendUSD*100) : 0, 0)}%</td>
                    <td style={{ padding:"4px 8px" }}>
                      <span style={{ color: flagColour, fontWeight:600, fontSize:11 }}>
                        {flag === "red" ? "⚑ High" : flag === "amber" ? "◆ Moderate" : "✓ OK"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {flagged.length > 0 && (
        <div style={{ background:"#fef2f2", borderRadius:6, padding:"10px 14px", marginTop:12, fontSize:12 }}>
          <strong style={{ color:"#dc2626" }}>⚑ Model Governance Flags ({flagged.length} users above 80% Opus):</strong>
          {flagged.map(u => (
            <div key={u.email} style={{ marginTop:4, color:"#374151" }}>• {u.name}: {fmtDec(u.opusPct,0)}% Opus — recommend switching Cowork/Chat sessions to Sonnet</div>
          ))}
        </div>
      )}

      <div style={{ marginTop:12 }}>
        <button onClick={() => setShowRecs(!showRecs)} style={{ background:"none", border:"1px solid #d1d5db", borderRadius:6, padding:"6px 12px", fontSize:12, cursor:"pointer", color:"#374151" }}>
          {showRecs ? "▲ Hide" : "▼ Show"} Model Recommendation Library
        </button>
        {showRecs && (
          <div style={{ marginTop:10, overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:"#f3f4f6" }}>
                  <th style={{ textAlign:"left", padding:"6px 10px" }}>Task Type</th>
                  <th style={{ textAlign:"left", padding:"6px 10px" }}>Model</th>
                  <th style={{ textAlign:"left", padding:"6px 10px" }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_RECOMMENDATIONS.map((r,i) => (
                  <tr key={i} style={{ borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"5px 10px" }}>{r.task}</td>
                    <td style={{ padding:"5px 10px", fontWeight:600, color: r.model.includes("Opus") ? COLOURS.opus : r.model.includes("Haiku") ? COLOURS.haiku : COLOURS.sonnet }}>{r.model}</td>
                    <td style={{ padding:"5px 10px", color:"#6b7280" }}>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Module 4: User Spend & Token Breakdown ───────────────────────────────────

function Module4({ users, onUpdateLimit }) {
  const [sortKey, setSortKey]     = useState("totalTokens");
  const [sortDir, setSortDir]     = useState("desc");
  const [expanded, setExpanded]   = useState({});
  const [editLimit, setEditLimit] = useState({});

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sorted = [...users].sort((a,b) => {
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const cols = [
    { key:"name",              label:"Name" },
    { key:"entity",            label:"Entity" },
    { key:"fluencyTier",       label:"Tier" },
    { key:"totalSpendAUD",     label:"Spend (AUD)" },
    { key:"totalSpendUSD",     label:"Spend (USD)" },
    { key:"totalTokens",       label:"Tokens" },
    { key:"totalRequests",     label:"Requests" },
    { key:"avgTokensPerRequest",label:"Avg Tok/Req" },
    { key:"opusPct",           label:"Opus%" },
  ];

  return (
    <Card>
      <SectionHeader title="Module 4 — User Spend & Token Breakdown" />
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:"#f3f4f6", borderBottom:"2px solid #e5e7eb" }}>
              {cols.map(c => (
                <th key={c.key} onClick={() => toggleSort(c.key)}
                  style={{ textAlign:"left", padding:"6px 10px", cursor:"pointer", userSelect:"none", whiteSpace:"nowrap", color: sortKey===c.key ? "#1a3a5c" : "#6b7280", fontWeight:600 }}>
                  {c.label} {sortKey===c.key ? (sortDir==="asc"?"↑":"↓") : ""}
                </th>
              ))}
              <th style={{ padding:"6px 10px", color:"#6b7280", fontWeight:600 }}>Limit (AUD)</th>
              <th style={{ padding:"6px 10px", color:"#6b7280", fontWeight:600 }}>Util%</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(u => {
              const isExpanded = expanded[u.email];
              const utilColour = !u.spendUtilisation ? "#9ca3af" : u.spendUtilisation > 90 ? "#dc2626" : u.spendUtilisation > 75 ? "#f59e0b" : "#166534";
              const limitVal = editLimit[u.email] !== undefined ? editLimit[u.email] : (u.spendLimit ?? "");
              return (
                <React.Fragment key={u.email}>
                  <tr style={{ borderBottom:"1px solid #f3f4f6", background: u.totalRequests === 0 ? "#fafafa" : "#fff", opacity: u.totalRequests === 0 ? 0.6 : 1 }}>
                    <td style={{ padding:"6px 10px", fontWeight:600 }}>
                      {u.name}
                      {u.isBenchmark && <span style={{ fontSize:10, color:"#6b7280", marginLeft:4 }}>(Benchmark)</span>}
                      {u.fluencyTier === 1 && <span title="Candidate internal AI trainer" style={{ marginLeft:4, fontSize:10, background:"#1a3a5c", color:"#fff", padding:"1px 5px", borderRadius:9999 }}>★ Super User</span>}
                      {u.totalRequests === 0 && <span style={{ fontSize:10, color:"#9ca3af", marginLeft:4 }}>Not active this period</span>}
                    </td>
                    <td style={{ padding:"6px 10px", color:"#6b7280" }}>{u.entity}</td>
                    <td style={{ padding:"6px 10px" }}><Badge tier={u.fluencyTier} /></td>
                    <td style={{ padding:"6px 10px" }}>{fmtAUD(u.totalSpendAUD)}</td>
                    <td style={{ padding:"6px 10px", color:"#6b7280" }}>{fmtUSD(u.totalSpendUSD)}</td>
                    <td style={{ padding:"6px 10px" }}>{fmtTokens(u.totalTokens)}</td>
                    <td style={{ padding:"6px 10px" }}>{fmt(u.totalRequests)}</td>
                    <td style={{ padding:"6px 10px", fontWeight:600 }}>{fmtTokens(u.avgTokensPerRequest)}</td>
                    <td style={{ padding:"6px 10px", color: COLOURS.opus }}>{fmtDec(u.opusPct,0)}%</td>
                    <td style={{ padding:"6px 10px" }}>
                      <input type="text" placeholder="Unlimited" value={limitVal}
                        onChange={e => setEditLimit(prev => ({ ...prev, [u.email]: e.target.value }))}
                        onBlur={e => { const v = parseFloat(e.target.value); onUpdateLimit(u.email, isNaN(v) ? null : v); }}
                        style={{ width:70, border:"1px solid #d1d5db", borderRadius:4, padding:"2px 6px", fontSize:11 }} />
                    </td>
                    <td style={{ padding:"6px 10px", color: utilColour, fontWeight:600 }}>
                      {u.spendUtilisation ? `${fmtDec(u.spendUtilisation,0)}%` : "—"}
                    </td>
                    <td style={{ padding:"6px 10px" }}>
                      {u.totalRequests > 0 && (
                        <button onClick={() => setExpanded(prev => ({ ...prev, [u.email]: !prev[u.email] }))}
                          style={{ background:"none", border:"1px solid #d1d5db", borderRadius:4, padding:"2px 6px", fontSize:11, cursor:"pointer" }}>
                          {isExpanded ? "▲" : "▼"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ borderBottom:"1px solid #f3f4f6" }}>
                      <td colSpan={13} style={{ padding:"12px 20px", background:"#f8fafc" }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                          <div>
                            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:6 }}>BY PRODUCT</div>
                            {Object.entries(u.productBreakdown).map(([p,v]) => (
                              <div key={p} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                                <span>{p}</span><span style={{ fontWeight:600 }}>{fmtAUD(v.spend * 1.55)}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:6 }}>BY MODEL</div>
                            {Object.entries(u.modelBreakdown).map(([m,v]) => (
                              <div key={m} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                                <span style={{ color: COLOURS[m.toLowerCase()] || "#374151" }}>{m}</span>
                                <span style={{ fontWeight:600 }}>{fmtDec((v.spend/u.totalSpendUSD)*100,0)}%</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:6 }}>CONTEXT DEPTH</div>
                            <div style={{ fontSize:20, fontWeight:800, color:"#1a3a5c" }}>{fmtTokens(u.avgTokensPerRequest)}</div>
                            <div style={{ fontSize:11, color:"#6b7280" }}>avg tokens / request</div>
                            <div style={{ fontSize:11, color:"#9ca3af", marginTop:6 }}>Prompt: {fmtTokens(u.totalPromptTokens)}</div>
                            <div style={{ fontSize:11, color:"#9ca3af" }}>Completion: {fmtTokens(u.totalCompletionTokens)}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Module 5: Product / Surface Analysis ─────────────────────────────────────

function Module5({ users }) {
  const products = ["Cowork","Chat","Sheet Agent","Research","Claude Code"];
  const surfaceData = products.map(p => {
    let totalSpend = 0, opusSpend = 0;
    users.forEach(u => {
      const pd = u.productBreakdown[p];
      if (pd) {
        totalSpend += pd.spend;
        // Opus spend on this surface — approximate from user's opus ratio
        const opusRatio = u.totalSpendUSD > 0 ? (u.modelBreakdown?.Opus?.spend || 0) / u.totalSpendUSD : 0;
        opusSpend += pd.spend * opusRatio;
      }
    });
    const opusPct = totalSpend > 0 ? (opusSpend/totalSpend)*100 : 0;
    return { name:p, spend: totalSpend, opusPct };
  }).filter(d => d.spend > 0);

  const highLeverage = surfaceData.filter(d => d.opusPct > 80 && d.spend > 20);

  return (
    <Card>
      <SectionHeader title="Module 5 — Product / Surface Analysis" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:24 }}>
        <div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={surfaceData} layout="vertical" margin={{ left:20 }}>
              <XAxis type="number" tickFormatter={v => fmtUSD(v)} fontSize={11} />
              <YAxis type="category" dataKey="name" width={90} fontSize={11} />
              <Tooltip formatter={(v,n) => [fmtUSD(v), "Spend USD"]} />
              <Bar dataKey="spend" radius={[0,4,4,0]}>
                {surfaceData.map(entry => (
                  <Cell key={entry.name} fill={entry.opusPct > 80 ? COLOURS.opus : entry.opusPct > 50 ? "#f59e0b" : COLOURS.sonnet} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", gap:12, marginTop:4, fontSize:11, color:"#6b7280" }}>
            <span style={{ color:COLOURS.opus }}>■ Opus-dominant (&gt;80%)</span>
            <span style={{ color:"#f59e0b" }}>■ Mixed (50-80%)</span>
            <span style={{ color:COLOURS.sonnet }}>■ Efficient (&lt;50%)</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:"#6b7280", marginBottom:8 }}>Opus% by Surface</div>
          {surfaceData.map(d => (
            <div key={d.name} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:2 }}>
                <span>{d.name}</span>
                <span style={{ color: d.opusPct > 80 ? COLOURS.opus : "#374151", fontWeight:600 }}>{fmtDec(d.opusPct,0)}% Opus</span>
              </div>
              <div style={{ height:6, background:"#e5e7eb", borderRadius:3 }}>
                <div style={{ height:6, background: d.opusPct > 80 ? COLOURS.opus : COLOURS.sonnet, borderRadius:3, width:`${Math.min(100,d.opusPct)}%` }} />
              </div>
            </div>
          ))}
          {highLeverage.length > 0 && (
            <div style={{ background:"#fef2f2", borderRadius:6, padding:"8px 10px", marginTop:8, fontSize:11 }}>
              <strong style={{ color:"#dc2626" }}>⚑ High savings leverage:</strong>
              {highLeverage.map(d => <div key={d.name} style={{ marginTop:2 }}>• {d.name} ({fmtDec(d.opusPct,0)}% Opus, {fmtUSD(d.spend)} spend)</div>)}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Module 6: Savings Calculator ─────────────────────────────────────────────

function Module6({ users, settings, dateRange }) {
  const [migrationPct, setMigrationPct] = useState(50);

  const opusSpendUSD = users.reduce((s,u) => s + (u.modelBreakdown?.Opus?.spend || 0), 0);
  const totalSpendUSD = users.reduce((s,u) => s + u.totalSpendUSD, 0);
  const ratio = settings.opusSonnetRatio;

  const saving = opusSpendUSD * (migrationPct/100) * (1 - 1/ratio);
  const savingAUD = saving * settings.audRate;
  const projectedSpendUSD = totalSpendUSD - saving;

  // Estimate period months from dateRange
  let months = 1;
  if (dateRange && dateRange !== "Unknown period") {
    const parts = dateRange.match(/(\d{4}-\d{2}-\d{2})/g);
    if (parts && parts.length === 2) {
      const d1 = new Date(parts[0]), d2 = new Date(parts[1]);
      months = Math.max(0.1, (d2 - d1) / (1000*60*60*24*30));
    }
  }
  const annualSaving = (saving / months) * 12;
  const annualTotal  = (totalSpendUSD / months) * 12;

  return (
    <Card>
      <SectionHeader title="Module 6 — Savings Opportunity Calculator" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <div>
          <div style={{ fontSize:13, color:"#374151", marginBottom:8 }}>
            % of Opus usage migrated to Sonnet: <strong>{migrationPct}%</strong>
          </div>
          <input type="range" min={0} max={100} value={migrationPct} onChange={e => setMigrationPct(parseInt(e.target.value))}
            style={{ width:"100%", marginBottom:10 }} />
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {[["Conservative",30],["Target",60],["Aggressive",90]].map(([label,val]) => (
              <button key={label} onClick={() => setMigrationPct(val)}
                style={{ flex:1, padding:"6px 8px", border:"1px solid #d1d5db", borderRadius:6, fontSize:12, cursor:"pointer", background: migrationPct===val ? "#1a3a5c" : "#f9fafb", color: migrationPct===val ? "#fff" : "#374151" }}>
                {label} ({val}%)
              </button>
            ))}
          </div>
          <div style={{ fontSize:11, color:"#9ca3af" }}>
            Formula: saving = opus_spend × {migrationPct/100} × (1 − 1/{ratio}) = {fmtUSD(saving)}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <StatBox label="Current Opus Spend" value={fmtUSD(opusSpendUSD)} sub={fmtAUD(opusSpendUSD * settings.audRate)} colour={COLOURS.opus} />
          <StatBox label="Projected Saving" value={fmtUSD(saving)} sub={fmtAUD(savingAUD)} colour="#166534" />
          <StatBox label="Projected Total Spend" value={fmtUSD(projectedSpendUSD)} sub={fmtAUD(projectedSpendUSD * settings.audRate)} colour="#374151" />
          <StatBox label="Annualised Saving" value={fmtUSD(annualSaving)} sub={`Run rate: ${fmtUSD(annualTotal)}/yr`} colour="#166534" />
        </div>
      </div>
    </Card>
  );
}

// ─── Module 8: AI Committee Initiatives ───────────────────────────────────────

function Module8({ initiatives, setInitiatives, metrics }) {
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});

  const metricKeys = ["active_users_count","org_adoption_pct","frank_law_adoption_pct","org_opus_pct","total_tokens","avg_fluency_score"];

  const getStatus = (init, currentVal) => {
    if (init.statusOverride) return init.statusOverride;
    if (currentVal == null) return "amber";
    const progress = init.lowerIsBetter
      ? currentVal <= init.targetValue ? 100 : (init.targetValue / currentVal) * 100
      : (currentVal / init.targetValue) * 100;
    if (progress >= 90) return "green";
    if (progress >= 50) return "amber";
    return "red";
  };

  const enriched = initiatives.map(init => {
    const currentValue = metrics[init.targetMetric] ?? null;
    const status = getStatus(init, currentValue);
    const progress = currentValue != null && init.targetValue > 0
      ? init.lowerIsBetter
        ? Math.min(100, (init.targetValue / Math.max(currentValue, 0.001)) * 100)
        : Math.min(100, (currentValue / init.targetValue) * 100)
      : 0;
    return { ...init, currentValue, status, progress };
  });

  const statusDot = { green:"#22c55e", amber:"#f59e0b", red:"#ef4444" };

  const startEdit = init => {
    setEditId(init.id);
    setForm({ name: init.name, owner: init.owner, targetMetric: init.targetMetric, targetValue: init.targetValue, lowerIsBetter: init.lowerIsBetter ?? false });
  };

  const saveEdit = () => {
    setInitiatives(prev => prev.map(i => i.id === editId ? { ...i, ...form, targetValue: parseFloat(form.targetValue) || 0 } : i));
    setEditId(null);
  };

  const addNew = () => {
    const id = Date.now().toString();
    setInitiatives(prev => [...prev, { id, name:"New Initiative", owner:"", targetMetric:"active_users_count", targetValue:0, lowerIsBetter:false, statusOverride:null }]);
    setEditId(id);
    setForm({ name:"New Initiative", owner:"", targetMetric:"active_users_count", targetValue:0, lowerIsBetter:false });
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(initiatives, null, 2)], { type:"application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "initiatives.json"; a.click();
  };

  return (
    <Card>
      <SectionHeader title="Module 8 — AI Committee Initiative Tracker" />
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:12 }}>
        {enriched.map(init => (
          <div key={init.id} style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:"12px 14px", background:"#fafafa" }}>
            {editId === init.id ? (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr auto", gap:8, alignItems:"end" }}>
                <div>
                  <label style={{ fontSize:11, color:"#6b7280" }}>Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))}
                    style={{ width:"100%", border:"1px solid #d1d5db", borderRadius:4, padding:"4px 6px", fontSize:12 }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#6b7280" }}>Owner</label>
                  <input value={form.owner} onChange={e => setForm(f => ({...f, owner:e.target.value}))}
                    style={{ width:"100%", border:"1px solid #d1d5db", borderRadius:4, padding:"4px 6px", fontSize:12 }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#6b7280" }}>Metric</label>
                  <select value={form.targetMetric} onChange={e => setForm(f => ({...f, targetMetric:e.target.value}))}
                    style={{ width:"100%", border:"1px solid #d1d5db", borderRadius:4, padding:"4px 6px", fontSize:12 }}>
                    {metricKeys.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#6b7280" }}>Target</label>
                  <input type="number" value={form.targetValue} onChange={e => setForm(f => ({...f, targetValue:e.target.value}))}
                    style={{ width:"100%", border:"1px solid #d1d5db", borderRadius:4, padding:"4px 6px", fontSize:12 }} />
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  <button onClick={saveEdit} style={{ background:"#1a3a5c", color:"#fff", border:"none", borderRadius:4, padding:"4px 10px", fontSize:12, cursor:"pointer" }}>Save</button>
                  <button onClick={() => setEditId(null)} style={{ background:"none", border:"1px solid #d1d5db", borderRadius:4, padding:"4px 8px", fontSize:12, cursor:"pointer" }}>✕</button>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background: statusDot[init.status], flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{init.name}</span>
                    <span style={{ fontSize:11, color:"#6b7280" }}>{init.owner}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>
                    {init.targetMetric}: target {fmtTokens(init.targetValue)} | current {init.currentValue != null ? fmtTokens(init.currentValue) : "N/A"} | {fmtDec(init.progress,0)}%
                  </div>
                  <div style={{ height:4, background:"#e5e7eb", borderRadius:2, marginTop:4 }}>
                    <div style={{ height:4, borderRadius:2, width:`${init.progress}%`, background: statusDot[init.status], transition:"width .3s" }} />
                  </div>
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  <button onClick={() => startEdit(init)} style={{ background:"none", border:"1px solid #d1d5db", borderRadius:4, padding:"2px 8px", fontSize:11, cursor:"pointer" }}>Edit</button>
                  <button onClick={() => setInitiatives(prev => prev.filter(i => i.id !== init.id))}
                    style={{ background:"none", border:"1px solid #fca5a5", color:"#dc2626", borderRadius:4, padding:"2px 6px", fontSize:11, cursor:"pointer" }}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={addNew} style={{ background:"#1a3a5c", color:"#fff", border:"none", borderRadius:6, padding:"8px 14px", fontSize:13, cursor:"pointer" }}>+ Add Initiative</button>
        <button onClick={exportJSON} style={{ background:"none", border:"1px solid #d1d5db", borderRadius:6, padding:"8px 14px", fontSize:13, cursor:"pointer" }}>Export JSON</button>
      </div>
    </Card>
  );
}

// ─── Module 7: Report Generator ───────────────────────────────────────────────

function Module7({ users, metrics, initiatives, settings, dateRange }) {
  const [report, setReport] = useState("");
  const [copied, setCopied]  = useState(false);

  const generate = () => {
    const today = new Date().toISOString().split("T")[0];
    const active = users.filter(u => u.totalRequests > 0);
    const advisory = users.filter(u => u.entity === "Frank Advisory");
    const law = users.filter(u => u.entity === "Frank Law");
    const totalSpendAUD = users.reduce((s,u) => s + u.totalSpendAUD, 0);

    let months = 1;
    if (dateRange && dateRange !== "Unknown period") {
      const parts = dateRange.match(/(\d{4}-\d{2}-\d{2})/g);
      if (parts && parts.length === 2) {
        const d1 = new Date(parts[0]), d2 = new Date(parts[1]);
        months = Math.max(0.1, (d2 - d1) / (1000*60*60*24*30));
      }
    }
    const annualised = (totalSpendAUD / months) * 12;
    const opusSpendUSD = users.reduce((s,u) => s + (u.modelBreakdown?.Opus?.spend || 0), 0);
    const savingUSD = opusSpendUSD * 0.6 * (1 - 1/settings.opusSonnetRatio);
    const savingAUD = savingUSD * settings.audRate;

    const statusEmoji = { green:"✅", amber:"⚠️", red:"🔴" };

    const initiativeBlock = initiatives.map(init => {
      const cv = metrics[init.targetMetric];
      const progress = cv != null && init.targetValue > 0
        ? Math.min(100, init.lowerIsBetter ? (init.targetValue / Math.max(cv,0.001))*100 : (cv/init.targetValue)*100)
        : 0;
      const status = progress >= 90 ? "green" : progress >= 50 ? "amber" : "red";
      return `${statusEmoji[status]} ${init.name} — ${init.owner}\n  Target: ${init.targetMetric} = ${fmtTokens(init.targetValue)} | Current: ${cv != null ? fmtTokens(cv) : "N/A"} | ${fmtDec(progress,0)}%`;
    }).join("\n\n");

    const userBlock = active.sort((a,b) => b.totalTokens - a.totalTokens).map(u => {
      const sonnetPct = u.totalSpendUSD > 0 ? ((u.modelBreakdown?.Sonnet?.spend||0)/u.totalSpendUSD)*100 : 0;
      const prods = Object.keys(u.productBreakdown).join(", ");
      let flags = "";
      if (u.opusPct > 80) flags += "\n  ⚑ Recommend model review — defaulting to Opus for routine tasks";
      if (u.spendUtilisation > 75) flags += `\n  ⚑ Approaching spend limit (${fmtDec(u.spendUtilisation,0)}%)`;
      return `[Tier ${u.fluencyTier}] ${u.name} (${u.entity})\n  Spend: ${fmtAUD(u.totalSpendAUD)} | Tokens: ${fmtTokens(u.totalTokens)} | Requests: ${fmt(u.totalRequests)} | Avg context: ${fmtTokens(u.avgTokensPerRequest)}\n  Model mix: ${fmtDec(u.opusPct,0)}% Opus / ${fmtDec(sonnetPct,0)}% Sonnet | Surfaces: ${prods}${flags}`;
    }).join("\n\n");

    const inactiveBlock = users.filter(u => u.totalRequests === 0).map(u => `— ${u.name} (${u.entity}): No activity this period`).join("\n");

    const superUsers = users.filter(u => u.fluencyTier === 1);
    const superBlock = superUsers.map(u => `• ${u.name}: ${fmtTokens(u.totalTokens)} tokens across ${u.surfaceCount} surface(s)`).join("\n") || "No Tier 1 super users this period.";

    const flaggedModel = users.filter(u => u.opusPct > 80 && u.totalRequests > 0);
    const modelFlags = flaggedModel.map(u => `• ${u.name}: ${fmtDec(u.opusPct,0)}% Opus — top surface: ${Object.entries(u.productBreakdown).sort((a,b)=>b[1].spend-a[1].spend)[0]?.[0]||"N/A"}`).join("\n") || "No users above 80% Opus threshold.";

    // Recommended focus
    const recs = [];
    const worstInit = [...initiatives].sort((a,b) => {
      const pa = metrics[a.targetMetric] != null ? (metrics[a.targetMetric]/a.targetValue)*100 : 0;
      const pb = metrics[b.targetMetric] != null ? (metrics[b.targetMetric]/b.targetValue)*100 : 0;
      return pa - pb;
    })[0];
    if (worstInit) recs.push(`Progress "${worstInit.name}" (${fmtDec((metrics[worstInit.targetMetric]||0)/worstInit.targetValue*100,0)}% to target) — owned by ${worstInit.owner}`);
    if (metrics.frank_law_adoption_pct < 50) recs.push("Frank Law onboarding — only " + fmtDec(metrics.frank_law_adoption_pct,0) + "% of Frank Law seats active this period");
    if (metrics.org_opus_pct > 80) recs.push("Model governance — org is at " + fmtDec(metrics.org_opus_pct,0) + "% Opus; set Sonnet as default in Cowork/Chat");

    const txt = `FRANK GROUP — AI GOVERNANCE REPORT
Period: ${dateRange || "Unknown period"}
Prepared: ${today}
Distribution: James Frank, AI Committee
─────────────────────────────────────

EXECUTIVE SUMMARY

Adoption: ${active.length}/${settings.totalSeats} seats active (${fmtDec(metrics.org_adoption_pct,0)}%)
— Frank Advisory: ${advisory.filter(u=>u.totalRequests>0).length}/${advisory.length} | Frank Law: ${law.filter(u=>u.totalRequests>0).length}/${law.length}
Total spend: ${fmtAUD(totalSpendAUD)} (${fmtDec(months,1)} months)
Annualised run rate: ~${fmtAUD(annualised)} per year
Model efficiency: ${fmtDec(metrics.org_opus_pct,0)}% Opus / ${fmtDec(metrics.org_sonnet_pct,0)}% Sonnet / ${fmtDec(metrics.org_haiku_pct,0)}% Haiku
Savings opportunity: Switch 60% Opus → Sonnet = save ~${fmtAUD(savingAUD)}/period

─────────────────────────────────────
AI COMMITTEE INITIATIVE STATUS

${initiativeBlock}

─────────────────────────────────────
USER BREAKDOWN (ranked by tokens)

${userBlock}

${inactiveBlock}

─────────────────────────────────────
SUPER USERS — INTERNAL AI TRAINERS

These team members are candidates to lead internal AI upskilling:
${superBlock}

─────────────────────────────────────
MODEL GOVERNANCE FLAGS

${modelFlags}
Recommended action: Set Sonnet as default in Cowork and Sheet Agent settings.
Reference: Model Selection Guide in the governance dashboard.

─────────────────────────────────────
RECOMMENDED FOCUS — NEXT PERIOD

${recs.map((r,i) => `${i+1}. ${r}`).join("\n")}

─────────────────────────────────────
Generated by Frank Group AI Governance Dashboard`;

    setReport(txt);
  };

  const copy = () => {
    navigator.clipboard.writeText(report).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const download = () => {
    const blob = new Blob([report], { type:"text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `frank-group-ai-report-${new Date().toISOString().split("T")[0]}.txt`; a.click();
  };

  return (
    <Card>
      <SectionHeader title="Module 7 — Report Generator" />
      <div style={{ display:"flex", gap:10, marginBottom:16 }}>
        <button onClick={generate} style={{ background:"#1a3a5c", color:"#fff", border:"none", borderRadius:6, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
          Generate Report
        </button>
        {report && (
          <>
            <button onClick={copy} style={{ background: copied ? "#166534" : "#fff", color: copied ? "#fff" : "#374151", border:"1px solid #d1d5db", borderRadius:6, padding:"10px 16px", fontSize:13, cursor:"pointer" }}>
              {copied ? "✓ Copied!" : "Copy to Clipboard"}
            </button>
            <button onClick={download} style={{ background:"#fff", color:"#374151", border:"1px solid #d1d5db", borderRadius:6, padding:"10px 16px", fontSize:13, cursor:"pointer" }}>
              Download .txt
            </button>
          </>
        )}
      </div>
      {report && (
        <textarea readOnly value={report}
          style={{ width:"100%", height:400, fontFamily:"monospace", fontSize:12, border:"1px solid #e5e7eb", borderRadius:6, padding:12, resize:"vertical", background:"#f8fafc", boxSizing:"border-box" }} />
      )}
    </Card>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [rawRows,    setRawRows]    = useState(null);
  const [fileName,   setFileName]   = useState(null);
  const [dateRange,  setDateRange]  = useState(null);
  const [dataInfo,   setDataInfo]   = useState(null);
  const [settings,   setSettings]   = useState({ audRate: 1.55, opusSonnetRatio: 5, totalSeats: 8 });
  const [initiatives,setInitiatives]= useState(DEFAULT_INITIATIVES);
  const [spendLimitOverrides, setSpendLimitOverrides] = useState({});

  const rows = rawRows || SAMPLE_DATA;

  const users = useMemo(() => {
    const agg = aggregateData(rows, settings.audRate);
    return agg.map(u => {
      if (spendLimitOverrides[u.email] !== undefined) {
        const limit = spendLimitOverrides[u.email];
        return { ...u, spendLimit: limit, spendUtilisation: limit ? (u.totalSpendAUD / limit) * 100 : null };
      }
      return u;
    });
  }, [rows, settings.audRate, spendLimitOverrides]);

  const metrics = useMemo(() => {
    const active = users.filter(u => u.totalRequests > 0);
    const advisory = users.filter(u => u.entity === "Frank Advisory" && u.totalRequests > 0);
    const law = users.filter(u => u.entity === "Frank Law" && u.totalRequests > 0);
    const totalLaw = users.filter(u => u.entity === "Frank Law");
    const totalSpendUSD = users.reduce((s,u) => s + u.totalSpendUSD, 0);
    const opusSpendUSD  = users.reduce((s,u) => s + (u.modelBreakdown?.Opus?.spend  || 0), 0);
    const sonnetSpendUSD= users.reduce((s,u) => s + (u.modelBreakdown?.Sonnet?.spend|| 0), 0);
    const haikuSpendUSD = users.reduce((s,u) => s + (u.modelBreakdown?.Haiku?.spend || 0), 0);
    const totalTokens   = users.reduce((s,u) => s + u.totalTokens, 0);
    const avgFluency    = active.length > 0 ? active.reduce((s,u) => s + u.fluencyScore, 0) / active.length : 0;
    return {
      active_users_count:       active.length,
      org_adoption_pct:         (active.length / settings.totalSeats) * 100,
      frank_law_adoption_pct:   totalLaw.length > 0 ? (law.length / totalLaw.length) * 100 : 0,
      org_opus_pct:             totalSpendUSD > 0 ? (opusSpendUSD / totalSpendUSD) * 100 : 0,
      org_sonnet_pct:           totalSpendUSD > 0 ? (sonnetSpendUSD / totalSpendUSD) * 100 : 0,
      org_haiku_pct:            totalSpendUSD > 0 ? (haikuSpendUSD / totalSpendUSD) * 100 : 0,
      total_tokens:             totalTokens,
      avg_fluency_score:        avgFluency,
    };
  }, [users, settings.totalSeats]);

  const handleData = useCallback((data, name, range) => {
    setRawRows(data);
    setFileName(name);
    setDateRange(range);
    const emails = [...new Set(data.map(r => r.user_email))];
    const total = data.reduce((s,r) => s + (r.total_net_spend_usd || 0), 0);
    setDataInfo(`Data loaded: ${range} · ${data.length} rows · ${emails.length} users · ${fmtAUD(total * settings.audRate)} total`);
  }, [settings.audRate]);

  const handleClear = () => { setRawRows(null); setFileName(null); setDateRange(null); setDataInfo(null); };

  const updateSettings = patch => setSettings(s => ({ ...s, ...patch }));

  const updateLimit = (email, val) => setSpendLimitOverrides(prev => ({ ...prev, [email]: val }));

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background:"#f1f5f9", minHeight:"100vh", padding:24 }}>
      {/* Header */}
      <div style={{ background:"#1a3a5c", color:"#fff", borderRadius:10, padding:"20px 28px", marginBottom:24, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, letterSpacing:0.5 }}>Frank Group AI Governance Dashboard</div>
          <div style={{ fontSize:13, color:"#93c5fd", marginTop:4 }}>Frank Advisory · Frank Law · Phase 1</div>
        </div>
        <div style={{ textAlign:"right" }}>
          {!rawRows && <div style={{ fontSize:11, background:"#2563eb", color:"#fff", padding:"4px 10px", borderRadius:9999 }}>Demo mode — upload CSV to load real data</div>}
          {rawRows && <div style={{ fontSize:11, background:"#166534", color:"#fff", padding:"4px 10px", borderRadius:9999 }}>Live: {dateRange}</div>}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <Module1 onData={handleData} onSettings={updateSettings} settings={settings} fileName={fileName} dataInfo={dataInfo} onClear={handleClear} />
        <Module2 users={users} settings={settings} metrics={metrics} />
        <Module3 users={users} metrics={metrics} />
        <Module4 users={users} onUpdateLimit={updateLimit} />
        <Module5 users={users} />
        <Module6 users={users} settings={settings} dateRange={dateRange} />
        <Module8 initiatives={initiatives} setInitiatives={setInitiatives} metrics={metrics} />
        <Module7 users={users} metrics={metrics} initiatives={initiatives} settings={settings} dateRange={dateRange} />
      </div>

      <div style={{ textAlign:"center", color:"#9ca3af", fontSize:11, marginTop:24, paddingBottom:12 }}>
        Frank Group AI Governance Dashboard · Phase 1 · Client-side only · No data leaves your browser
      </div>
    </div>
  );
}
