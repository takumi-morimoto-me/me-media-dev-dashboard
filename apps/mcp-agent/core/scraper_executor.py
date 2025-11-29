"""Scraper executor that runs generated Python scraper scripts."""

import logging
import subprocess
import sys
import json
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

from .database import SupabaseClient
from .scraper_generator import ScraperGenerator

logger = logging.getLogger(__name__)


class ExecutionResult:
    """Result of a scraper execution."""

    def __init__(self, success: bool, records_saved: int = 0, error: Optional[str] = None, output: str = ""):
        self.success = success
        self.records_saved = records_saved
        self.error = error
        self.output = output

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "records_saved": self.records_saved,
            "error": self.error,
            "output": self.output
        }


class ScraperExecutor:
    """Execute generated scraper scripts."""

    def __init__(
        self,
        supabase_client: SupabaseClient,
        generator: ScraperGenerator,
        scrapers_dir: Optional[Path] = None
    ):
        """Initialize scraper executor.

        Args:
            supabase_client: Supabase client for database operations
            generator: Scraper generator instance
            scrapers_dir: Path to scrapers directory
        """
        self.supabase = supabase_client
        self.generator = generator
        self.scrapers_dir = scrapers_dir or Path(__file__).parent.parent / "scrapers"
        logger.info("ScraperExecutor initialized")

    def execute_scraper(
        self,
        asp_name: str,
        execution_type: str = "daily",
        media_id: Optional[str] = None,
        auto_generate: bool = True
    ) -> ExecutionResult:
        """Execute a scraper for a specific ASP.

        Args:
            asp_name: Name of the ASP (e.g., 'a8net', 'afb')
            execution_type: Type of execution ('daily', 'monthly')
            media_id: Optional media ID to pass to scraper
            auto_generate: Automatically generate script if not found

        Returns:
            ExecutionResult object
        """
        logger.info(f"Executing scraper for {asp_name}/{execution_type}")

        # Get script path
        script_path = self._get_script_path(asp_name, execution_type)

        # Generate script if it doesn't exist
        if not script_path.exists():
            if not auto_generate:
                error_msg = f"Scraper script not found: {script_path}"
                logger.error(error_msg)
                return ExecutionResult(success=False, error=error_msg)

            logger.info(f"Script not found, generating...")
            generated_path = self.generator.generate_scraper(asp_name, execution_type)
            
            if not generated_path:
                error_msg = f"Failed to generate scraper for {asp_name}/{execution_type}"
                logger.error(error_msg)
                return ExecutionResult(success=False, error=error_msg)

            script_path = generated_path

        # Get ASP data for logging
        asp_data = self.supabase.get_asp_scenario(asp_name)
        asp_id = asp_data.get("id") if asp_data else None

        # Create execution log
        log_id = self.supabase.create_execution_log(
            asp_id=asp_id,
            execution_type=execution_type,
            metadata={"asp_name": asp_name, "script_path": str(script_path)}
        )

        # Run script
        try:
            result = self._run_script(script_path)
            
            # Update execution log
            if log_id:
                self.supabase.update_execution_log(
                    log_id=log_id,
                    status="success" if result.success else "failed",
                    records_saved=result.records_saved,
                    error_message=result.error
                )

            if result.success:
                logger.info(f"Successfully executed scraper: {asp_name}/{execution_type}, records: {result.records_saved}")
            else:
                logger.error(f"Scraper execution failed: {result.error}")

            return result

        except Exception as e:
            error_msg = f"Error executing scraper: {e}"
            logger.error(error_msg)
            
            # Update execution log with failure
            if log_id:
                self.supabase.update_execution_log(
                    log_id=log_id,
                    status="failed",
                    records_saved=0,
                    error_message=error_msg
                )

            return ExecutionResult(success=False, error=error_msg)

    def _run_script(self, script_path: Path) -> ExecutionResult:
        """Run a Python script as a subprocess.

        Args:
            script_path: Path to the script to run

        Returns:
            ExecutionResult object
        """
        logger.info(f"Running script: {script_path}")

        try:
            # Run script as subprocess
            result = subprocess.run(
                [sys.executable, str(script_path)],
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                cwd=script_path.parent
            )

            output = result.stdout
            error_output = result.stderr

            logger.info(f"Script output:\n{output}")
            if error_output:
                logger.warning(f"Script stderr:\n{error_output}")

            # Check return code
            if result.returncode != 0:
                error_msg = f"Script exited with code {result.returncode}\n{error_output}"
                return ExecutionResult(
                    success=False,
                    error=error_msg,
                    output=output
                )

            # Try to parse result from output
            # Look for JSON output in the last line
            records_saved = 0
            for line in output.split("\n"):
                if line.strip().startswith("{") and "records_saved" in line:
                    try:
                        result_data = json.loads(line.strip())
                        records_saved = result_data.get("records_saved", 0)
                        break
                    except json.JSONDecodeError:
                        pass

            return ExecutionResult(
                success=True,
                records_saved=records_saved,
                output=output
            )

        except subprocess.TimeoutExpired:
            error_msg = "Script execution timed out (5 minutes)"
            logger.error(error_msg)
            return ExecutionResult(success=False, error=error_msg)

        except Exception as e:
            error_msg = f"Failed to run script: {e}"
            logger.error(error_msg)
            return ExecutionResult(success=False, error=error_msg)

    def _get_script_path(self, asp_name: str, execution_type: str) -> Path:
        """Get path to scraper script.

        Args:
            asp_name: Name of the ASP
            execution_type: Type of execution

        Returns:
            Path to script
        """
        return self.scrapers_dir / asp_name / f"{execution_type}.py"

    def execute_all_scrapers(self, execution_type: str = "daily") -> Dict[str, ExecutionResult]:
        """Execute all available scrapers.

        Args:
            execution_type: Type of execution ('daily', 'monthly')

        Returns:
            Dictionary mapping ASP names to execution results
        """
        logger.info(f"Executing all scrapers with type: {execution_type}")
        
        results = {}
        
        # Get all ASP directories
        if not self.scrapers_dir.exists():
            logger.warning(f"Scrapers directory not found: {self.scrapers_dir}")
            return results

        for asp_dir in self.scrapers_dir.iterdir():
            if not asp_dir.is_dir():
                continue

            asp_name = asp_dir.name
            script_path = asp_dir / f"{execution_type}.py"

            if not script_path.exists():
                logger.info(f"No {execution_type} script for {asp_name}, skipping")
                continue

            logger.info(f"\n{'='*60}")
            logger.info(f"Processing ASP: {asp_name}")
            logger.info(f"{'='*60}\n")

            result = self.execute_scraper(asp_name, execution_type)
            results[asp_name] = result

            # Wait between executions to avoid rate limiting
            import time
            time.sleep(5)

        # Summary
        successful = sum(1 for r in results.values() if r.success)
        total = len(results)

        logger.info(f"\n{'='*60}")
        logger.info(f"Execution Summary: {successful}/{total} successful")
        logger.info(f"{'='*60}\n")

        return results
