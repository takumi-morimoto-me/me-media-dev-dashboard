"""Main entry point for MCP Agent."""

import logging
import sys
from config import Settings
from agent import SupabaseClient, BrowserController, GeminiClient, AgentLoop


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


def main():
    """Main function to run the agent."""
    logger.info("=" * 60)
    logger.info("MCP Agent - AI-Powered ASP Data Collection")
    logger.info("=" * 60)

    # Load settings
    try:
        settings = Settings.from_env()
        settings.validate()
        logger.info("Settings loaded and validated successfully")
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)

    # Initialize clients
    logger.info("Initializing clients...")

    supabase_client = SupabaseClient(
        url=settings.supabase_url,
        service_role_key=settings.supabase_service_role_key,
    )

    gemini_client = GeminiClient(
        api_key=settings.google_api_key,
        model_name=settings.gemini_model,
    )

    browser = BrowserController(headless=settings.headless)

    # Create agent loop
    agent = AgentLoop(
        supabase_client=supabase_client,
        browser=browser,
        gemini_client=gemini_client,
    )

    # Run scrapers for all ASPs
    logger.info("Starting autonomous scraping process...")

    try:
        results = agent.run_all_asps()

        # Print summary
        logger.info("\n" + "=" * 60)
        logger.info("FINAL RESULTS")
        logger.info("=" * 60)

        for asp_name, success in results.items():
            status = "✅ SUCCESS" if success else "❌ FAILED"
            logger.info(f"{asp_name}: {status}")

        successful = sum(1 for success in results.values() if success)
        total = len(results)

        logger.info("=" * 60)
        logger.info(f"Total: {successful}/{total} successful")
        logger.info("=" * 60)

        # Exit with appropriate code
        if successful < total:
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("\nScraping interrupted by user")
        sys.exit(0)

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
