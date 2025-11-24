"""Browser controller using Playwright."""

import logging
from typing import Optional
from playwright.sync_api import sync_playwright, Browser, Page, Playwright

logger = logging.getLogger(__name__)


class BrowserController:
    """Controller for browser operations using Playwright."""

    def __init__(self, headless: bool = True):
        """Initialize browser controller.

        Args:
            headless: Whether to run browser in headless mode
        """
        self.headless = headless
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None

    def start(self) -> None:
        """Start browser instance."""
        logger.info("Starting browser...")
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=self.headless)
        self.page = self.browser.new_page()
        logger.info("Browser started successfully")

    def stop(self) -> None:
        """Stop browser instance and clean up resources."""
        logger.info("Stopping browser...")
        if self.page:
            self.page.close()
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()
        logger.info("Browser stopped")

    def navigate(self, url: str) -> None:
        """Navigate to URL.

        Args:
            url: URL to navigate to
        """
        if not self.page:
            raise RuntimeError("Browser not started. Call start() first.")

        logger.info(f"Navigating to: {url}")
        self.page.goto(url, wait_until="domcontentloaded")

    def get_page_content(self) -> str:
        """Get current page HTML content.

        Returns:
            HTML content as string
        """
        if not self.page:
            raise RuntimeError("Browser not started. Call start() first.")

        return self.page.content()

    def get_page_screenshot(self, path: str) -> bool:
        """Take a screenshot of the current page.

        Args:
            path: Path to save the screenshot

        Returns:
            True if successful, False otherwise
        """
        if not self.page:
            return False

        try:
            self.page.screenshot(path=path)
            return True
        except Exception as e:
            logger.error(f"Screenshot failed: {e}")
            return False

    def get_page_screenshot_base64(self) -> Optional[str]:
        """Take a screenshot of the current page and return as base64 string.

        Returns:
            Base64 encoded screenshot string, or None if failed
        """
        if not self.page:
            return None

        try:
            import base64
            screenshot_bytes = self.page.screenshot(type='jpeg', quality=70)
            return base64.b64encode(screenshot_bytes).decode('utf-8')
        except Exception as e:
            logger.error(f"Base64 screenshot failed: {e}")
            return None

    def execute_command(self, command: str) -> bool:
        """Execute a browser command (to be interpreted by AI).

        Args:
            command: Command string from Gemini

        Returns:
            True if successful, False otherwise
        """
        if not self.page:
            raise RuntimeError("Browser not started. Call start() first.")

        try:
            # This is a placeholder - the actual command execution
            # will be implemented based on Gemini's structured output
            logger.info(f"Executing command: {command}")

            # Command examples:
            # - "click: button#submit"
            # - "fill: input[name='username']: john@example.com"
            # - "navigate: https://example.com"
            # - "wait: 2000"

            # For now, just log the command
            # Actual implementation will parse and execute the command

            return True

        except Exception as e:
            logger.error(f"Error executing command: {e}")
            return False

    def __enter__(self):
        """Context manager entry."""
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.stop()
