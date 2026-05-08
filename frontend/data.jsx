// Sample data for Candid — Senior Frontend Engineer pipeline

const STATUS = [
  { id: "new", label: "New", dot: "var(--status-new)" },
  { id: "screening", label: "Screening", dot: "var(--status-screening)" },
  { id: "pre", label: "Pre-Interview", dot: "var(--status-pre)" },
  { id: "eval", label: "In Evaluation", dot: "var(--status-eval)" },
  { id: "final", label: "Final Round", dot: "var(--status-final)" },
  { id: "offer", label: "Offer", dot: "var(--status-offer)" },
];

const initials = (n) => n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

const CANDIDATES = [
  {
    id: "c-001",
    first: "Maya", last: "Chen",
    email: "maya.chen@hey.com",
    phone: "+1 (415) 555-0142",
    role: "Senior Frontend Engineer",
    location: "San Francisco, CA",
    experience: 7,
    status: "eval",
    source: "Referral · Jordan A.",
    appliedAt: "2026-04-28",
    nextStep: "Tech Deep Dive · May 9, 2:00 PM",
    score: 4.4,
    pre: {
      strengths: [
        "Deep React + TypeScript fluency — shipped a design system across 14 product surfaces at Linear-adjacent scale.",
        "Strong on perf: cut LCP 41% through islands architecture and Suspense streaming on a 3M MAU app.",
        "Documented experience leading frontend infra rewrites end-to-end (Webpack → Vite, Jest → Vitest).",
        "Direct exposure to design tokens, theming, and a11y audits — closes a current team gap.",
      ],
      weaknesses: [
        "No mention of Next.js App Router or RSC — our planned migration leans heavily on it.",
        "Limited backend visibility; JD asks for cross-stack debugging up to the GraphQL layer.",
        "Last team size led was 3 — JD prefers tech-lead history of 5+ ICs.",
      ],
      questions: [
        "Walk me through a recent perf regression you discovered post-ship. How did you triage versus a synthetic CI signal you might have caught earlier?",
        "When you migrated from Webpack to Vite, what was the most surprising behavioral difference in production, and how did you find it?",
        "If you joined and saw our DS forking across teams, what's your week-one move — and what signals would tell you it's working?",
      ],
    },
    rating: {
      human: { Communication: 5, "Problem Solving": 5, Adaptability: 4, "Cultural Fit": 4 },
      technical: { "Domain Knowledge": 5, "Execution Speed": 4, "Analytical Thinking": 5 },
      recommendation: "Strong Hire",
    },
    interviews: [
      { id: "i-1", date: "May 2", type: "Live Recording", duration: "47m", title: "Recruiter Screen", interviewer: "Devon Park", summary: "Confirmed comp band, visa OK, 4-week notice. Pulled by mission, not pay." },
      { id: "i-2", date: "May 6", type: "Live Recording", duration: "62m", title: "Hiring Manager", interviewer: "Sasha Rivera", summary: "Strong systems thinking, quietly opinionated. Asked sharp questions about our DS governance." },
    ],
  },
  { id: "c-002", first: "Daniel", last: "Park", email: "d.park@protonmail.com", role: "Senior Frontend Engineer", experience: 6, status: "screening", source: "LinkedIn", score: 3.6, appliedAt: "2026-05-02" },
  { id: "c-003", first: "Priya", last: "Iyer", email: "priya.iyer@gmail.com", role: "Senior Frontend Engineer", experience: 9, status: "final", source: "Inbound", score: 4.6, appliedAt: "2026-04-19" },
  { id: "c-004", first: "Tomás", last: "Rivera", email: "tomas.r@me.com", role: "Senior Frontend Engineer", experience: 5, status: "new", source: "Job board", score: null, appliedAt: "2026-05-07" },
  { id: "c-005", first: "Rachel", last: "Wu", email: "rachel.wu@hey.com", role: "Senior Frontend Engineer", experience: 8, status: "offer", source: "Referral", score: 4.8, appliedAt: "2026-04-10" },
  { id: "c-006", first: "Yusuf", last: "Adeyemi", email: "yusuf@duck.com", role: "Senior Frontend Engineer", experience: 7, status: "eval", source: "Inbound", score: 4.1, appliedAt: "2026-04-30" },
  { id: "c-007", first: "Hana", last: "Ito", email: "hana.ito@fastmail.com", role: "Senior Frontend Engineer", experience: 6, status: "pre", source: "LinkedIn", score: null, appliedAt: "2026-05-05" },
  { id: "c-008", first: "Marcus", last: "Greene", email: "marcus.g@hey.com", role: "Senior Frontend Engineer", experience: 10, status: "final", source: "Referral", score: 4.3, appliedAt: "2026-04-22" },
  { id: "c-009", first: "Ava", last: "Lindqvist", email: "ava.l@hey.com", role: "Senior Frontend Engineer", experience: 4, status: "screening", source: "Job board", score: 3.2, appliedAt: "2026-05-04" },
  { id: "c-010", first: "Kenji", last: "Watanabe", email: "kenji.w@gmail.com", role: "Senior Frontend Engineer", experience: 8, status: "new", source: "Inbound", score: null, appliedAt: "2026-05-08" },
  { id: "c-011", first: "Olivia", last: "Bauer", email: "olivia.b@hey.com", role: "Senior Frontend Engineer", experience: 5, status: "pre", source: "LinkedIn", score: null, appliedAt: "2026-05-06" },
];

const JD_DEFAULT = `Senior Frontend Engineer — Platform

We're hiring a Senior Frontend Engineer to lead the next chapter of our design system and core app shell. You'll partner with design, infra, and 5+ ICs to ship the migration to Next.js App Router (RSC), expand our token-based theming system, and own the perf budget of our highest-traffic surfaces.

What you'll do
— Architect and ship features in TypeScript + React across web and mobile-web
— Own perf, accessibility, and observability of 4–5 customer-facing surfaces
— Lead and mentor a pod of 3–5 frontend engineers
— Drive cross-stack debugging into our GraphQL/Node layer when needed
— Set the bar for testing, documentation, and release hygiene

What we're looking for
— 6+ years building production web apps; 2+ in a senior or lead capacity
— Deep TypeScript, React, and modern build tooling (Vite/Turbopack)
— Demonstrated impact on Core Web Vitals at scale
— Strong taste for design systems and component API ergonomics
— Excellent written communication; calm under ambiguity`;

const SAMPLE_CV = `Maya Chen
Senior Frontend Engineer · San Francisco, CA · maya.chen@hey.com · +1 (415) 555-0142

EXPERIENCE
Staff Frontend Engineer — Lattice (2022–Present)
• Led design system v3 across 14 product surfaces; adopted by 28 ICs across 4 product pods
• Cut LCP by 41% on highest-traffic surface via islands + Suspense streaming
• Drove migration from Webpack → Vite (–62% local dev start, –28% CI build time)
• Mentored 3 ICs from mid → senior; 2 promoted within 12 months

Senior Frontend Engineer — Notion (2019–2022)
• Owned the editor's command palette and slash-menu surface area
• Shipped collaborative cursor v2 (CRDT-based, offline-tolerant)
• Led migration of test infra from Jest → Vitest across 14k tests

Frontend Engineer — Stripe (2017–2019)
• Built and maintained Checkout's payment-method picker
• Authored team's accessibility playbook; added a11y CI gates

EDUCATION
B.S. Computer Science, UC Berkeley, 2017

SKILLS
TypeScript, React, design systems, performance, accessibility, Vite, GraphQL (consumer), Storybook, Playwright`;

const SAMPLE_TRANSCRIPT = [
  { speaker: "Interviewer", who: "Sasha Rivera", t: "00:12", text: "Thanks for jumping on. I want to start with the design system rewrite at Lattice — what was the trigger?" },
  { speaker: "Candidate", who: "Maya Chen", t: "00:24", text: "Sure. The honest answer is that v2 had become four design systems wearing a trenchcoat. Three product pods had quietly forked Button, and our token layer was a string-replacement pipeline." },
  { speaker: "Interviewer", who: "Sasha Rivera", t: "01:02", text: "That's painful. How did you scope it before pitching to leadership?" },
  { speaker: "Candidate", who: "Maya Chen", t: "01:14", text: "I instrumented usage first. We added a tiny telemetry hook to our component imports, ran it for two weeks, and got a real graph of which forks existed and where. Then I wrote a one-pager grouped by 'what would break if we deleted this fork tomorrow.'" },
  { speaker: "Interviewer", who: "Sasha Rivera", t: "01:55", text: "And the perf work — the LCP 41% number. What was the single biggest lever?" },
  { speaker: "Candidate", who: "Maya Chen", t: "02:08", text: "Honestly: deleting code. Specifically, the analytics SDK we shipped synchronously above the fold. We moved it to onIdle and the LCP graph dropped overnight. The Suspense streaming was the headline change but it was probably 30% of the win." },
];

const STREAMING_PRE = {
  strengths: [
    "Deep React + TypeScript fluency — shipped a design system across 14 product surfaces at Linear-adjacent scale.",
    "Strong on perf: cut LCP 41% through islands architecture and Suspense streaming on a 3M MAU app.",
    "Documented experience leading frontend infra rewrites end-to-end (Webpack → Vite, Jest → Vitest).",
    "Direct exposure to design tokens, theming, and a11y audits — closes a current team gap.",
  ],
  weaknesses: [
    "No mention of Next.js App Router or RSC — our planned migration leans heavily on it.",
    "Limited backend visibility; JD asks for cross-stack debugging up to the GraphQL layer.",
    "Last team size led was 3 — JD prefers tech-lead history of 5+ ICs.",
  ],
  questions: [
    "Walk me through a recent perf regression you discovered post-ship. How did you triage versus a synthetic CI signal you might have caught earlier?",
    "When you migrated from Webpack to Vite, what was the most surprising behavioral difference in production, and how did you find it?",
    "If you joined and saw our DS forking across teams, what's your week-one move — and what signals would tell you it's working?",
  ],
  extracted: { first_name: "Maya", last_name: "Chen", email: "maya.chen@hey.com", role: "Senior Frontend Engineer" },
};

const HUMAN_SKILLS = ["Communication", "Problem Solving", "Adaptability", "Cultural Fit"];
const TECH_SKILLS = ["Domain Knowledge", "Execution Speed", "Analytical Thinking"];

const ROLES = [
  { id: "r-001", name: "Senior Frontend Engineer", department: "Engineering", headcount: 2, description: "Leads frontend architecture, design system work, and Core Web Vitals ownership across customer-facing surfaces." },
  { id: "r-002", name: "Staff Product Designer", department: "Design", headcount: 1, description: "Sets design direction, runs design system governance, and partners with product on 0→1 features." },
  { id: "r-003", name: "ML Platform Engineer", department: "Engineering", headcount: 1, description: "Builds ML infrastructure, training pipelines, and model-serving APIs." },
  { id: "r-004", name: "Engineering Manager", department: "Engineering", headcount: 1, description: "Manages the Growth engineering pod. 3–6 ICs, cross-stack scope." },
  { id: "r-005", name: "Senior Product Manager", department: "Product", headcount: 1, description: "Owns product roadmap for growth loop and monetisation surfaces." },
  { id: "r-006", name: "Recruiter", department: "People", headcount: 2, description: "Sources, screens, and closes candidates across all departments." },
  { id: "r-007", name: "Hiring Manager", department: "People", headcount: 1, description: "Partners with recruiting to define role requirements and close senior hires." },
];

const JDS_DATA = [
  { id: "jd-001", role_id: "r-001", title: "Senior Frontend Engineer — Platform", location: "SF / Remote", status: "Active", openings: 2, candidates: 11, days: 14, owner: "Sasha Rivera", description: JD_DEFAULT },
  { id: "jd-002", role_id: "r-002", title: "Staff Product Designer", location: "Remote", status: "Active", openings: 1, candidates: 7, days: 9, owner: "Mira Khan", description: "Design system lead and product design IC." },
  { id: "jd-003", role_id: "r-003", title: "ML Platform Engineer", location: "NYC", status: "Active", openings: 1, candidates: 4, days: 21, owner: "Sasha Rivera", description: "Build and scale ML training pipelines." },
  { id: "jd-004", role_id: "r-004", title: "Engineering Manager — Growth", location: "SF", status: "On hold", openings: 1, candidates: 3, days: 38, owner: "Avi Chen", description: "Lead a cross-functional growth pod." },
  { id: "jd-005", role_id: "r-005", title: "Senior Product Manager", location: "Remote", status: "Draft", openings: 1, candidates: 0, days: 0, owner: "Mira Khan", description: "Own growth loop roadmap and experimentation." },
];

const EMPLOYEES = [
  { id: "emp-001", first_name: "Sasha", last_name: "Rivera", email: "sasha@candid.app", role_id: "r-007", role_name: "Hiring Manager", department: "People", salary: 195000, currency: "USD", hire_date: "2021-03-15", location: "SF" },
  { id: "emp-002", first_name: "Devon", last_name: "Park", email: "devon@candid.app", role_id: "r-006", role_name: "Recruiter", department: "People", salary: 125000, currency: "USD", hire_date: "2022-06-01", location: "SF" },
  { id: "emp-003", first_name: "Avi", last_name: "Chen", email: "avi@candid.app", role_id: "r-004", role_name: "Engineering Manager", department: "Engineering", salary: 230000, currency: "USD", hire_date: "2020-11-10", location: "SF" },
  { id: "emp-004", first_name: "Mira", last_name: "Khan", email: "mira@candid.app", role_id: "r-006", role_name: "Recruiter", department: "People", salary: 118000, currency: "USD", hire_date: "2023-01-16", location: "Remote" },
  { id: "emp-005", first_name: "Priya", last_name: "Iyer", email: "priya@candid.app", role_id: "r-001", role_name: "Senior Frontend Engineer", department: "Engineering", salary: 210000, currency: "USD", hire_date: "2022-09-05", location: "SF" },
  { id: "emp-006", first_name: "Jordan", last_name: "Alvarez", email: "jordan@candid.app", role_id: "r-001", role_name: "Senior Frontend Engineer", department: "Engineering", salary: 195000, currency: "USD", hire_date: "2023-04-12", location: "Remote" },
  { id: "emp-007", first_name: "Yuki", last_name: "Tanaka", email: "yuki@candid.app", role_id: "r-003", role_name: "ML Platform Engineer", department: "Engineering", salary: 220000, currency: "USD", hire_date: "2021-08-23", location: "NYC" },
  { id: "emp-008", first_name: "Lena", last_name: "Fischer", email: "lena@candid.app", role_id: "r-002", role_name: "Staff Product Designer", department: "Design", salary: 185000, currency: "USD", hire_date: "2022-03-07", location: "Remote" },
];

window.CANDID_DATA = {
  STATUS, CANDIDATES, JD_DEFAULT, SAMPLE_CV, SAMPLE_TRANSCRIPT, STREAMING_PRE,
  HUMAN_SKILLS, TECH_SKILLS, initials,
  ROLES, JDS_DATA, EMPLOYEES,
};
