"""Scheduled runner for automatic ASP data collection."""

import logging
import sys
import argparse
from datetime import datetime, timedelta
from config import Settings
from core import SupabaseClient, BrowserController, GeminiClient, AgentLoop, Notifier


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


def run_daily_fetch():
    """Run daily data fetch for all ASPs.

    This should be run every day at 9:00 AM JST.
    Fetches previous business day's data.
    """
    logger.info("=" * 60)
    logger.info("Daily ASP Data Fetch - Starting")
    logger.info("=" * 60)

    try:
        # Load settings
        settings = Settings.from_env()
        settings.validate()

        # Initialize clients
        supabase_client = SupabaseClient(
            url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
        )

        gemini_client = GeminiClient(
            api_key=settings.google_api_key,
            model_name=settings.gemini_model,
        )

        browser = BrowserController(headless=settings.headless)

        notifier = Notifier()

        # Create agent loop
        agent = AgentLoop(
            supabase_client=supabase_client,
            browser=browser,
            gemini_client=gemini_client,
            notifier=notifier,
        )

        # Run scrapers for all ASPs
        logger.info("Fetching daily data for all ASPs...")
        results = agent.run_all_asps(execution_type="daily")

        # Print summary
        successful = sum(1 for success in results.values() if success)
        total = len(results)

        logger.info("=" * 60)
        logger.info(f"Daily fetch completed: {successful}/{total} successful")
        logger.info("=" * 60)

        # Exit with error code if any failed
        if successful < total:
            sys.exit(1)

    except Exception as e:
        logger.error(f"Error during daily fetch: {e}", exc_info=True)
        sys.exit(1)


def run_monthly_fetch():
    """Run monthly data fetch for all ASPs.

    This should be run on the 1st day of each month at 10:00 AM JST.
    Fetches previous month's aggregated data.
    """
    logger.info("=" * 60)
    logger.info("Monthly ASP Data Fetch - Starting")
    logger.info("=" * 60)

    try:
        # Load settings
        settings = Settings.from_env()
        settings.validate()

        # Initialize clients
        supabase_client = SupabaseClient(
            url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
        )

        gemini_client = GeminiClient(
            api_key=settings.google_api_key,
            model_name=settings.gemini_model,
        )

        browser = BrowserController(headless=settings.headless)

        notifier = Notifier()

        # Create agent loop
        agent = AgentLoop(
            supabase_client=supabase_client,
            browser=browser,
            gemini_client=gemini_client,
            notifier=notifier,
        )

        # Run scrapers for all ASPs
        logger.info("Fetching monthly data for all ASPs...")
        results = agent.run_all_asps(execution_type="monthly")

        # Print summary
        successful = sum(1 for success in results.values() if success)
        total = len(results)

        logger.info("=" * 60)
        logger.info(f"Monthly fetch completed: {successful}/{total} successful")
        logger.info("=" * 60)

        # Exit with error code if any failed
        if successful < total:
            sys.exit(1)

    except Exception as e:
        logger.error(f"Error during monthly fetch: {e}", exc_info=True)
        sys.exit(1)


def main():
    """Main entry point for scheduled runner."""
    parser = argparse.ArgumentParser(description="Run scheduled ASP data fetch")
    parser.add_argument(
        "mode",
        choices=["daily", "monthly"],
        help="Execution mode: daily or monthly"
    )

    args = parser.parse_args()

    if args.mode == "daily":
        run_daily_fetch()
    elif args.mode == "monthly":
        run_monthly_fetch()
    else:
        logger.error(f"Unknown mode: {args.mode}")
        sys.exit(1)


if __name__ == "__main__":
    main()
