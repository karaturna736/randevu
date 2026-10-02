"""Reject absent, incomplete, or budget-limited Strix reports."""
from decimal import Decimal
import json
from pathlib import Path
import sys

runs = list(Path(sys.argv[1]).glob("*/run.json"))
if len(runs) != 1:
    raise SystemExit("Expected exactly one Strix run; scan completion cannot be confirmed")
metadata = json.loads(runs[0].read_text())
if metadata.get("status") != "completed":
    raise SystemExit("Strix did not complete; this is not a clean assessment")
usage = metadata.get("llm_usage") or {}
cost = Decimal(str(usage.get("cost", "NaN")))
budget = Decimal(sys.argv[2])
if not cost.is_finite() or cost < 0:
    raise SystemExit("Strix cost metadata is missing or invalid; inspect coverage manually")
if cost >= budget * Decimal("0.9"):
    raise SystemExit("Scan approached its budget; inspect partial coverage before accepting it")
report = runs[0].parent / "penetration_test_report.md"
if not report.is_file() or not report.read_text().strip():
    raise SystemExit("Strix report is missing")
print("Run completed within its budget; review the report's coverage and findings.")
