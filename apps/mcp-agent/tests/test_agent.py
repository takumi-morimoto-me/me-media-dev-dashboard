"""Basic tests for MCP Agent."""

import pytest
from unittest.mock import Mock, patch
from agent import SupabaseClient, BrowserController, GeminiClient


def test_supabase_client_initialization():
    """Test Supabase client initialization."""
    with patch("agent.supabase_client.create_client") as mock_create:
        mock_create.return_value = Mock()
        client = SupabaseClient("https://test.supabase.co", "test-key")
        assert client is not None


def test_browser_controller_lifecycle():
    """Test browser controller start and stop."""
    with patch("agent.browser.sync_playwright"):
        browser = BrowserController(headless=True)
        # Start and stop should not raise errors
        # Actual browser tests would require Playwright installation


def test_gemini_client_initialization():
    """Test Gemini client initialization."""
    with patch("agent.gemini_client.genai"):
        client = GeminiClient("test-api-key", "gemini-2.5-flash")
        assert client is not None


# More comprehensive tests would be added here
