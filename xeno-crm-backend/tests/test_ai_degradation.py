"""The service must survive an unconfigured LLM."""

import importlib
import os

import pytest


@pytest.fixture
def ai_without_key(monkeypatch):
    """Reimport app.ai with no key and with .env loading neutralised."""
    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **k: False)
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    import app.ai as ai
    return importlib.reload(ai)


def test_module_imports_without_a_key(ai_without_key):
    assert ai_without_key is not None


def test_reports_itself_unavailable(ai_without_key):
    assert ai_without_key.ai_available() is False


def test_building_the_client_raises_a_typed_error(ai_without_key):
    with pytest.raises(ai_without_key.AIUnavailable, match="NVIDIA_API_KEY"):
        ai_without_key._get_client()


def test_error_message_says_the_rest_still_works(ai_without_key):
    try:
        ai_without_key._get_client()
    except ai_without_key.AIUnavailable as exc:
        assert "Everything else" in str(exc)


def test_available_when_a_key_is_present(monkeypatch):
    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **k: False)
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    import app.ai as ai
    reloaded = importlib.reload(ai)
    assert reloaded.ai_available() is True
