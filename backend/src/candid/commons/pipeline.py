import json
from datetime import datetime, timezone

DEFAULT_STAGES = [
    {"id": "screening", "label": "Screening",     "dot": "#3b82f6"},
    {"id": "eval",      "label": "In Evaluation", "dot": "#f59e0b"},
    {"id": "final",     "label": "Final Round",   "dot": "#8b5cf6"},
    {"id": "offer",     "label": "Offer",         "dot": "#10b981"},
]

# Statuses outside the configurable pipeline (inbox, outcomes).
EXTERNAL_STATUSES = frozenset({"new", "hired", "Rejected"})


def first_pipeline_stage(stages: list) -> str:
    for stage in stages:
        if stage.get("id") not in EXTERNAL_STATUSES:
            return stage["id"]
    return "screening"


def append_activity(candidate, event_type: str, note: str, by: str | None = None) -> None:
    """Append an entry to the candidate's JSON activity log (shown in the Activity tab)."""
    log = json.loads(candidate.activity_log or "[]")
    entry = {"type": event_type, "at": datetime.now(timezone.utc).isoformat(), "note": note}
    if by:
        entry["by"] = by
    log.append(entry)
    candidate.activity_log = json.dumps(log)
