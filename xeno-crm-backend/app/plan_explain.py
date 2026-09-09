"""
Turn a PostgreSQL plan into something a person can act on.

EXPLAIN output tells you what the planner did. It does not tell you which part
is the problem, or why. These rules read the plan tree and surface the specific
things that make a query slow at scale — the ones behind every case study in the
Performance Lab.

Deliberately rule-based, not an LLM: the diagnosis has to be reproducible and
correct, and every rule here maps to a documented Postgres behaviour.
"""

from __future__ import annotations

from typing import Any

# Below this, a sequential scan is usually the right choice and flagging it is noise.
SEQ_SCAN_ROW_FLOOR = 50_000

# Planner estimate off by more than this factor means the stats are misleading it.
ESTIMATE_SKEW_FACTOR = 10.0


def _walk(node: dict[str, Any], depth: int = 0):
    yield node, depth
    for child in node.get("Plans", []) or []:
        yield from _walk(child, depth + 1)


def explain_plan(plan_json: Any) -> dict[str, Any]:
    """Return findings, ordered most important first, plus a one-line summary."""
    root = plan_json[0] if isinstance(plan_json, list) else plan_json
    plan = root.get("Plan", root)

    findings: list[dict[str, str]] = []
    nodes = list(_walk(plan))

    total_ms = root.get("Execution Time")

    for node, _ in nodes:
        ntype = node.get("Node Type", "")
        # Postgres 16+ emits these as floats in the JSON plan.
        actual_rows = int(node["Actual Rows"]) if node.get("Actual Rows") is not None else None
        plan_rows = int(node["Plan Rows"]) if node.get("Plan Rows") is not None else None
        relation = node.get("Relation Name", "")
        loops = node.get("Actual Loops", 1) or 1

        # 1. Sequential scan over a large table.
        if ntype == "Seq Scan" and (actual_rows or 0) >= SEQ_SCAN_ROW_FLOOR:
            findings.append({
                "severity": "high",
                "title": f"Sequential scan over {relation or 'a table'}",
                "detail": f"Read {actual_rows:,} rows without an index. If the filter is "
                          f"selective, an index on the filtered column turns this into a lookup. "
                          f"If it is not selective, a scan is the correct plan and the query "
                          f"itself needs to change.",
            })

        # 2. Sort that spilled to disk.
        if ntype == "Sort" and node.get("Sort Method", "").startswith("external"):
            findings.append({
                "severity": "high",
                "title": "Sort spilled to disk",
                "detail": f"Sort method was '{node.get('Sort Method')}'. The sort exceeded "
                          f"work_mem and fell back to disk, which is far slower than sorting in "
                          f"memory. Reduce the rows being sorted, or add an index matching the "
                          f"ORDER BY so the sort disappears entirely.",
            })

        # 3. Planner estimate badly wrong — stale or missing statistics.
        if plan_rows and actual_rows and plan_rows > 0:
            ratio = max(actual_rows / plan_rows, plan_rows / max(actual_rows, 1))
            if ratio >= ESTIMATE_SKEW_FACTOR and actual_rows > 1000:
                findings.append({
                    "severity": "medium",
                    "title": f"Planner estimate off by {ratio:.0f}x on {ntype}",
                    "detail": f"Estimated {plan_rows:,} rows, got {actual_rows:,}. The planner is "
                              f"choosing a strategy based on a wrong row count. Run ANALYZE on the "
                              f"tables involved; if it persists, the column may need finer "
                              f"statistics.",
                })

        # 4. Nested loop executing its inner side many times.
        if ntype == "Nested Loop" and loops == 1:
            inner = (node.get("Plans") or [None, None])[-1]
            if inner and (inner.get("Actual Loops") or 1) > 1000:
                findings.append({
                    "severity": "high",
                    "title": "Nested loop running its inner side thousands of times",
                    "detail": f"The inner node executed {int(inner.get("Actual Loops") or 1):,} times. A hash "
                              f"join usually wins at this size. This often means the planner "
                              f"under-estimated the outer row count.",
                })

        # 5. Deep OFFSET — rows produced then thrown away.
        if ntype == "Limit":
            child = (node.get("Plans") or [None])[0]
            if child:
                produced = int(child.get("Actual Rows") or 0)
                kept = actual_rows or 0
                if produced - kept >= 10_000:
                    findings.append({
                        "severity": "high",
                        "title": f"OFFSET discarded {produced - kept:,} rows",
                        "detail": "The plan produced these rows and then threw them away. OFFSET is "
                                  "not a seek — cost grows with page depth. Keyset pagination "
                                  "(WHERE sort_key < :cursor) is constant time at any depth.",
                    })

        # 6. Index scan filtering out most of what it read.
        if ntype in ("Index Scan", "Bitmap Heap Scan"):
            removed = int(node.get("Rows Removed by Filter") or 0)
            if removed > 10_000 and removed > (actual_rows or 0) * 2:
                findings.append({
                    "severity": "medium",
                    "title": f"Index used, but {removed:,} rows discarded after reading",
                    "detail": "The index narrowed the search but the filter did most of the work. "
                              "A composite index covering both the indexed column and the filtered "
                              "one would avoid reading these rows at all.",
                })

    # Dedupe by title, keeping the first (most deeply nested wins ties naturally).
    seen, unique = set(), []
    for f in findings:
        if f["title"] not in seen:
            seen.add(f["title"])
            unique.append(f)

    order = {"high": 0, "medium": 1, "low": 2}
    unique.sort(key=lambda f: order.get(f["severity"], 3))

    indexes = sorted({n.get("Index Name") for n, _ in nodes if n.get("Index Name")})
    strategies = [n.get("Node Type") for n, _ in nodes if n.get("Node Type")]

    return {
        "execution_ms": round(total_ms, 2) if total_ms is not None else None,
        "strategy": " → ".join(strategies[:6]),
        "indexes_used": indexes,
        "findings": unique[:5],
        "verdict": (
            "No common performance problems detected in this plan."
            if not unique else
            f"{len(unique)} issue{'s' if len(unique) != 1 else ''} worth looking at."
        ),
    }
