"""Main orchestrator for autonomous ASP data collection."""

import logging
import re
from typing import Optional, List, Dict, Any
from .database import SupabaseClient
from .browser import BrowserController
from .ai_client import GeminiClient

logger = logging.getLogger(__name__)


class AgentLoop:
    """Main agent loop that orchestrates the autonomous scraping process."""

    def __init__(
        self,
        supabase_client: SupabaseClient,
        browser: BrowserController,
        gemini_client: GeminiClient,
    ):
        """Initialize agent loop.

        Args:
            supabase_client: Supabase client for database operations
            browser: Browser controller
            gemini_client: Gemini client for AI interpretation
        """
        self.supabase = supabase_client
        self.browser = browser
        self.gemini = gemini_client
        self.current_asp_data: Optional[Dict[str, Any]] = None

    def run_asp_scraper(self, asp_name: str) -> bool:
        """Run scraper for a specific ASP.

        Args:
            asp_name: Name of the ASP to scrape

        Returns:
            True if successful, False otherwise
        """
        logger.info(f"Starting scraper for ASP: {asp_name}")

        # Get ASP scenario from database
        asp_data = self.supabase.get_asp_scenario(asp_name)
        if not asp_data:
            logger.error(f"No scenario found for ASP: {asp_name}")
            return False

        scenario = asp_data.get("prompt")
        if not scenario:
            logger.error(f"No prompt defined for ASP: {asp_name}")
            return False

        # Store current ASP data for use in extract action
        self.current_asp_data = asp_data

        # Parse scenario into steps
        steps = self._parse_scenario(scenario)
        logger.info(f"Parsed {len(steps)} steps from scenario")

        # Start browser
        self.browser.start()

        try:
            # Execute each step
            for i, step in enumerate(steps, 1):
                logger.info(f"Step {i}/{len(steps)}: {step}")

                # Get current page context
                page_context = self.browser.get_page_content()

                # Ask Gemini to interpret the step
                command = self.gemini.interpret_scenario_step(step, page_context)

                # Execute the command
                success = self._execute_command(command)

                # If command failed and it was a click action, try fallback with text extraction
                if not success and command.get("action") == "click":
                    logger.warning(f"Command failed, trying fallback with text extraction from step")
                    # Extract text from step description (e.g., "「日別」タブをクリック" -> "日別")
                    import re
                    text_match = re.search(r'[「『](.+?)[」』]', step)
                    if text_match:
                        extracted_text = text_match.group(1)
                        logger.info(f"Extracted text from step: {extracted_text}")
                        # Try with text= selector
                        fallback_command = {
                            "action": "click",
                            "selector": f"text={extracted_text}"
                        }
                        success = self._execute_command(fallback_command)
                        if success:
                            logger.info(f"Fallback succeeded with text={extracted_text}")

                if not success:
                    logger.error(f"Failed to execute step: {step}")
                    return False

                # Take screenshot for debugging
                self.browser.get_page_screenshot(
                    f"screenshots/step_{i}_{asp_name}.png"
                )

            logger.info(f"Successfully completed scraper for: {asp_name}")
            return True

        except Exception as e:
            logger.error(f"Error during scraping: {e}")
            return False

        finally:
            self.browser.stop()

    def run_all_asps(self) -> Dict[str, bool]:
        """Run scrapers for all ASPs that have scenarios defined.

        Returns:
            Dictionary mapping ASP names to success status
        """
        asps = self.supabase.get_all_asps()
        results = {}

        for asp in asps:
            asp_name = asp["name"]
            logger.info(f"\n{'='*60}")
            logger.info(f"Processing ASP: {asp_name}")
            logger.info(f"{'='*60}\n")

            success = self.run_asp_scraper(asp_name)
            results[asp_name] = success

            # Wait between ASPs to avoid rate limiting
            import time

            time.sleep(5)

        # Summary
        successful = sum(1 for success in results.values() if success)
        total = len(results)

        logger.info(f"\n{'='*60}")
        logger.info(f"Scraping Summary: {successful}/{total} successful")
        logger.info(f"{'='*60}\n")

        return results

    def _parse_scenario(self, scenario: str) -> List[str]:
        """Parse scenario text into individual steps.

        Args:
            scenario: Multi-line scenario text

        Returns:
            List of scenario steps
        """
        # Split by newlines and filter out empty lines
        lines = [line.strip() for line in scenario.split("\n") if line.strip()]

        # Remove numbered prefixes (e.g., "1. ", "2. ")
        steps = []
        for line in lines:
            # Match patterns like "1. ", "1) ", etc.
            match = re.match(r"^[\d]+[\.\)]\s*(.+)$", line)
            if match:
                steps.append(match.group(1))
            else:
                steps.append(line)

        return steps

    def _execute_command(self, command: Dict[str, Any]) -> bool:
        """Execute a command returned by Gemini.

        Args:
            command: Command dictionary from Gemini

        Returns:
            True if successful, False otherwise
        """
        action = command.get("action")

        if action == "error":
            logger.error(f"Command error: {command.get('message')}")
            return False

        if action == "navigate":
            url = command.get("value") or command.get("selector")
            self.browser.navigate(url)
            return True

        elif action == "click":
            selector = command.get("selector")
            if not self.browser.page:
                return False
            try:
                import re

                # Convert jQuery :contains() syntax to Playwright text= syntax
                contains_match = re.search(r':contains\([\'"](.+?)[\'"]\)', selector)
                if contains_match:
                    text_content = contains_match.group(1)
                    selector = f"text={text_content}"
                    logger.info(f"Converted jQuery selector to: {selector}")

                # If selector doesn't have CSS syntax and looks like plain text, add text= prefix
                # Check if it's likely plain text (no CSS selectors like #, ., [, :, etc.)
                elif not any(c in selector for c in ['#', '.', '[', '>', '=', ':', ' ']) and not selector.startswith('text='):
                    # Plain text selector - add text= prefix
                    selector = f"text={selector}"
                    logger.info(f"Added text= prefix: {selector}")

                # Use click() directly like TypeScript version
                try:
                    self.browser.page.click(selector, timeout=10000)
                    logger.info(f"Clicked {selector}")
                except Exception as e:
                    # If click failed due to visibility, retry with force=True
                    if "not visible" in str(e).lower() or "timeout" in str(e).lower():
                        logger.warning(f"Element not visible, retrying with force=True: {e}")
                        self.browser.page.click(selector, timeout=10000, force=True)
                        logger.info(f"Force clicked {selector}")
                    else:
                        raise
                # Wait for page to respond
                self.browser.page.wait_for_timeout(2000)
                return True
            except Exception as e:
                logger.error(f"Click failed: {e}")
                return False

        elif action == "fill":
            selector = command.get("selector")
            value = command.get("value", "")

            # Handle secret placeholders like {SECRET:A8NET_USERNAME}
            value = self._resolve_secrets(value)

            if not self.browser.page:
                return False
            try:
                # Use fill() directly like TypeScript version
                # This will fill the first matching element
                self.browser.page.fill(selector, value)
                logger.info(f"Filled {selector} with value")
                return True
            except Exception as e:
                logger.error(f"Fill failed: {e}")
                return False

        elif action == "wait":
            duration = int(command.get("value", 2000))
            if not self.browser.page:
                return False
            self.browser.page.wait_for_timeout(duration)
            return True

        elif action == "extract":
            selector = command.get("selector")
            instruction = command.get("instruction", "データを抽出")
            target_table = command.get("target", "daily_actuals")

            if not self.browser.page:
                return False

            try:
                # Get page content or specific element content
                if selector:
                    element = self.browser.page.locator(selector).first
                    content = element.inner_html()
                else:
                    content = self.browser.page.content()

                # Use Gemini to extract structured data
                extracted_data = self.gemini.extract_data_from_page(
                    content, instruction
                )

                if not extracted_data:
                    logger.warning("No data extracted")
                    return False

                # Parse extracted data and save to Supabase
                logger.info(f"Extracted data: {extracted_data}")

                # Add metadata from current ASP data
                if self.current_asp_data:
                    # TODO: Add media_id and account_item_id columns to asps table
                    # For now, use hardcoded values for testing
                    command["media_id"] = self.current_asp_data.get(
                        "media_id", "4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12"
                    )
                    command["account_item_id"] = self.current_asp_data.get(
                        "account_item_id", "a6df5fab-2df4-4263-a888-ab63348cccd5"
                    )
                    command["asp_id"] = self.current_asp_data.get("id")

                # Parse JSON and save to database
                if target_table in ["daily_actuals", "monthly_actuals"]:
                    success = self._save_extracted_data(
                        extracted_data, target_table, command
                    )
                    return success
                else:
                    logger.warning(f"Unknown target table: {target_table}")
                    return False

            except Exception as e:
                logger.error(f"Extract failed: {e}")
                return False

        else:
            logger.warning(f"Unknown action: {action}")
            return False

    def _resolve_secrets(self, value: str) -> str:
        """Resolve secret placeholders in values.

        Args:
            value: Value that may contain {SECRET:KEY_NAME} placeholders

        Returns:
            Value with secrets resolved
        """
        # For now, read from environment variables
        # In production, use Google Secret Manager
        import os

        pattern = r"\{SECRET:([A-Z0-9_]+)\}"
        matches = re.findall(pattern, value)

        for secret_key in matches:
            secret_value = os.getenv(secret_key, "")
            if secret_value:
                value = value.replace(f"{{SECRET:{secret_key}}}", secret_value)
            else:
                logger.warning(f"Secret not found: {secret_key}")

        return value

    def _save_extracted_data(
        self, extracted_data: str, table_name: str, command: Dict[str, Any]
    ) -> bool:
        """Save extracted data to Supabase.

        Args:
            extracted_data: JSON string of extracted data
            table_name: Target table name (daily_actuals or monthly_actuals)
            command: Command object containing metadata

        Returns:
            True if successful, False otherwise
        """
        import json

        try:
            # Parse JSON data
            data_obj = json.loads(extracted_data)

            # Extract array of records
            if "data" in data_obj:
                records = data_obj["data"]
            elif isinstance(data_obj, list):
                records = data_obj
            else:
                logger.error("Unexpected data format")
                return False

            # Get metadata from command
            media_id = command.get("media_id")
            account_item_id = command.get("account_item_id")
            asp_id = command.get("asp_id")

            if not all([media_id, account_item_id, asp_id]):
                logger.error(
                    "Missing required metadata: media_id, account_item_id, or asp_id"
                )
                return False

            # Save each record
            saved_count = 0
            for record in records:
                date = record.get("date")
                amount = record.get("amount")

                if not date or amount is None:
                    logger.warning(f"Skipping invalid record: {record}")
                    continue

                # Normalize date format (support Japanese date format)
                # e.g., "2025年11月01日" -> "2025-11-01"
                date_match = re.match(r'(\d{4})年(\d{1,2})月(\d{1,2})日', str(date))
                if date_match:
                    year = date_match.group(1)
                    month = date_match.group(2).zfill(2)
                    day = date_match.group(3).zfill(2)
                    date = f"{year}-{month}-{day}"
                    logger.info(f"Normalized Japanese date format: {date}")

                # Save to Supabase
                if table_name == "daily_actuals":
                    success = self.supabase.save_daily_actual(
                        date=date,
                        amount=int(float(amount)),  # Convert to integer
                        media_id=media_id,
                        account_item_id=account_item_id,
                        asp_id=asp_id,
                    )
                elif table_name == "monthly_actuals":
                    success = self.supabase.save_monthly_actual(
                        date=date,  # For monthly, date is end of month (YYYY-MM-DD)
                        amount=int(float(amount)),  # Convert to integer
                        media_id=media_id,
                        account_item_id=account_item_id,
                        asp_id=asp_id,
                    )
                else:
                    success = False

                if success:
                    saved_count += 1

            logger.info(f"Saved {saved_count}/{len(records)} records to {table_name}")
            return saved_count > 0

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse extracted data as JSON: {e}")
            return False
        except Exception as e:
            logger.error(f"Error saving extracted data: {e}")
            return False
