#!/usr/bin/env bash
# Compile every backend module with a real Python 3.11 interpreter.
#
# This exists because ast.parse(..., feature_version=(3, 11)) DOES NOT catch
# f-string syntax that only parses on 3.12+. feature_version gates some grammar
# but not the f-string tokenizer, so nesting same-type quotes inside an f-string
# —  f"{d.get("k")}"  — passes that check and then fails at import on Render,
# which runs 3.11. It shipped twice before this script existed.
#
# Usage:  ./check_python311.sh          (finds a 3.11 on PATH or in Homebrew)
set -uo pipefail

PY311="${PY311:-}"
for candidate in \
    "$PY311" \
    "$(command -v python3.11 2>/dev/null)" \
    /opt/homebrew/opt/python@3.11/bin/python3.11 \
    /usr/local/opt/python@3.11/bin/python3.11
do
    [ -n "$candidate" ] && [ -x "$candidate" ] && PY311="$candidate" && break
done

if [ -z "$PY311" ]; then
    echo "No Python 3.11 found. Install it (brew install python@3.11) or set PY311." >&2
    echo "Skipping the check rather than passing it falsely." >&2
    exit 2
fi

"$PY311" - "$(dirname "$0")" <<'PYEOF'
import pathlib, py_compile, sys, tempfile

root = pathlib.Path(sys.argv[1])
failures = []
checked = 0
for path in sorted(root.rglob("*.py")):
    if "venv" in path.parts or "__pycache__" in path.parts:
        continue
    checked += 1
    try:
        py_compile.compile(str(path), cfile=tempfile.mktemp(), doraise=True)
    except py_compile.PyCompileError as exc:
        failures.append(f"{path}\n    {str(exc).strip().splitlines()[-1]}")

if failures:
    print(f"FAILED under Python {sys.version.split()[0]}:\n")
    print("\n\n".join(failures))
    sys.exit(1)

print(f"{checked} files compile under Python {sys.version.split()[0]}")
PYEOF
