"""CSV ingestion: column detection, type coercion, and the limits that bound it."""

import io
import pytest

from app.dataset_ingest import (
    IngestError, MAX_COLUMNS, _parse_amount, _parse_date, parse_rows, sniff,
)


def csv_bytes(rows: list[str]) -> bytes:
    return "\n".join(rows).encode("utf-8")


SHOPIFY = csv_bytes([
    "Order Number,Customer Email,Paid at,Total Price,Financial Status",
    '#1001,a@shop.example,03/07/2025,"₹2,455.40",paid',
    '#1002,b@shop.example,11/07/2025,"₹1,200.00",refunded',
])


class TestColumnDetection:
    def test_detects_shopify_style_headers(self):
        result = sniff(SHOPIFY)
        assert result["detected"]["customer_id"] == "Customer Email"
        assert result["detected"]["order_date"] == "Paid at"
        assert result["detected"]["amount"] == "Total Price"
        assert result["detected"]["status"] == "Financial Status"

    def test_detects_snake_case_headers(self):
        raw = csv_bytes([
            "order_id,order_date,customer_id,customer_email,total,financial_status",
            "ORD1,2025-04-18,CUST1,c@example.com,208.26,paid",
        ])
        detected = sniff(raw)["detected"]
        assert detected["order_date"] == "order_date"
        assert detected["amount"] == "total"
        # customer_id is a better match than customer_email for the customer field.
        assert detected["customer_id"] in {"customer_id", "customer_email"}

    def test_falls_back_to_content_when_headers_are_opaque(self):
        raw = csv_bytes([
            "col_a,col_b,col_c",
            "x@example.com,2025-04-18,199.00",
            "y@example.com,2025-05-02,240.50",
        ])
        detected = sniff(raw)["detected"]
        # Neither date nor amount can be matched by name here.
        assert detected["order_date"] == "col_b"
        assert detected["amount"] == "col_c"

    def test_semicolon_delimited_file(self):
        raw = csv_bytes([
            "Customer Email;Paid at;Total Price",
            "a@shop.example;2025-04-18;199.00",
        ])
        assert len(sniff(raw)["headers"]) == 3


class TestLimits:
    def test_rejects_empty_file(self):
        with pytest.raises(IngestError, match="empty"):
            sniff(b"")

    def test_rejects_header_only_file(self):
        with pytest.raises(IngestError, match="no data rows"):
            sniff(csv_bytes(["a,b,c"]))

    def test_rejects_single_column(self):
        with pytest.raises(IngestError, match="separated"):
            sniff(csv_bytes(["justonecolumn", "value"]))

    def test_rejects_too_many_columns(self):
        wide = ",".join(f"c{i}" for i in range(MAX_COLUMNS + 5))
        with pytest.raises(IngestError, match="columns"):
            sniff(csv_bytes([wide, wide]))

    def test_rejects_oversized_file(self):
        with pytest.raises(IngestError, match="limit"):
            sniff(b"x" * (9 * 1024 * 1024))


class TestParsing:
    @pytest.mark.parametrize("raw,expected", [
        ("₹2,455.40", 2455.40),
        ("$1,200", 1200.0),
        ("199.00", 199.0),
        ("-50.5", -50.5),
    ])
    def test_amount_strips_currency_and_separators(self, raw, expected):
        assert _parse_amount(raw) == pytest.approx(expected)

    @pytest.mark.parametrize("raw", ["", "n/a", "  ", "-"])
    def test_amount_rejects_unusable(self, raw):
        assert _parse_amount(raw) is None

    @pytest.mark.parametrize("raw", [
        "2025-04-18", "18/04/2025", "2025-04-18 10:24:00", "2025-04-18T10:24:00Z",
    ])
    def test_date_accepts_common_formats(self, raw):
        assert _parse_date(raw) is not None

    def test_date_rejects_nonsense(self):
        assert _parse_date("not a date") is None

    def test_unparseable_rows_are_reported_not_dropped_silently(self):
        raw = csv_bytes([
            "Customer Email,Paid at,Total Price,Financial Status",
            "a@shop.example,2025-04-18,199.00,paid",     # good
            ",2025-04-18,199.00,paid",                    # no customer
            "b@shop.example,not a date,199.00,paid",      # bad date
            "c@shop.example,2025-04-18,n/a,paid",         # bad amount
        ])
        rows, report = parse_rows(raw, {
            "customer_id": "Customer Email", "order_date": "Paid at",
            "amount": "Total Price", "status": "Financial Status",
        })
        assert len(rows) == 1
        assert report["accepted"] == 1
        assert report["skipped"]["missing_customer"] == 1
        assert report["skipped"]["bad_date"] == 1
        assert report["skipped"]["bad_amount"] == 1
        assert report["skipped_total"] == 3

    def test_refuses_a_file_with_nothing_usable(self):
        raw = csv_bytes([
            "Customer Email,Paid at,Total Price",
            "a@shop.example,not a date,n/a",
        ])
        with pytest.raises(IngestError, match="No usable rows"):
            parse_rows(raw, {
                "customer_id": "Customer Email", "order_date": "Paid at", "amount": "Total Price",
            })

    def test_requires_a_mapping_for_every_required_field(self):
        with pytest.raises(IngestError, match="order_date"):
            parse_rows(SHOPIFY, {"customer_id": "Customer Email", "amount": "Total Price"})
