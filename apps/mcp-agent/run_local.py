"""Local runner for MCP Agent."""

import logging
import sys
import argparse
from config import Settings
from core import SupabaseClient, BrowserController, GeminiClient, AgentLoop

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Run MCP Agent locally")
    parser.add_argument("--asp", type=str, help="Name of the ASP to scrape (optional)")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode")
    parser.add_argument("--no-headless", action="store_false", dest="headless", help="Run in visible mode")
    parser.set_defaults(headless=False)  # Default to visible for local testing
    
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("MCP Agent - Local Runner")
    logger.info("=" * 60)

    # Load settings
    try:
        settings = Settings.from_env()
        # Override headless setting
        settings.headless = args.headless
        logger.info(f"Settings loaded. Headless: {settings.headless}")
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

    try:
        if args.asp:
            logger.info(f"Running scraper for single ASP: {args.asp}")
            success = agent.run_asp_scraper(args.asp)
            status = "✅ SUCCESS" if success else "❌ FAILED"
            logger.info(f"Result: {status}")
        else:
            logger.info("Running scrapers for ALL ASPs")
            results = agent.run_all_asps()
            for asp_name, success in results.items():
                status = "✅ SUCCESS" if success else "❌ FAILED"
                logger.info(f"{asp_name}: {status}")

    except KeyboardInterrupt:
        logger.info("\nScraping interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
    finally:
        browser.stop()

if __name__ == "__main__":
    main()
