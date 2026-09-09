"""Plan diagnostics. Each rule maps to a documented Postgres behaviour."""

from app.plan_explain import explain_plan


def plan(node: dict, execution_ms: float = 12.0) -> list:
    return [{"Plan": node, "Execution Time": execution_ms}]


def titles(result: dict) -> str:
    return " | ".join(f["title"] for f in result["findings"])


def test_flags_large_sequential_scan():
    result = explain_plan(plan({
        "Node Type": "Seq Scan", "Relation Name": "orders",
        "Actual Rows": 500_000, "Plan Rows": 500_000,
    }))
    assert "Sequential scan over orders" in titles(result)
    assert result["findings"][0]["severity"] == "high"


def test_ignores_small_sequential_scan():
    """Below the row floor a scan is usually correct; flagging it is noise."""
    result = explain_plan(plan({
        "Node Type": "Seq Scan", "Relation Name": "segments",
        "Actual Rows": 40, "Plan Rows": 40,
    }))
    assert result["findings"] == []
    assert "No common performance problems" in result["verdict"]


def test_flags_sort_spilling_to_disk():
    result = explain_plan(plan({
        "Node Type": "Sort", "Sort Method": "external merge",
        "Actual Rows": 100_000, "Plan Rows": 100_000,
    }))
    assert "Sort spilled to disk" in titles(result)


def test_flags_bad_planner_estimate():
    result = explain_plan(plan({
        "Node Type": "Hash Join", "Actual Rows": 200_000, "Plan Rows": 500,
    }))
    assert "Planner estimate off" in titles(result)


def test_flags_deep_offset_discarding_rows():
    result = explain_plan(plan({
        "Node Type": "Limit", "Actual Rows": 20, "Plan Rows": 20,
        "Plans": [{"Node Type": "Index Scan", "Actual Rows": 400_020, "Plan Rows": 400_020}],
    }))
    assert "OFFSET discarded 400,000 rows" in titles(result)


def test_flags_index_scan_discarding_most_of_what_it_read():
    result = explain_plan(plan({
        "Node Type": "Index Scan", "Index Name": "ix_orders_status_created",
        "Actual Rows": 500, "Plan Rows": 500, "Rows Removed by Filter": 80_000,
    }))
    assert "discarded" in titles(result)


def test_reports_indexes_used_and_execution_time():
    result = explain_plan(plan({
        "Node Type": "Index Scan", "Index Name": "ix_orders_created_id_desc",
        "Actual Rows": 20, "Plan Rows": 20,
    }, execution_ms=0.08))
    assert result["indexes_used"] == ["ix_orders_created_id_desc"]
    assert result["execution_ms"] == 0.08


def test_handles_float_row_counts_from_postgres_16_plus():
    """PG16+ emits Actual Rows as a float; counts must still format cleanly."""
    result = explain_plan(plan({
        "Node Type": "Limit", "Actual Rows": 20.0, "Plan Rows": 20.0,
        "Plans": [{"Node Type": "Index Scan", "Actual Rows": 400_020.0, "Plan Rows": 400_020.0}],
    }))
    title = titles(result)
    # Substring matching is not enough here: "400,000" is inside "400,000.0",
    # so asserting only that would pass with the bug present. Assert the exact
    # rendering and the absence of the float tail.
    assert "OFFSET discarded 400,000 rows" in title
    assert "400,000.0" not in title


def test_findings_are_deduplicated_and_severity_ordered():
    result = explain_plan(plan({
        "Node Type": "Sort", "Sort Method": "external merge",
        "Actual Rows": 300_000, "Plan Rows": 1_000,
        "Plans": [{"Node Type": "Seq Scan", "Relation Name": "orders",
                   "Actual Rows": 300_000, "Plan Rows": 300_000}],
    }))
    severities = [f["severity"] for f in result["findings"]]
    assert severities == sorted(severities, key=lambda s: {"high": 0, "medium": 1, "low": 2}[s])
    assert len(set(f["title"] for f in result["findings"])) == len(result["findings"])
