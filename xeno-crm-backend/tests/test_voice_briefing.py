"""Briefing scripts. Composed server-side; never from caller-supplied text."""

from app.voice_briefing import MAX_CHARS, _inr, build_project_script, build_script


def analysis(**over):
    base = {
        "quality": {
            "summary": {"orders": 8449, "customers": 1200, "revenue": 26_010_425, "span_days": 599},
            "checks": [{"name": "c", "status": "pass", "consequence": "fine"}],
        },
        "headline": {"at_risk_customers": 336, "at_risk_revenue": 5_887_006,
                     "at_risk_pct_of_revenue": 22.6},
        "segments": [{"segment": "Champions", "customers": 245, "revenue": 13_382_576,
                      "pct_of_revenue": 51.5}],
    }
    base.update(over)
    return base


class TestSpokenNumbers:
    def test_speaks_indian_units_not_digit_strings(self):
        assert _inr(26_010_425) == "about 2.6 crore rupees"
        assert _inr(5_887_006) == "about 58.9 lakh rupees"
        assert _inr(45_000) == "about 45 thousand rupees"
        assert _inr(400) == "400 rupees"


class TestUploadBriefing:
    def test_includes_the_number_to_act_on(self):
        script = build_script(analysis())
        assert "336" in script
        assert "58.9 lakh" in script
        assert "22.6 percent" in script

    def test_mentions_champions_concentration(self):
        assert "Champions" in build_script(analysis())

    def test_surfaces_a_failing_check_as_a_caveat(self):
        a = analysis()
        a["quality"]["checks"] = [
            {"name": "status", "status": "warn", "consequence": "Refunds count as revenue."}
        ]
        script = build_script(a)
        assert "Refunds count as revenue." in script

    def test_says_so_when_everything_passes(self):
        assert "passed" in build_script(analysis())

    def test_survives_an_empty_segment_list(self):
        a = analysis(segments=[])
        assert build_script(a)          # must not raise

    def test_respects_the_character_ceiling(self):
        a = analysis()
        a["quality"]["checks"] = [
            {"name": "x", "status": "warn", "consequence": "y " * 2000}
        ]
        assert len(build_script(a)) <= MAX_CHARS


class TestProjectBriefing:
    def test_tells_the_audit_story(self):
        script = build_project_script(
            {"passing": 3, "total": 3, "provenance": {"headline": "h"}},
            {"finding": {"customers": 16535, "historical_spend": 774_000_000},
             "lapse_window": {"days": 47}},
            {"orders": 538026, "customers": 80000},
        )
        assert "538,026" in script
        assert "3 of 3" in script
        assert "point five zero two" in script     # spoken, not "0.502"
        assert "point nine four four" in script
        assert "generated" in script               # the caveat survives
        assert "47 days" in script                 # derived window, not a hard-coded one
        assert "forty five" not in script

    def test_works_without_provenance(self):
        script = build_project_script(
            {"passing": 3, "total": 3}, {"finding": {}}, {"orders": 10, "customers": 5},
        )
        assert script and "3 of 3" in script
