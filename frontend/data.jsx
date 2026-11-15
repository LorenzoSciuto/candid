// Fallback stages — overridden at runtime by /config/stages API response
const STATUS = [
  { id: "new",       label: "New",           dot: "#6366f1" },
  { id: "screening", label: "Screening",      dot: "#3b82f6" },
  { id: "eval",      label: "In Evaluation",  dot: "#f59e0b" },
  { id: "final",     label: "Final Round",    dot: "#8b5cf6" },
  { id: "offer",     label: "Offer",          dot: "#10b981" },
];

const initials = (n) => n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

const HUMAN_SKILLS = ["Communication", "Problem Solving", "Adaptability", "Cultural Fit", "Leadership Potential", "Ownership & Initiative"];
const TECH_SKILLS = ["Domain Knowledge", "Analytical Thinking", "Execution Speed", "AI Tool Proficiency", "Systems Thinking"];

const SKILL_KEYS = {
  "Communication":        "skill.communication",
  "Problem Solving":      "skill.problemSolving",
  "Adaptability":         "skill.adaptability",
  "Cultural Fit":         "skill.culturalFit",
  "Leadership Potential": "skill.leadershipPotential",
  "Ownership & Initiative": "skill.ownershipInitiative",
  "Domain Knowledge":     "skill.domainKnowledge",
  "Analytical Thinking":  "skill.analyticalThinking",
  "Execution Speed":      "skill.executionSpeed",
  "AI Tool Proficiency":  "skill.aiToolProficiency",
  "Systems Thinking":     "skill.systemsThinking",
};

const SOURCES = [
  "Referral", "LinkedIn", "Inbound", "Job board",
  "Agency", "CV Upload", "Portal", "Other",
];

window.CANDID_DATA = {
  STATUS, HUMAN_SKILLS, TECH_SKILLS, SKILL_KEYS, SOURCES, initials,
};

// Organisation preferences — overwritten from GET /config/preferences after login.
window.CANDID_PREFS = { date_format: "dd/MM/yyyy", currency: "EUR", locations: ["Remote"] };
window.getCurrency = () => window.CANDID_PREFS.currency;
window.getLocations = () => window.CANDID_PREFS.locations;

// Save a partial preferences update for the whole organisation and keep the local copy in sync.
window.savePreferences = async (patch) => {
  const res = await fetch(`${window.API_BASE}/config/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Saving preferences failed (${res.status})`);
  window.CANDID_PREFS = await res.json();
  window.CANDID_DATE_FORMAT = window.CANDID_PREFS.date_format;
  return window.CANDID_PREFS;
};
