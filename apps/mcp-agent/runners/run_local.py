"""Local runner for MCP Agent."""

import logging
import sys
import argparse
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Settings
from core import SupabaseClient, BrowserController, ClaudeClient, AgentLoop, get_scenario_loader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Run MCP Agent locally")
    parser.add_argument("--asp", type=str, help="Name of the ASP to scrape (e.g., 'afb', 'a8net')")
    parser.add_argument("--media", type=str, help="Media ID or name (rere or saiyasu)")
    parser.add_argument("--type", type=str, choices=["daily", "monthly"], default="daily",
                        help="Execution type: daily or monthly (default: daily)")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode")
    parser.add_argument("--no-headless", action="store_false", dest="headless", help="Run in visible mode")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode with extra logging")
    parser.add_argument("--list", action="store_true", help="List available scenarios and exit")
    parser.add_argument("--no-yaml", action="store_true", help="Skip YAML scenarios, use DB only")
    parser.set_defaults(headless=False)  # Default to visible for local testing

    args = parser.parse_args()

    # List mode
    if args.list:
        loader = get_scenario_loader()
        scenarios = loader.list_scenarios()
        print("\n=== Available YAML Scenarios ===\n")
        for name in scenarios:
            scenario = loader.load_scenario(name)
            if scenario:
                display_name = scenario.get("display_name", name)
                has_daily = "daily" in scenario
                has_monthly = "monthly" in scenario
                types = []
                if has_daily:
                    types.append("daily")
                if has_monthly:
                    types.append("monthly")
                print(f"  {name}: {display_name} [{', '.join(types)}]")
        print()
        return

    # Resolve media name to ID
    media_id = None
    if args.media:
        if args.media.lower() in ["rere", "リリユウシュ"]:
            media_id = "4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12"  # ReRe
            logger.info("Using ReRe media")
        elif args.media.lower() in ["saiyasu", "最安修理", "saiyasusyuuri"]:
            media_id = "57d62304-0ccd-4255-a128-5250e1469171"  # 最安修理
            logger.info("Using 最安修理 media")
        elif args.media.lower() in ["beginners", "ビギナーズ"]:
            media_id = "4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12"  # ReRe (temporary - ビギナーズ uses same)
            logger.info("Using ReRe media for ビギナーズ")
        else:
            # Assume it's already a UUID
            media_id = args.media
            logger.info(f"Using media ID: {media_id}")

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

    claude_client = ClaudeClient(
        api_key=settings.anthropic_api_key,
    )

    browser = BrowserController(headless=settings.headless)

    # Create agent loop
    agent = AgentLoop(
        supabase_client=supabase_client,
        browser=browser,
        gemini_client=claude_client,  # Keep parameter name for compatibility
        debug_mode=args.debug,
    )

    try:
        if args.asp:
            logger.info(f"Running scraper for ASP: {args.asp} (type: {args.type})")
            success = agent.run_asp_scraper(
                args.asp,
                execution_type=args.type,
                media_id=media_id,
                use_yaml=not args.no_yaml,
            )
            status = "SUCCESS" if success else "FAILED"
            logger.info(f"Result: {status}")
        else:
            logger.info("Running scrapers for ALL ASPs")
            results = agent.run_all_asps(execution_type=args.type)
            for asp_name, success in results.items():
                status = "SUCCESS" if success else "FAILED"
                logger.info(f"{asp_name}: {status}")

    except KeyboardInterrupt:
        logger.info("\nScraping interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)

if __name__ == "__main__":
    main()
