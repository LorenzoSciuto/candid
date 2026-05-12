// Fallback stages — overridden at runtime by /config/stages API response
const STATUS = [
  { id: "new",       label: "New",           dot: "#6366f1" },
  { id: "screening", label: "Screening",      dot: "#3b82f6" },
  { id: "eval",      label: "In Evaluation",  dot: "#f59e0b" },
  { id: "final",     label: "Final Round",    dot: "#8b5cf6" },
  { id: "offer",     label: "Offer",          dot: "#10b981" },
];

const initials = (n) => n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

const HUMAN_SKILLS = ["Communication", "Problem Solving", "Adaptability", "Cultural Fit"];
const TECH_SKILLS = ["Domain Knowledge", "Execution Speed", "Analytical Thinking"];

window.CANDID_DATA = {
  STATUS, HUMAN_SKILLS, TECH_SKILLS, initials,
};
