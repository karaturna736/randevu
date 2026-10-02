"""Check that unfinished and budget-limited scans cannot pass verification."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile

verifier = Path("scripts/verify-strix-run.py").resolve()
cases = [
    ({"status": "completed", "llm_usage": {"cost": 1}}, True, True),
    ({"status": "stopped", "llm_usage": {"cost": 1}}, True, False),
    ({"status": "completed", "llm_usage": {"cost": 4.5}}, True, False),
    ({"status": "completed", "llm_usage": {"cost": 5}}, True, False),
    ({"status": "completed"}, True, False),
    ({"status": "completed", "llm_usage": {"cost": "NaN"}}, True, False),
    ({"status": "completed", "llm_usage": {"cost": 1}}, False, False),
    (None, False, False),
]
for metadata, report, expected in cases:
    with tempfile.TemporaryDirectory(prefix="neta-strix-run-test-") as directory:
        root = Path(directory)
        if metadata:
            run = root / "test-run"
            run.mkdir()
            (run / "run.json").write_text(json.dumps(metadata))
            if report:
                (run / "penetration_test_report.md").write_text("Synthetic report for validator testing.")
        result = subprocess.run([sys.executable, str(verifier), str(root), "5"], capture_output=True, text=True)
        assert (result.returncode == 0) == expected, result.stdout + result.stderr
print(json.dumps({"passed": len(cases), "failed": 0}))
