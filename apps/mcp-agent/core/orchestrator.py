"""Main orchestrator for autonomous ASP data collection."""

import logging
import re
import time
from typing import Optional, List, Dict, Any
from .database import SupabaseClient
from .browser import BrowserController
from .ai_client import GeminiClient
from .notifier import Notifier
from .scenario_loader import get_scenario_loader

logger = logging.getLogger(__name__)

# Default retry configuration
DEFAULT_RETRY_CONFIG = {
    "max_attempts": 3,
    "delay_ms": 2000,
    "retry_on": ["timeout", "element_not_found"],
}


class AgentLoop:
    """Main agent loop that orchestrates the autonomous scraping process."""

    def __init__(
        self,
        supabase_client: SupabaseClient,
        browser: BrowserController,
        gemini_client: GeminiClient,
        notifier: Optional[Notifier] = None,
        debug_mode: bool = False,
    ):
        """Initialize agent loop.

        Args:
            supabase_client: Supabase client for database operations
            browser: Browser controller
            gemini_client: Gemini client for AI interpretation
            notifier: Optional notifier for sending alerts
            debug_mode: Enable debug mode with extra logging and screenshots
        """
        self.supabase = supabase_client
        self.browser = browser
        self.gemini = gemini_client
        self.notifier = notifier or Notifier()
        self.current_asp_data: Optional[Dict[str, Any]] = None
        self.current_media_id: Optional[str] = None
        self.debug_mode = debug_mode
        self.retry_config = DEFAULT_RETRY_CONFIG
        self.scenario_loader = get_scenario_loader()

    def run_asp_scraper(
        self,
        asp_name: str,
        execution_type: str = "daily",
        media_id: Optional[str] = None,
        use_yaml: bool = True,
    ) -> bool:
        """Run scraper for a specific ASP.

        Args:
            asp_name: Name of the ASP to scrape (e.g., 'afb', 'a8net', or DB name)
            execution_type: Type of execution ('daily', 'monthly')
            media_id: Media ID to use for this scraper run
            use_yaml: If True, load scenario from YAML file first

        Returns:
            True if successful, False otherwise
        """
        logger.info(f"Starting scraper for ASP: {asp_name} (type: {execution_type})")

        scenario = None
        asp_data = None

        # Try to load from YAML first
        if use_yaml:
            # Normalize ASP name for YAML lookup (e.g., "A8.net" -> "a8net")
            yaml_name = asp_name.lower().replace(".", "").replace(" ", "").replace("（", "").replace("）", "")
            actions = self.scenario_loader.get_actions(yaml_name, execution_type)

            if actions:
                import json
                scenario = json.dumps(actions, ensure_ascii=False)
                logger.info(f"Loaded {len(actions)} actions from YAML for {yaml_name}/{execution_type}")

                # Load retry config from YAML
                self.retry_config = self.scenario_loader.get_retry_config(yaml_name)
                logger.info(f"Using retry config: max_attempts={self.retry_config.get('max_attempts')}")

        # Fall back to database if YAML not found
        if not scenario:
            asp_data = self.supabase.get_asp_scenario(asp_name)
            if not asp_data:
                logger.error(f"No scenario found for ASP: {asp_name}")
                return False
            scenario = asp_data.get("prompt")

        if not scenario:
            logger.error(f"No prompt defined for ASP: {asp_name}")
            return False

        # Get ASP data from DB for metadata (even if scenario came from YAML)
        if not asp_data:
            # Try to get DB name from YAML scenario
            yaml_scenario = self.scenario_loader.load_scenario(yaml_name) if use_yaml else None
            db_asp_name = asp_name
            if yaml_scenario:
                db_asp_name = yaml_scenario.get("asp_name_in_db") or yaml_scenario.get("display_name", asp_name)
                logger.info(f"Using DB ASP name from YAML: {db_asp_name}")

            asp_data = self.supabase.get_asp_scenario(db_asp_name)
            if not asp_data:
                logger.warning(f"ASP not found in DB: {db_asp_name}, creating minimal metadata")
                # Create minimal asp_data for scenarios that don't exist in DB yet
                asp_data = {
                    "id": None,
                    "name": db_asp_name,
                    "account_item_id": "a6df5fab-2df4-4263-a888-ab63348cccd5",  # Default
                }

        # Store current ASP data and media_id for use in extract and secret resolution
        self.current_asp_data = asp_data
        self.current_media_id = media_id or "4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12"  # Default to ReRe media
        asp_id = asp_data.get("id")

        # Create execution log
        log_id = self.supabase.create_execution_log(
            asp_id=asp_id,
            execution_type=execution_type,
            metadata={"asp_name": asp_name}
        )

        # Parse scenario into steps
        steps = self._parse_scenario(scenario)
        logger.info(f"Parsed {len(steps)} steps from scenario")

        # Start browser
        self.browser.start()

        records_saved = 0
        try:
            # Execute each step
            for i, step in enumerate(steps, 1):
                # Check if step is already a command dict (JSON format)
                if isinstance(step, dict):
                    # Direct action from JSON scenario - skip AI interpretation
                    logger.info(f"Step {i}/{len(steps)}: {step.get('action')} - {step.get('selector', '')}")
                    command = step
                else:
                    # Natural language step - needs AI interpretation
                    logger.info(f"Step {i}/{len(steps)}: {step}")

                    # Get current page context
                    page_context = self.browser.get_page_content()

                    # Get page screenshot for vision
                    screenshot_base64 = self.browser.get_page_screenshot_base64()

                    # Ask Gemini to interpret the step
                    command = self.gemini.interpret_scenario_step(
                        step, page_context, screenshot_base64
                    )

                # Handle case where Gemini returns multiple commands
                if isinstance(command, list):
                    logger.info(f"Gemini returned {len(command)} commands for this step")
                    success = True
                    for i, cmd in enumerate(command):
                        logger.info(f"  Executing command {i+1}/{len(command)}: {cmd.get('action')}")
                        if not self._execute_command(cmd):
                            success = False
                            break
                        # Track records saved from extract commands
                        if cmd.get("action") == "extract":
                            records_saved = cmd.get("records_saved", 0)
                else:
                    # Execute single command
                    success = self._execute_command(command)

                    # Track records saved from extract commands
                    if success and command.get("action") == "extract":
                        records_saved = command.get("records_saved", 0)

                # If command failed and it was a click action, try fallback with text extraction
                # Only for natural language steps (string), not JSON steps (dict)
                if not success and not isinstance(command, list) and command.get("action") == "click" and isinstance(step, str):
                    logger.warning(f"Command failed, trying fallback with text extraction from step")
                    # Extract text from step description (e.g., "「日別」タブをクリック" -> "日別")
                    import re
                    text_match = re.search(r'[「『](.+?)[」』]', step)
                    fallback_texts = []

                    if text_match:
                        fallback_texts.append(text_match.group(1))

                    # Also try to extract keywords before "ボタン", "リンク", "タブ" etc.
                    keyword_match = re.search(r'([^\s]+)(?:ボタン|リンク|タブ|メニュー)', step)
                    if keyword_match:
                        keyword = keyword_match.group(1)
                        # Remove common prefixes/particles
                        keyword = keyword.replace('の', '').replace('を', '').replace('に', '').replace('が', '')
                        if keyword and keyword not in fallback_texts:
                            fallback_texts.append(keyword)

                    # Try each fallback text
                    for extracted_text in fallback_texts:
                        logger.info(f"Trying fallback with text: {extracted_text}")
                        fallback_command = {
                            "action": "click",
                            "selector": f"text={extracted_text}"
                        }
                        success = self._execute_command(fallback_command)
                        if success:
                            logger.info(f"Fallback succeeded with text={extracted_text}")
                            break

                if not success:
                    error_msg = f"Failed to execute step: {step}"
                    logger.error(error_msg)
                    # Update execution log with failure
                    if log_id:
                        self.supabase.update_execution_log(
                            log_id=log_id,
                            status="failed",
                            records_saved=records_saved,
                            error_message=error_msg
                        )
                    return False

                # Take screenshot for debugging
                self.browser.get_page_screenshot(
                    f"screenshots/step_{i}_{asp_name}.png"
                )

            # Update execution log with success
            if log_id:
                self.supabase.update_execution_log(
                    log_id=log_id,
                    status="success",
                    records_saved=records_saved
                )

            logger.info(f"Successfully completed scraper for: {asp_name}")
            return True

        except Exception as e:
            error_msg = f"Error during scraping: {e}"
            logger.error(error_msg)
            # Update execution log with failure
            if log_id:
                self.supabase.update_execution_log(
                    log_id=log_id,
                    status="failed",
                    records_saved=records_saved,
                    error_message=error_msg
                )
            return False

        finally:
            self.browser.stop()

    def run_all_asps(self, execution_type: str = "manual") -> Dict[str, bool]:
        """Run scrapers for all ASPs that have scenarios defined.

        Args:
            execution_type: Type of execution ('daily', 'monthly', 'manual')

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

            success = self.run_asp_scraper(asp_name, execution_type)
            results[asp_name] = success

            # Send error notification for failed ASPs
            if not success and self.notifier:
                self.notifier.send_error_notification(
                    asp_name=asp_name,
                    error_message=f"スクレイピングが失敗しました。ログを確認してください。",
                    execution_type=execution_type,
                )

            # Wait between ASPs to avoid rate limiting
            import time

            time.sleep(5)

        # Summary
        successful = sum(1 for success in results.values() if success)
        total = len(results)

        logger.info(f"\n{'='*60}")
        logger.info(f"Scraping Summary: {successful}/{total} successful")
        logger.info(f"{'='*60}\n")

        # Send summary notification
        if self.notifier:
            self.notifier.send_execution_summary(results, execution_type)

        return results

    def _parse_scenario(self, scenario: str) -> List:
        """Parse scenario text into individual steps.

        Args:
            scenario: Multi-line scenario text or JSON array

        Returns:
            List of scenario steps (strings for natural language, dicts for JSON)
        """
        import json

        # Check if scenario is JSON format
        scenario_stripped = scenario.strip()
        if scenario_stripped.startswith('['):
            try:
                # Parse as JSON array
                steps = json.loads(scenario_stripped)
                logger.info(f"Parsed scenario as JSON with {len(steps)} direct action steps")
                return steps
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse as JSON, falling back to text parsing: {e}")

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

    def _execute_command_with_retry(
        self, command: Dict[str, Any], step_desc: str = ""
    ) -> bool:
        """Execute a command with retry logic.

        Args:
            command: Command dictionary to execute
            step_desc: Description of the step for logging

        Returns:
            True if successful, False otherwise
        """
        max_attempts = self.retry_config.get("max_attempts", 3)
        delay_ms = self.retry_config.get("delay_ms", 2000)
        retry_on = self.retry_config.get("retry_on", ["timeout", "element_not_found"])

        for attempt in range(1, max_attempts + 1):
            try:
                success = self._execute_command(command)
                if success:
                    return True

                # Check if error is retryable
                error_type = command.get("last_error_type", "unknown")
                if error_type not in retry_on and attempt < max_attempts:
                    logger.warning(
                        f"Error type '{error_type}' not in retry list, failing immediately"
                    )
                    return False

            except Exception as e:
                error_str = str(e).lower()
                is_retryable = any(
                    err_type in error_str for err_type in retry_on
                )

                if not is_retryable:
                    logger.error(f"Non-retryable error: {e}")
                    return False

                logger.warning(f"Retryable error on attempt {attempt}: {e}")

            if attempt < max_attempts:
                logger.info(
                    f"Retrying {step_desc} (attempt {attempt + 1}/{max_attempts}) "
                    f"after {delay_ms}ms..."
                )
                time.sleep(delay_ms / 1000)

        logger.error(f"All {max_attempts} attempts failed for: {step_desc}")
        return False

    def _execute_command(self, command: Dict[str, Any]) -> bool:
        """Execute a command returned by Gemini.

        Args:
            command: Command dictionary from Gemini

        Returns:
            True if successful, False otherwise
        """
        import re  # Import at method level to avoid local variable conflict

        action = command.get("action")

        if action == "error":
            logger.error(f"Command error: {command.get('message')}")
            command["records_saved"] = 0
            return False

        if action == "navigate":
            url = command.get("value") or command.get("selector")
            self.browser.navigate(url)
            return True

        elif action == "click":
            selector = command.get("selector")
            no_wait_after = command.get("no_wait_after", False)
            click_timeout = command.get("timeout", 10000)
            if not self.browser.page:
                return False
            try:
                import re

                # Remove :first-of-type and similar pseudo-selectors that might select hidden elements
                if ":first-of-type" in selector or ":nth-of-type(1)" in selector:
                    selector = selector.replace(":first-of-type", "").replace(":nth-of-type(1)", "")
                    logger.info(f"Removed pseudo-selector, using: {selector}")

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
                click_opts = {"timeout": click_timeout}
                if no_wait_after:
                    click_opts["no_wait_after"] = True

                try:
                    # First try clicking with default behavior (visible element)
                    self.browser.page.locator(selector).first.click(**click_opts)
                    logger.info(f"Clicked {selector}")
                except Exception as e:
                    # If click failed due to visibility, try the last matching element (often the visible one)
                    if "not visible" in str(e).lower() or "timeout" in str(e).lower():
                        logger.warning(f"First element not visible, trying last element: {e}")
                        try:
                            self.browser.page.locator(selector).last.click(**click_opts)
                            logger.info(f"Clicked last {selector}")
                        except Exception as e2:
                            # Final fallback: force click the first element
                            logger.warning(f"Last element also failed, force clicking first: {e2}")
                            click_opts["force"] = True
                            self.browser.page.locator(selector).first.click(**click_opts)
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
                # Remove :first-of-type and similar pseudo-selectors that don't work in Playwright
                # Replace with .first locator method
                if ":first-of-type" in selector or ":nth-of-type(1)" in selector:
                    selector = selector.replace(":first-of-type", "").replace(":nth-of-type(1)", "")
                    logger.info(f"Removed pseudo-selector, using: {selector}")
                    # Use .first to get the first matching element
                    locator = self.browser.page.locator(selector).first
                    locator.fill(value)
                else:
                    # Use fill() directly like TypeScript version
                    # This will fill the first matching element
                    self.browser.page.fill(selector, value)

                logger.info(f"Filled {selector} with value")
                return True
            except Exception as e:
                logger.error(f"Fill failed: {e}")
                return False

        elif action == "wait":
            duration = int(command.get("milliseconds") or command.get("value", 2000))
            if not self.browser.page:
                return False
            self.browser.page.wait_for_timeout(duration)
            return True

        elif action == "keyboard":
            key = command.get("key", "Escape")
            if not self.browser.page:
                return False
            try:
                self.browser.page.keyboard.press(key)
                logger.info(f"Pressed keyboard key: {key}")
                return True
            except Exception as e:
                logger.error(f"Keyboard press failed: {e}")
                return False

        elif action == "screenshot":
            path = command.get("path", "/tmp/screenshot.png")
            if not self.browser.page:
                return False
            try:
                self.browser.page.screenshot(path=path, full_page=True)
                logger.info(f"Screenshot saved to: {path}")
                return True
            except Exception as e:
                logger.error(f"Screenshot failed: {e}")
                return False

        elif action == "hover":
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
                elif not any(c in selector for c in ['#', '.', '[', '>', '=', ':', ' ']) and not selector.startswith('text='):
                    selector = f"text={selector}"
                    logger.info(f"Added text= prefix: {selector}")

                # Try multiple selectors if comma-separated
                selectors = [s.strip() for s in selector.split(',')]
                for sel in selectors:
                    try:
                        self.browser.page.hover(sel, timeout=5000)
                        logger.info(f"Hovered over {sel}")
                        return True
                    except Exception as e:
                        logger.warning(f"Hover failed for {sel}: {e}")
                        continue

                # All selectors failed
                raise Exception(f"All hover selectors failed: {selectors}")
            except Exception as e:
                logger.error(f"Hover failed: {e}")
                return False

        elif action == "scroll":
            distance = int(command.get("value", 500))
            if not self.browser.page:
                return False
            try:
                # Scroll down by the specified distance
                self.browser.page.evaluate(f"window.scrollBy(0, {distance})")
                logger.info(f"Scrolled {distance}px")
                # Wait a bit for content to load
                self.browser.page.wait_for_timeout(1000)
                return True
            except Exception as e:
                logger.error(f"Scroll failed: {e}")
                return False

        elif action == "select":
            selector = command.get("selector")
            value = command.get("value", "")
            if not self.browser.page:
                return False
            try:
                self.browser.page.select_option(selector, value=value)
                logger.info(f"Selected '{value}' in {selector}")
                return True
            except Exception as e:
                logger.error(f"Select failed: {e}")
                return False

        elif action == "extract":
            selector = command.get("selector")
            target_table = command.get("target", "daily_actuals")
            extract_config = command.get("extract_config", {})
            amount_column_pattern = command.get("amount_column_pattern")  # e.g., "報酬合計"
            horizontal = command.get("horizontal", False)  # For horizontal tables like affitown

            if not self.browser.page:
                return False

            try:
                # Extract data directly using Playwright (NO AI APIs)
                logger.info(f"Extracting data from selector: {selector}")
                if amount_column_pattern:
                    logger.info(f"Using amount_column_pattern: {amount_column_pattern}")
                if horizontal:
                    logger.info("Using horizontal table extraction mode")

                # Get all tables matching the selector
                tables = self.browser.page.locator(selector).all()
                logger.info(f"Found {len(tables)} tables matching selector")

                extracted_records = []

                # Handle horizontal tables (like affitown)
                if horizontal:
                    for table_idx, table in enumerate(tables):
                        logger.info(f"Trying horizontal table {table_idx + 1}/{len(tables)}")
                        rows = table.locator("tr").all()
                        logger.info(f"  Table has {len(rows)} rows")

                        if len(rows) < 2:
                            continue

                        # Get all row data
                        row_data = []
                        for row in rows:
                            cells = row.locator("td, th").all()
                            cell_texts = [cell.inner_text().strip() for cell in cells]
                            row_data.append(cell_texts)
                            logger.info(f"  Row: {cell_texts[:5]}...")

                        # Find year row (contains "年")
                        year = None
                        month_row_idx = None
                        amount_row_idx = None

                        for i, row_texts in enumerate(row_data):
                            if row_texts and "年" in row_texts[0]:
                                year = re.search(r'(\d{4})年', row_texts[0])
                                year = year.group(1) if year else None
                                month_row_idx = i + 1 if i + 1 < len(row_data) else None
                                amount_row_idx = i + 2 if i + 2 < len(row_data) else None
                                break

                        if year and month_row_idx is not None and amount_row_idx is not None:
                            month_texts = row_data[month_row_idx]
                            amount_texts = row_data[amount_row_idx]

                            for col_idx in range(len(month_texts)):
                                month_text = month_texts[col_idx]
                                amount_text = amount_texts[col_idx] if col_idx < len(amount_texts) else ""

                                # Parse month (e.g., "01月", "11月(予定額)")
                                month_match = re.match(r'(\d{1,2})月', month_text)
                                if not month_match:
                                    continue

                                month = month_match.group(1).zfill(2)
                                period = f"{year}-{month}"

                                # Parse amount
                                amount_str = re.sub(r'[¥,円$\s]', '', amount_text)
                                try:
                                    amount = int(amount_str) if amount_str else 0
                                except:
                                    amount = 0

                                extracted_records.append({
                                    "period": period,
                                    "amount": amount
                                })
                                logger.info(f"  Extracted horizontal record: {period} -> {amount}")

                        if extracted_records:
                            break  # Found data in this table

                    if extracted_records:
                        logger.info(f"Successfully extracted {len(extracted_records)} horizontal records")

                # Try each table until we find one with valid data (vertical tables)
                if not horizontal:
                  for table_idx, table in enumerate(tables):
                    logger.info(f"Trying table {table_idx + 1}/{len(tables)}")

                    # Get all rows
                    rows = table.locator("tr").all()
                    logger.info(f"  Table has {len(rows)} rows")

                    # Debug: print first few rows of tables with more than 10 rows
                    if self.debug_mode and len(rows) > 10:
                        logger.info(f"  DEBUG: Printing first 3 rows of table {table_idx + 1}")
                        for debug_row_idx in range(min(3, len(rows))):
                            debug_cells = rows[debug_row_idx].locator("td, th").all()
                            debug_texts = [c.inner_text().strip()[:30] for c in debug_cells[:8]]
                            logger.info(f"    Row {debug_row_idx}: {debug_texts}")

                    table_records = []

                    # Find header row and column indices
                    header_row = None
                    date_col_idx = 0
                    amount_col_idx = None

                    # For daily data: find the rightmost column with the largest sum (likely total amount)
                    # For monthly data: use text matching

                    # If amount_column_pattern is specified, use it to find the column by header text
                    if amount_column_pattern:
                        logger.info(f"  Looking for column matching pattern: {amount_column_pattern}")
                        # Scan first few rows to find header
                        for i, row in enumerate(rows[:5]):
                            cells = row.locator("td, th").all()
                            if len(cells) < 2:
                                continue
                            cell_texts = [cell.inner_text().strip() for cell in cells]

                            for col_idx, text in enumerate(cell_texts):
                                normalized_text = text.replace(" ", "").replace("\n", "").replace("　", "")
                                if amount_column_pattern in normalized_text:
                                    header_row = i
                                    amount_col_idx = col_idx
                                    logger.info(f"  Found matching column at index {col_idx}: '{text}'")
                                    break
                            if amount_col_idx is not None:
                                break

                    if target_table == "daily_actuals" and amount_col_idx is None:
                        # Strategy: scan data rows and find the column with the largest values
                        logger.info("  Using heuristic approach for daily data: finding column with largest values")

                        # First, identify header row (contains date-like first cell)
                        weekday_pattern = r'^[日月火水木金土]$'
                        has_weekday_only = False

                        for i, row in enumerate(rows):
                            cells = row.locator("td, th").all()
                            if len(cells) < 2:
                                continue
                            cell_texts = [cell.inner_text().strip() for cell in cells]

                            # Check if first cell looks like a date (YYYY/MM/DD or YYYY年MM月DD日 format)
                            first_cell = cell_texts[0]
                            if re.match(r'\d{4}[/-]\d{1,2}[/-]\d{1,2}', first_cell) or re.match(r'\d{4}年\d{1,2}月\d{1,2}日', first_cell):
                                header_row = i - 1
                                logger.info(f"  Found data row at index {i}, header should be at {header_row}")
                                break
                            # Check if first cell is weekday-only (e.g., 日, 月, 火)
                            elif re.match(weekday_pattern, first_cell):
                                has_weekday_only = True
                                # For afb daily tables, check if column 1 has actual dates
                                if len(cell_texts) > 1:
                                    second_cell = cell_texts[1]
                                    if re.match(r'\d{1,2}[/-]\d{1,2}', second_cell) or re.match(r'\d{4}[/-]\d{1,2}[/-]\d{1,2}', second_cell):
                                        date_col_idx = 1
                                        header_row = i - 1
                                        logger.info(f"  Found weekday pattern in col 0, using col 1 for dates. Header at {header_row}")
                                        break

                        if header_row is None or header_row < 0:
                            header_row = 1  # Default assumption
                            logger.info(f"  Using default header_row: {header_row}")

                        # Scan a few data rows to find which column has the largest numeric values
                        column_sums = {}
                        sample_rows = min(5, len(rows) - header_row - 1)

                        for row_idx in range(header_row + 1, header_row + 1 + sample_rows):
                            if row_idx >= len(rows):
                                break

                            row = rows[row_idx]
                            cells = row.locator("td, th").all()
                            cell_texts = [cell.inner_text().strip() for cell in cells]

                            # Try to parse each column as a number
                            for col_idx in range(1, len(cell_texts)):  # Skip column 0 (date)
                                try:
                                    # Remove common separators and currency symbols
                                    value_str = re.sub(r'[¥,円$]', '', cell_texts[col_idx])
                                    value = int(value_str)

                                    if col_idx not in column_sums:
                                        column_sums[col_idx] = 0
                                    column_sums[col_idx] += value
                                except:
                                    pass

                        # Find the column with the largest sum
                        if column_sums:
                            amount_col_idx = max(column_sums, key=column_sums.get)
                            logger.info(f"  Detected amount column at index {amount_col_idx} (largest sum: {column_sums[amount_col_idx]})")
                            logger.info(f"  All column sums: {column_sums}")
                        else:
                            logger.warning("  Could not detect amount column by value analysis")
                            amount_col_idx = None

                    elif amount_col_idx is None:
                        # For monthly data, use text matching as before
                        for i, row in enumerate(rows):
                            cells = row.locator("td, th").all()
                            if len(cells) < 2:
                                continue

                            cell_texts = [cell.inner_text().strip() for cell in cells]

                            # Check if this is a header row
                            found_header = False
                            for col_idx, text in enumerate(cell_texts):
                                # Normalize text (remove spaces and newlines)
                                normalized_text = text.replace(" ", "").replace("\n", "").replace("　", "")

                                # For monthly data, look for various amount column patterns
                                # Priority 1: A8.net pattern "確定報酬額・税込"
                                if "税込" in text and "確定報酬額" in text:
                                    header_row = i
                                    amount_col_idx = col_idx
                                    logger.info(f"  Found amount column at index {amount_col_idx}: {text}")
                                    found_header = True
                                    break
                                # Priority 2: afb pattern "発生報酬" or "発生 報酬"
                                elif "発生報酬" in normalized_text:
                                    header_row = i
                                    amount_col_idx = col_idx
                                    logger.info(f"  Found amount column (afb pattern) at index {amount_col_idx}: {text}")
                                    found_header = True
                                    break

                            if found_header:
                                break

                            # Fallback: if no specific column found, look for any amount-related column
                            if header_row is None:
                                for col_idx, text in enumerate(cell_texts):
                                    normalized_text = text.replace(" ", "").replace("\n", "").replace("　", "")

                                    # Check various patterns (including 金額 for CircuitX, 報酬合計 for Felmat)
                                    if any(pattern in normalized_text for pattern in ["確定報酬額", "税込", "発生報酬", "承認報酬", "金額", "報酬合計"]):
                                        header_row = i
                                        amount_col_idx = col_idx
                                        logger.info(f"  Found fallback amount column at index {amount_col_idx}: {text}")
                                        found_header = True
                                        break

                            if found_header:
                                break

                    if amount_col_idx is None:
                        logger.warning("  Could not find amount column in table")
                        continue

                    # Process data rows
                    for i, row in enumerate(rows):
                        if i <= header_row:
                            # Skip header rows
                            continue

                        try:
                            # Get all cells (th or td)
                            cells = row.locator("td, th").all()

                            if len(cells) < 2:
                                continue

                            # Extract text from cells
                            cell_texts = [cell.inner_text().strip() for cell in cells]

                            if len(cell_texts) <= amount_col_idx:
                                # Not enough columns
                                continue

                            # Parse date and amount based on target table
                            if target_table == "daily_actuals":
                                # Daily data: first column is date
                                date_str = cell_texts[date_col_idx]
                                amount_str = cell_texts[amount_col_idx]

                                # Parse date (format: YYYY/MM/DD or YYYY-MM-DD)
                                parsed_date = self._parse_date(date_str)
                                if not parsed_date:
                                    continue

                                # Parse amount
                                amount = self._parse_amount(amount_str)

                                record = {
                                    "date": parsed_date,
                                    "amount": amount
                                }

                            elif target_table in ["monthly_actuals", "actuals"]:
                                # Monthly data: first column is year-month
                                # Support both "monthly_actuals" and "actuals" for backward compatibility
                                period_str = cell_texts[date_col_idx]
                                amount_str = cell_texts[amount_col_idx]

                                # Parse period (format: YYYY/MM or YYYY-MM)
                                parsed_period = self._parse_period(period_str)
                                if not parsed_period:
                                    continue

                                # Parse amount
                                amount = self._parse_amount(amount_str)

                                record = {
                                    "period": parsed_period,
                                    "amount": amount
                                }
                            else:
                                logger.warning(f"Unknown target table: {target_table}")
                                continue

                            table_records.append(record)
                            logger.info(f"  Extracted record from table {table_idx + 1}, row {i+1}: {record}")

                        except Exception as row_error:
                            logger.warning(f"  Failed to parse row {i}: {row_error}")
                            continue

                    # If this table has valid records, use it
                    if table_records:
                        logger.info(f"Table {table_idx + 1} has {len(table_records)} valid records")
                        extracted_records = table_records
                        break
                    else:
                        logger.info(f"Table {table_idx + 1} has no valid records, trying next table")

                if not extracted_records:
                    logger.warning("No records extracted from any table")
                    return False

                logger.info(f"Successfully extracted {len(extracted_records)} records")

                # Add metadata from current ASP data
                if self.current_asp_data:
                    command["media_id"] = self.current_media_id
                    command["account_item_id"] = self.current_asp_data.get(
                        "account_item_id", "a6df5fab-2df4-4263-a888-ab63348cccd5"
                    )
                    command["asp_id"] = self.current_asp_data.get("id")

                # Map monthly_actuals to actuals table
                actual_table = "actuals" if target_table == "monthly_actuals" else target_table

                # Save extracted data
                # Support "actuals", "monthly_actuals", and "daily_actuals"
                if target_table in ["daily_actuals", "monthly_actuals", "actuals"]:
                    # Convert to JSON string format expected by _save_extracted_data
                    import json
                    extracted_data = json.dumps(extracted_records, ensure_ascii=False)

                    saved_count = self._save_extracted_data(
                        extracted_data, actual_table, command
                    )
                    command["records_saved"] = saved_count
                    return saved_count > 0
                else:
                    logger.warning(f"Unknown target table: {target_table}")
                    command["records_saved"] = 0
                    return False

            except Exception as e:
                logger.error(f"Extract failed: {e}")
                import traceback
                logger.error(traceback.format_exc())
                command["records_saved"] = 0
                return False

        elif action == "download":
            selector = command.get("selector")
            download_path = command.get("path", "/tmp/download.csv")
            if not self.browser.page:
                return False
            try:
                # Set up download handler
                with self.browser.page.expect_download() as download_info:
                    # Click the download button
                    self.browser.page.locator(selector).first.click()

                download = download_info.value
                # Save to the specified path
                download.save_as(download_path)
                logger.info(f"Downloaded file to: {download_path}")
                return True
            except Exception as e:
                logger.error(f"Download failed: {e}")
                return False

        elif action == "extract_csv":
            csv_path = command.get("path", "/tmp/download.csv")
            target_table = command.get("target", "daily_actuals")
            date_column = command.get("date_column", "日付")
            amount_column = command.get("amount_column", "確定報酬金額(税抜)")

            try:
                import csv

                # Try different encodings
                encodings = ['utf-8', 'shift_jis', 'cp932', 'utf-8-sig']
                rows = None

                for encoding in encodings:
                    try:
                        with open(csv_path, 'r', encoding=encoding) as f:
                            reader = csv.DictReader(f)
                            rows = list(reader)
                            logger.info(f"Successfully read CSV with encoding: {encoding}")
                            break
                    except UnicodeDecodeError:
                        continue

                if not rows:
                    logger.error(f"Could not read CSV file with any encoding: {csv_path}")
                    return False

                logger.info(f"CSV has {len(rows)} rows, columns: {rows[0].keys() if rows else 'none'}")

                # Determine if this is monthly data (use period parser) or daily data (use date parser)
                is_monthly = target_table == "actuals"

                extracted_records = []
                for row in rows:
                    # Get date/period
                    date_str = row.get(date_column, "")
                    if not date_str:
                        # Try to find a column containing the date pattern
                        for key, val in row.items():
                            if re.match(r'\d{4}[/-]\d{1,2}[/-]\d{1,2}', str(val)):
                                date_str = val
                                break
                            # Also check for Japanese year-month format
                            if re.match(r'\d{4}年\d{1,2}月', str(val)):
                                date_str = val
                                break

                    # Use period parser for monthly, date parser for daily
                    if is_monthly:
                        parsed_period = self._parse_period(date_str)
                        if not parsed_period:
                            continue
                        # Convert YYYY-MM to YYYY-MM-01 for DB storage
                        parsed_date = f"{parsed_period}-01"
                    else:
                        parsed_date = self._parse_date(date_str)
                        if not parsed_date:
                            continue

                    # Get amount - try exact match first, then partial match
                    amount_str = row.get(amount_column, "")
                    if not amount_str:
                        # Try partial match on column name
                        for key, val in row.items():
                            if amount_column in key:
                                amount_str = val
                                break
                    if not amount_str:
                        # Try to find amount column by pattern
                        for key, val in row.items():
                            if "報酬" in key or "金額" in key:
                                amount_str = val
                                break

                    amount = self._parse_amount(str(amount_str))

                    extracted_records.append({
                        "date": parsed_date,
                        "amount": amount
                    })
                    logger.info(f"Extracted CSV record: {parsed_date} -> {amount}")

                if not extracted_records:
                    logger.warning("No records extracted from CSV")
                    return False

                logger.info(f"Successfully extracted {len(extracted_records)} records from CSV")

                # Add metadata
                if self.current_asp_data:
                    command["media_id"] = self.current_media_id
                    command["account_item_id"] = self.current_asp_data.get(
                        "account_item_id", "a6df5fab-2df4-4263-a888-ab63348cccd5"
                    )
                    command["asp_id"] = self.current_asp_data.get("id")

                # Save extracted data
                import json
                extracted_data = json.dumps(extracted_records, ensure_ascii=False)
                saved_count = self._save_extracted_data(extracted_data, target_table, command)
                command["records_saved"] = saved_count
                return saved_count > 0

            except Exception as e:
                logger.error(f"Extract CSV failed: {e}")
                import traceback
                logger.error(traceback.format_exc())
                command["records_saved"] = 0
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
        import os

        pattern = r"\{SECRET:([A-Z0-9_]+)\}"
        matches = re.findall(pattern, value)

        for secret_key in matches:
            secret_value = None

            # Check if this is a credential that needs media-specific lookup
            if secret_key.endswith("_USERNAME") or secret_key.endswith("_PASSWORD"):
                # Query asp_credentials table for media-specific credentials
                if self.current_media_id and self.current_asp_data:
                    asp_id = self.current_asp_data.get("id")

                    try:
                        # Get credentials for this media-ASP combination
                        result = self.supabase.client.table("asp_credentials").select("*").eq(
                            "media_id", self.current_media_id
                        ).eq("asp_id", asp_id).execute()

                        if result.data and len(result.data) > 0:
                            creds = result.data[0]

                            # Get the actual credential value directly from the table
                            if secret_key.endswith("_USERNAME"):
                                secret_value = creds.get("username_secret_key")
                                logger.info(f"Resolved {secret_key} from asp_credentials for media {self.current_media_id}")
                            elif secret_key.endswith("_PASSWORD"):
                                secret_value = creds.get("password_secret_key")
                                logger.info(f"Resolved {secret_key} from asp_credentials for media {self.current_media_id}")
                        else:
                            logger.warning(f"No credentials found for media {self.current_media_id} and ASP {asp_id}")
                    except Exception as e:
                        logger.error(f"Error querying asp_credentials: {e}")

            # Fall back to environment variable if not found in asp_credentials
            if not secret_value:
                secret_value = os.getenv(secret_key, "")
                if secret_value:
                    logger.info(f"Resolved {secret_key} from environment variable")

            if secret_value:
                value = value.replace(f"{{SECRET:{secret_key}}}", secret_value)
            else:
                logger.warning(f"Secret not found for: {secret_key}")

        return value

    def _parse_date(self, date_str: str) -> str:
        """Parse date string to YYYY-MM-DD format.

        Args:
            date_str: Date string (e.g., "2025/11/25", "2025-11-25", "11/25", "2025/11/25(月)", "2025年11月25日")

        Returns:
            Date in YYYY-MM-DD format, or None if parsing fails
        """
        import re
        from datetime import datetime

        # Remove whitespace
        date_str = date_str.strip()

        # Remove weekday suffix like (月), (火), (日) etc.
        date_str = re.sub(r'\s*\([日月火水木金土曜]\)\s*', '', date_str)

        # Try Japanese format first: YYYY年MM月DD日
        jp_match = re.match(r'(\d{4})年(\d{1,2})月(\d{1,2})日', date_str)
        if jp_match:
            year = jp_match.group(1)
            month = jp_match.group(2).zfill(2)
            day = jp_match.group(3).zfill(2)
            return f"{year}-{month}-{day}"

        # Try various date formats
        formats = [
            "%Y/%m/%d",
            "%Y-%m-%d",
            "%m/%d",  # Will use current year
            "%m-%d",  # Will use current year
        ]

        for fmt in formats:
            try:
                if "%Y" not in fmt:
                    # Add current year
                    current_year = datetime.now().year
                    date_str_with_year = f"{current_year}/{date_str}"
                    parsed = datetime.strptime(date_str_with_year, f"%Y/{fmt}")
                else:
                    parsed = datetime.strptime(date_str, fmt)
                return parsed.strftime("%Y-%m-%d")
            except ValueError:
                continue

        logger.warning(f"Failed to parse date: {date_str}")
        return None

    def _parse_period(self, period_str: str) -> str:
        """Parse period string to YYYY-MM format.

        Args:
            period_str: Period string (e.g., "2025/11", "2025-11", "202511", "2025年11月")

        Returns:
            Period in YYYY-MM format, or None if parsing fails
        """
        import re

        # Remove whitespace
        period_str = period_str.strip()

        # Try pattern: YYYY年MM月 (Japanese format)
        match = re.match(r"(\d{4})年(\d{1,2})月", period_str)
        if match:
            year = match.group(1)
            month = match.group(2).zfill(2)
            return f"{year}-{month}"

        # Try pattern: YYYY/MM or YYYY-MM
        match = re.match(r"(\d{4})[/-](\d{1,2})", period_str)
        if match:
            year = match.group(1)
            month = match.group(2).zfill(2)
            return f"{year}-{month}"

        # Try pattern: YYYYMM
        match = re.match(r"(\d{4})(\d{2})", period_str)
        if match:
            year = match.group(1)
            month = match.group(2)
            return f"{year}-{month}"

        logger.warning(f"Failed to parse period: {period_str}")
        return None

    def _parse_amount(self, amount_str: str) -> int:
        """Parse amount string to integer.

        Args:
            amount_str: Amount string (e.g., "1,234", "¥1,234", "1234円")

        Returns:
            Amount as integer (0 if parsing fails)
        """
        import re

        # Remove whitespace, currency symbols, and separators
        amount_str = amount_str.strip()
        amount_str = re.sub(r"[¥,円$]", "", amount_str)

        try:
            # Handle decimal numbers (e.g., 444553.0)
            return int(float(amount_str))
        except ValueError:
            logger.warning(f"Failed to parse amount: {amount_str}")
            return 0

    def _save_extracted_data(
        self, extracted_data: str, table_name: str, command: Dict[str, Any]
    ) -> int:
        """Save extracted data to Supabase.

        Args:
            extracted_data: JSON string of extracted data
            table_name: Target table name (daily_actuals or monthly_actuals)
            command: Command object containing metadata

        Returns:
            Number of records successfully saved
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
            elif isinstance(data_obj, dict) and "date" in data_obj and "amount" in data_obj:
                # Single record (typically for monthly data)
                records = [data_obj]
            else:
                logger.error(f"Unexpected data format: {data_obj}")
                return 0

            # Get metadata from command
            media_id = command.get("media_id")
            account_item_id = command.get("account_item_id")
            asp_id = command.get("asp_id")

            if not all([media_id, account_item_id, asp_id]):
                logger.error(
                    "Missing required metadata: media_id, account_item_id, or asp_id"
                )
                return 0

            # Save each record
            saved_count = 0
            for record in records:
                # Handle both daily (date) and monthly (period) records
                date_value = record.get("date")
                period_value = record.get("period")
                amount = record.get("amount")

                # Check if we have either date or period
                if not (date_value or period_value) or amount is None:
                    logger.warning(f"Skipping invalid record: {record}")
                    continue

                # If monthly record (period field), convert to end-of-month date
                if period_value and not date_value:
                    # period is in YYYY-MM format, convert to last day of month
                    from datetime import datetime
                    try:
                        year, month = period_value.split("-")
                        # Get last day of month
                        if int(month) == 12:
                            next_month = datetime(int(year) + 1, 1, 1)
                        else:
                            next_month = datetime(int(year), int(month) + 1, 1)
                        from datetime import timedelta
                        last_day = next_month - timedelta(days=1)
                        date_value = last_day.strftime("%Y-%m-%d")
                        logger.info(f"Converted period {period_value} to date {date_value}")
                    except Exception as e:
                        logger.warning(f"Failed to convert period {period_value}: {e}")
                        continue

                # Normalize date format (support Japanese date format)
                # e.g., "2025年11月01日" -> "2025-11-01"
                date_match = re.match(r'(\d{4})年(\d{1,2})月(\d{1,2})日', str(date_value))
                if date_match:
                    year = date_match.group(1)
                    month = date_match.group(2).zfill(2)
                    day = date_match.group(3).zfill(2)
                    date_value = f"{year}-{month}-{day}"
                    logger.info(f"Normalized Japanese date format: {date_value}")

                # Save to Supabase
                if table_name == "daily_actuals":
                    success = self.supabase.save_daily_actual(
                        date=date_value,
                        amount=int(float(amount)),  # Convert to integer
                        media_id=media_id,
                        account_item_id=account_item_id,
                        asp_id=asp_id,
                    )
                elif table_name == "actuals":
                    # Monthly data goes to actuals table
                    success = self.supabase.save_actual(
                        date=date_value,  # For monthly, date is end of month (YYYY-MM-DD)
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
            return saved_count

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse extracted data as JSON: {e}")
            return 0
        except Exception as e:
            logger.error(f"Error saving extracted data: {e}")
            return 0
