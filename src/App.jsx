import { useState, useRef, useEffect } from "react";
import "./App.css";

// ─── Constants ───────────────────────────────────────────────────────────────

const LOADER_STEPS = [
  "Locating your zones",
  "Reading nearby business signals",
  "Comparing service verticals",
  "Calculating launch score",
  "Preparing your recommendation",
];

const LOADER_DELAYS = [0, 3000, 7000, 12000, 18000];

const DATA_SOURCE_LABELS = {
  ai: "Powered by AI analysis",
  external: "Powered by external AI analysis",
  signal_estimation: "Estimated from market signals — AI analysis unavailable",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function potentialLabel(score) {
  if (score >= 80) return "High Potential";
  if (score >= 60) return "Good Test Market";
  if (score >= 40) return "Needs Validation";
  return "Not Recommended Initially";
}

function badgeClass(potential = "") {
  const v = potential.toLowerCase();
  if (v.includes("high")) return "badge badge-high";
  if (v.includes("good")) return "badge badge-medium";
  return "badge badge-low";
}

function rankVerticals(food, grocery, ride, courier) {
  const scores = {
    "Food Delivery": food,
    "Grocery Delivery": grocery,
    "Ride Booking/Sharing": ride,
    "Courier Delivery": courier,
  };
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => k);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateText(value, label, min = 2, max = 120) {
  value = value.trim();
  if (value.length < min || value.length > max)
    return `Please enter a valid ${label}.`;
  if (/https?:\/\//i.test(value) || /\bwww\b/i.test(value))
    return `Please enter a real ${label}, not a URL.`;
  if (!/^[\p{L}\p{M}0-9\s'\-.,\/()&]+$/u.test(value))
    return `Please enter a valid ${label} using location names only.`;
  if (!/[\p{L}\p{M}]/u.test(value))
    return `Please enter a valid ${label} using a real location name.`;
  const compact = value.replace(/[^\p{L}\p{M}0-9]/gu, "").toLowerCase();
  const junk = ["test", "testing", "sample", "demo", "dummy", "asdf", "qwerty"];
  if (junk.includes(compact))
    return `Please enter a real ${label}, not placeholder text.`;
  return null;
}

// ─── Geoapify helpers (called from backend proxy in production) ───────────────

async function geocodeZone(country, city, zone, apiKey) {
  const query = `${zone}, ${city}, ${country}`;
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("apiKey", apiKey);
  const res = await fetch(url);
  const data = await res.json();
  const r = data?.results?.[0];
  if (!r?.lat || !r?.lon) throw new Error(`Could not geocode "${zone}"`);
  return { lat: parseFloat(r.lat), lon: parseFloat(r.lon), country_code: r.country_code || "" };
}

async function fetchPlacesCount(lat, lon, categories, apiKey) {
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", categories);
  url.searchParams.set("filter", `circle:${lon},${lat},3000`);
  url.searchParams.set("limit", "20");
  url.searchParams.set("apiKey", apiKey);
  const res = await fetch(url);
  const data = await res.json();
  return (data?.features || []).length;
}

async function collectMarketSignals(country, city, zones, geoapifyKey) {
  const results = [];
  for (const zone of zones) {
    try {
      const coords = await geocodeZone(country, city, zone, geoapifyKey);
      const { lat, lon } = coords;
      const [food, grocery, ride, courier, competitor] = await Promise.all([
        fetchPlacesCount(lat, lon, "catering.restaurant,catering.fast_food,catering.food_court,catering.cafe", geoapifyKey),
        fetchPlacesCount(lat, lon, "commercial.supermarket,commercial.convenience,commercial.food_and_drink", geoapifyKey),
        fetchPlacesCount(lat, lon, "public_transport,parking", geoapifyKey),
        fetchPlacesCount(lat, lon, "commercial,office,commercial.shopping_mall", geoapifyKey),
        fetchPlacesCount(lat, lon, "catering.restaurant,commercial.supermarket,commercial.shopping_mall", geoapifyKey),
      ]);
      results.push({ name: zone, lat, lon, food_delivery_count: food, grocery_delivery_count: grocery, ride_booking_count: ride, courier_delivery_count: courier, competitor_count: competitor });
    } catch {
      results.push({ name: zone, food_delivery_count: 8, grocery_delivery_count: 4, ride_booking_count: 4, courier_delivery_count: 5, competitor_count: 4 });
    }
  }
  return results;
}

// ─── Signal-based analysis (no AI) ───────────────────────────────────────────

function signalBasedAnalysis(country, city, zones, signals) {
  const signalMap = {};
  signals.forEach((s) => { signalMap[s.name.toLowerCase()] = s; });

  const zoneResults = zones.map((zone) => {
    const s = signalMap[zone.toLowerCase()] || {};
    const food = s.food_delivery_count ?? 8;
    const grocery = s.grocery_delivery_count ?? 4;
    const ride = s.ride_booking_count ?? 4;
    const courier = s.courier_delivery_count ?? 5;
    const competitor = s.competitor_count ?? 4;

    const supplyScore = Math.min(35, food * 1.15 + grocery * 1.25 + courier * 0.85);
    const mobilityScore = Math.min(16, 5 + ride * 0.9);
    const demandScore = Math.min(24, 10 + competitor * 1.0);
    const feasibility = 16;
    const verticalScore = Math.min(14, 4 + (food > 8 ? 3 : 0) + (grocery > 4 ? 3 : 0) + (ride > 4 ? 2 : 0) + (courier > 6 ? 2 : 0));
    const score = Math.max(40, Math.min(92, Math.round(28 + supplyScore + mobilityScore + demandScore + feasibility + verticalScore - Math.min(8, competitor * 0.15))));

    return {
      name: zone,
      score,
      potential: potentialLabel(score),
      best_verticals: rankVerticals(food, grocery, ride, courier),
      vendor_target: Math.max(10, Math.min(80, Math.round((food + grocery + courier) * 1.25))),
      rider_target: Math.max(5, Math.min(35, Math.round((Math.max(10, Math.min(80, Math.round((food + grocery + courier) * 1.25)))) * 0.28 + ride * 0.45))),
      risk_level: score >= 82 ? "Low" : score >= 68 ? "Medium" : "High",
      recommendation: `${zone} has ${potentialLabel(score).toLowerCase()}. Prioritize the strongest service fits among food delivery, grocery delivery, ride booking/sharing, and courier delivery, then validate demand through a focused 30-day pilot before expanding coverage.`,
    };
  });

  zoneResults.sort((a, b) => b.score - a.score);
  const avgScore = Math.round(zoneResults.reduce((s, z) => s + z.score, 0) / zoneResults.length);
  const topZone = zoneResults[0].name;

  return {
    city, country,
    average_score: avgScore,
    market_label: potentialLabel(avgScore),
    summary: `${city}, ${country} shows ${potentialLabel(avgScore).toLowerCase()} launch potential across food delivery, grocery delivery, ride booking/sharing, and courier delivery based on available market signals. Start with ${topZone}, validate supply density and rider/driver coverage, then expand.`,
    recommended_launch_sequence: zoneResults.map((z) => z.name),
    zones: zoneResults,
    overview: [
      { label: "Average Market Score", value: `${avgScore}/100` },
      { label: "Best First Zone", value: topZone },
      { label: "Launch Model", value: "Food, grocery, ride booking/sharing & courier" },
      { label: "Suggested Approach", value: "AI-assisted phased launch" },
    ],
    data_source: "signal_estimation",
  };
}

// ─── OpenAI analysis ─────────────────────────────────────────────────────────

async function generateAIAnalysis(openAIKey, model, payload, signals) {
  const system = "You are a market launch analyst for Enatega, a white-label delivery platform. Return only valid JSON matching the requested schema. Use realistic delivery marketplace reasoning. Do not include markdown.";
  const user = {
    task: "Analyze zone-wise launch potential for four service verticals: Food Delivery, Grocery Delivery, Ride Booking/Sharing, and Courier Delivery.",
    inputs: payload,
    market_signals: { zones: signals },
    scoring_rules: {
      score_range: "35 to 96",
      labels: ["High Potential", "Good Test Market", "Needs Validation", "Not Recommended Initially"],
    },
    json_schema: {
      city: "string", country: "string", average_score: "integer", market_label: "string",
      summary: "string, two concise sentences",
      recommended_launch_sequence: ["zone names sorted by best launch priority"],
      overview: [{ label: "string", value: "string" }],
      zones: [{
        name: "string", score: "integer", potential: "string label",
        best_verticals: ["Food Delivery", "Grocery Delivery", "Ride Booking/Sharing", "Courier Delivery"],
        vendor_target: "integer", rider_target: "integer",
        risk_level: "Low, Medium, Medium-High, or High",
        recommendation: "string",
      }],
    },
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAIKey}` },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
    }),
  });

  if (!res.ok) throw new Error("OpenAI request failed");
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  const json = JSON.parse(content);
  if (!Array.isArray(json?.zones)) throw new Error("Invalid AI response structure");
  return json;
}

function normalizeAIResponse(result, country, city) {
  const zones = (result.zones || []).map((z) => {
    const score = Math.max(35, Math.min(96, parseInt(z.score) || 60));
    return {
      name: z.name || "",
      score,
      potential: z.potential || potentialLabel(score),
      best_verticals: Array.isArray(z.best_verticals) ? z.best_verticals.slice(0, 4) : ["Food Delivery", "Grocery Delivery", "Ride Booking/Sharing", "Courier Delivery"],
      vendor_target: Math.max(5, parseInt(z.vendor_target) || Math.round(score * 0.45)),
      rider_target: Math.max(3, parseInt(z.rider_target) || Math.round(score * 0.18)),
      risk_level: z.risk_level || (score >= 80 ? "Medium" : "Medium-High"),
      recommendation: z.recommendation || "",
    };
  });
  zones.sort((a, b) => b.score - a.score);
  const avgScore = parseInt(result.average_score) || Math.round(zones.reduce((s, z) => s + z.score, 0) / zones.length);
  const topZone = zones[0]?.name || "";
  return {
    city: result.city || city,
    country: result.country || country,
    average_score: avgScore,
    market_label: result.market_label || potentialLabel(avgScore),
    summary: result.summary || "",
    recommended_launch_sequence: result.recommended_launch_sequence || zones.map((z) => z.name),
    overview: Array.isArray(result.overview) && result.overview.length ? result.overview : [
      { label: "Average Market Score", value: `${avgScore}/100` },
      { label: "Best First Zone", value: topZone },
      { label: "Launch Model", value: "Food, grocery, ride booking/sharing & courier" },
      { label: "Suggested Approach", value: "AI-assisted phased launch" },
    ],
    zones,
    data_source: "ai",
  };
}

// ─── Loader Component ─────────────────────────────────────────────────────────

function AILoader({ active }) {
  const [stepIndex, setStepIndex] = useState(-1);
  const [barWidth, setBarWidth] = useState(0);
  const timers = useRef([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!active) { setStepIndex(-1); setBarWidth(0); return; }
    const barWidths = [15, 35, 55, 75, 90];
    LOADER_STEPS.forEach((_, i) => {
      const t = setTimeout(() => {
        setStepIndex(i);
        setBarWidth(barWidths[i]);
      }, LOADER_DELAYS[i]);
      timers.current.push(t);
    });
    return () => timers.current.forEach(clearTimeout);
  }, [active]);

  if (!active) return null;

  return (
    <div className="ai-loader">
      <div className="ai-loader-header">
        <div className="ai-loader-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        </div>
        <span className="ai-loader-label">
          Analysing your launch zones
          <span className="typing-dots"><span /><span /><span /></span>
        </span>
      </div>

      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${barWidth}%` }} />
      </div>

      <div className="loader-steps">
        {LOADER_STEPS.map((step, i) => (
          <div key={i} className={`loader-step${i < stepIndex ? " done" : ""}${i === stepIndex ? " active" : ""}`}>
            <div className="step-icon">{i < stepIndex ? "✓" : i + 1}</div>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Results Component ────────────────────────────────────────────────────────

function Results({ data, ctaUrl, ctaLabel }) {
  if (!data) return null;
  const sourceKey = data.data_source || "signal_estimation";

  return (
    <div className="results">
      <div className="results-head card">
        <div>
          <span className="eyebrow">AI Launch Recommendation</span>
          <h2 className="result-title">{data.city}, {data.country} — {data.market_label}</h2>
          <p className="result-summary">{data.summary}</p>
          <p className={`data-source${sourceKey === "signal_estimation" ? " data-source-fallback" : ""}`}>
            {DATA_SOURCE_LABELS[sourceKey] || ""}
          </p>
        </div>
      </div>

      <div className="overview-grid">
        {(data.overview || []).map((item, i) => (
          <div key={i} className="overview-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Zone-wise potential</h3>
        <div className="table-wrap">
          <table className="zone-table">
            <thead>
              <tr>
                <th>Zone</th><th>Score</th><th>Potential</th>
                <th>Best Fit</th><th>Target Riders</th><th>Target Vendors</th><th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {(data.zones || []).map((zone, i) => {
                const score = Math.max(0, Math.min(100, Number(zone.score) || 0));
                return (
                  <tr key={i}>
                    <td><strong>{zone.name}</strong></td>
                    <td>
                      <div className="score-bar-wrap">
                        <div className="score-bar"><span style={{ width: `${score}%` }} /></div>
                        <strong>{score}</strong>
                      </div>
                    </td>
                    <td><span className={badgeClass(zone.potential)}>{zone.potential}</span></td>
                    <td>{(zone.best_verticals || []).join(", ")}</td>
                    <td>{zone.rider_target || 0}</td>
                    <td>{zone.vendor_target || 0}</td>
                    <td>{zone.risk_level}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(data.recommended_launch_sequence || []).length > 1 && (
        <div className="card">
          <h3>Recommended launch sequence</h3>
          <ol className="launch-sequence">
            {data.recommended_launch_sequence.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="card">
        <h3>Detailed recommendations</h3>
        <div className="recommendations">
          {(data.zones || []).map((zone, i) => (
            <div key={i} className="recommendation">
              <h4>{zone.name}</h4>
              <p>{zone.recommendation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ config, onChange, onClose }) {
  const [local, setLocal] = useState(config);
  const set = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel">
        <div className="settings-header">
          <h3>⚙ Settings</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close settings">✕</button>
        </div>
        <p className="settings-note">Keys are stored only in your browser's localStorage and never sent anywhere except directly to the respective API.</p>

        <label className="field-label">Analysis Mode
          <select value={local.mode} onChange={(e) => set("mode", e.target.value)}>
            <option value="ai">Built-in AI (OpenAI)</option>
            <option value="signal">Signal Estimation (no AI key needed)</option>
          </select>
        </label>

        {local.mode === "ai" && (
          <>
            <label className="field-label">OpenAI API Key
              <input type="password" value={local.openai_api_key} onChange={(e) => set("openai_api_key", e.target.value)} placeholder="sk-..." />
            </label>
            <label className="field-label">OpenAI Model
              <input type="text" value={local.openai_model} onChange={(e) => set("openai_model", e.target.value)} placeholder="gpt-4o-mini" />
            </label>
          </>
        )}

        <label className="field-label">Geoapify API Key <span className="optional">(optional, improves accuracy)</span>
          <input type="password" value={local.geoapify_api_key} onChange={(e) => set("geoapify_api_key", e.target.value)} placeholder="Geoapify key..." />
        </label>

        <label className="field-label">CTA URL
          <input type="text" value={local.cta_url} onChange={(e) => set("cta_url", e.target.value)} />
        </label>

        <label className="field-label">CTA Label
          <input type="text" value={local.cta_label} onChange={(e) => set("cta_label", e.target.value)} />
        </label>

        <div className="settings-actions">
          <button className="btn-save" onClick={() => { onChange(local); onClose(); }}>Save Settings</button>
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  mode: "signal",
  openai_api_key: "",
  openai_model: "gpt-4o-mini",
  geoapify_api_key: "",
};

function loadConfig() {
  try {
    const saved = localStorage.getItem("ezpai_config");
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg) {
  try { localStorage.setItem("ezpai_config", JSON.stringify(cfg)); } catch {}
}

export default function App() {
  const [config, setConfig] = useState(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({ country: "", city: "", zones: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);

  function handleConfigChange(cfg) {
    setConfig(cfg);
    saveConfig(cfg);
  }

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleAnalyze() {
    setError("");

    const countryErr = validateText(form.country, "country", 2, 60);
    if (countryErr) { setError(countryErr); return; }
    const cityErr = validateText(form.city, "city", 2, 90);
    if (cityErr) { setError(cityErr); return; }
    if (!form.zones.trim()) { setError("Please enter at least one zone."); return; }

    const zones = form.zones
      .split(/[\r\n,]+/)
      .map((z) => z.trim())
      .filter(Boolean)
      .slice(0, 12);

    for (const z of zones) {
      const zErr = validateText(z, "zone / area", 2, 120);
      if (zErr) { setError(zErr); return; }
    }

    setLoading(true);
    setResult(null);

    if (resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      let signals = [];
      if (config.geoapify_api_key) {
        signals = await collectMarketSignals(form.country, form.city, zones, config.geoapify_api_key);
      } else {
        signals = zones.map((name) => ({ name }));
      }

      let analysisResult;

      if (config.mode === "ai" && config.openai_api_key) {
        try {
          const payload = { country: form.country, city: form.city, zones, business_type: "multi_vendor" };
          const raw = await generateAIAnalysis(config.openai_api_key, config.openai_model, payload, signals);
          analysisResult = normalizeAIResponse(raw, form.country, form.city);
        } catch (aiErr) {
          console.warn("AI failed, falling back to signal analysis:", aiErr);
          analysisResult = signalBasedAnalysis(form.country, form.city, zones, signals);
        }
      } else {
        analysisResult = signalBasedAnalysis(form.country, form.city, zones, signals);
      }

      setResult(analysisResult);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <header className="site-header">
        <div className="header-inner">
          <div className="logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="8" fill="#5b5bd6" />
              <path d="M8 14.5C8 11 10.5 8 14 8C17.5 8 20 11 20 14.5C20 18 17 20.5 14 20.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="14" cy="14.5" r="2.5" fill="white" />
            </svg>
            <span>Enatega Zone AI</span>
          </div>
          <button className="settings-toggle" onClick={() => setShowSettings(true)} aria-label="Open settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="left-col">
          <div className="hero">
            <div className="eyebrow">Enatega AI Market Launch Analyzer</div>
            <h1>Check Your City's Delivery Business Potential with AI</h1>
            <p className="hero-sub">Get a zone-wise launch recommendation for food delivery, grocery delivery, ride booking/sharing, and courier delivery.</p>
          </div>

          <div className="card form-card">
            <div className="form-grid">
              <label className="field-label">
                Country
                <input type="text" value={form.country} onChange={(e) => setField("country", e.target.value)} placeholder="Qatar" />
              </label>
              <label className="field-label">
                City
                <input type="text" value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Doha" />
              </label>
            </div>
            <label className="field-label">
              Zones / Areas
              <textarea rows={4} value={form.zones} onChange={(e) => setField("zones", e.target.value)} placeholder="Lusail, West Bay, Al Wakrah, The Pearl" />
              <small>Enter zones separated by commas or new lines.</small>
            </label>

            {error && <p className="error-msg" role="alert">{error}</p>}

            <button className="analyze-btn" onClick={handleAnalyze} disabled={loading}>
              {loading ? "Analyzing…" : "Analyze Zone Potential"}
            </button>
          </div>

          <div className="mode-badge">
            Mode: <strong>{config.mode === "ai" && config.openai_api_key ? "AI (OpenAI)" : "Signal Estimation"}</strong>
            {config.geoapify_api_key && " · Geoapify signals active"}
          </div>
        </div>

        <div className="right-col" ref={resultRef}>
          {!loading && !result && (
            <div className="right-inner">
              <h3>What you'll get</h3>
              <p className="right-sub">AI-generated zone analysis based on location signals, vertical fit, and launch feasibility.</p>
              <ul className="feature-list">
                <li>📍 Zone-by-zone market score </li>
                <li>🗺️ Recommended launch sequence</li>
                <li>🎯 Target vendor & rider counts</li>
                <li>⚠️ Risk level per zone</li>
                <li>💡 Detailed zone-level recommendations</li>
              </ul>
            </div>
          )}

          <AILoader active={loading} />
          {!loading && result && (
            <Results data={result} ctaUrl={config.cta_url} ctaLabel={config.cta_label} />
          )}
        </div>
      </main>

      {showSettings && (
        <SettingsPanel
          config={config}
          onChange={handleConfigChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
