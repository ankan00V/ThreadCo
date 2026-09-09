"""The SQL console's refusals. Layer 1 is the database role; these are layers 4-6."""

import pytest

from app.sqlguard import SqlGuardError, strip_sql_comments, validate


class TestAccepts:
    @pytest.mark.parametrize("sql", [
        "SELECT 1",
        "select count(*) from customers",
        "WITH x AS (SELECT 1) SELECT * FROM x",
        "EXPLAIN SELECT 1",
        "TABLE customers",
        "SELECT 1;",                     # a single trailing semicolon is fine
    ])
    def test_read_only_statements(self, sql):
        assert validate(sql)


class TestRefuses:
    def test_second_statement(self):
        with pytest.raises(SqlGuardError, match="single statement"):
            validate("SELECT 1; DROP TABLE customers")

    @pytest.mark.parametrize("sql", [
        "UPDATE customers SET name = 'x'",
        "DELETE FROM customers",
        "INSERT INTO customers VALUES (1)",
        "DROP TABLE customers",
        "CREATE TABLE t (i int)",
    ])
    def test_writes(self, sql):
        with pytest.raises(SqlGuardError, match="SELECT"):
            validate(sql)

    @pytest.mark.parametrize("sql", [
        "SELECT * FROM pg_catalog.pg_shadow",
        "SELECT * FROM information_schema.tables",
        "SELECT pg_read_file('/etc/passwd')",
        "SELECT pg_sleep(30)",
        "SELECT * FROM pg_authid",
    ])
    def test_denied_surface(self, sql):
        with pytest.raises(SqlGuardError):
            validate(sql)

    def test_comments_cannot_hide_a_denied_token(self):
        # The check runs on comment-stripped text, so this must not slip through.
        with pytest.raises(SqlGuardError):
            validate("SELECT * FROM pg_catalog/**/.pg_shadow")

    def test_empty_and_comment_only(self):
        with pytest.raises(SqlGuardError, match="Empty"):
            validate("")
        with pytest.raises(SqlGuardError, match="comments"):
            validate("-- just a comment")

    def test_length_cap(self):
        with pytest.raises(SqlGuardError, match="too long"):
            validate("SELECT " + "1," * 5000)


def test_cte_delete_passes_text_checks_and_relies_on_the_role():
    """Documents the limit of string checking.

    `WITH x AS (DELETE ...)` starts with WITH, so the shape check accepts it.
    It is refused by the read-only Postgres role instead — which is exactly why
    that role, not this module, is the control that matters.
    """
    assert validate("WITH x AS (DELETE FROM customers RETURNING id) SELECT * FROM x")


def test_strip_sql_comments_removes_both_forms():
    assert "secret" not in strip_sql_comments("SELECT 1 -- secret")
    assert "secret" not in strip_sql_comments("SELECT /* secret */ 1")


def test_ai_client_is_not_built_at_import():
    """A missing LLM key must cost the AI features, not the whole service.

    The OpenAI constructor raises without a key. Building it at module level
    meant an unset NVIDIA_API_KEY took every endpoint down at startup, including
    the ones that never touch the LLM. CI caught this on a runner with no key.
    """
    import app.ai as ai
    assert ai._client is None or ai.ai_available()
