const STATUS = [
  { id: "new", label: "New", dot: "var(--status-new)" },
  { id: "screening", label: "Screening", dot: "var(--status-screening)" },
  { id: "pre", label: "Pre-Interview", dot: "var(--status-pre)" },
  { id: "eval", label: "In Evaluation", dot: "var(--status-eval)" },
  { id: "final", label: "Final Round", dot: "var(--status-final)" },
  { id: "offer", label: "Offer", dot: "var(--status-offer)" },
];

const initials = (n) => n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

const HUMAN_SKILLS = ["Communication", "Problem Solving", "Adaptability", "Cultural Fit"];
const TECH_SKILLS = ["Domain Knowledge", "Execution Speed", "Analytical Thinking"];

window.CANDID_DATA = {
  STATUS, HUMAN_SKILLS, TECH_SKILLS, initials,
};
