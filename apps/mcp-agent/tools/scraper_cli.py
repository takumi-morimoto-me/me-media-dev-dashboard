#!/usr/bin/env python3
"""CLI tool for managing scrapers (generate, execute, heal)."""

import argparse
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.scraper_generator import ScraperGenerator
from core.scraper_executor import ScraperExecutor
from core.scraper_healer import ScraperHealer
from core.database import SupabaseClient
from config import Settings

# Load settings
settings = Settings.from_env()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def generate_command(args):
    """Generate scraper script from YAML."""
    logger.info(f"Generating scraper: {args.asp}/{args.type}")
    
    generator = ScraperGenerator(api_key=settings.google_api_key)
    script_path = generator.generate_scraper(
        asp_name=args.asp,
        execution_type=args.type,
        force=args.force
    )
    
    if script_path:
        print(f"✅ Successfully generated: {script_path}")
        return 0
    else:
        print(f"❌ Failed to generate scraper")
        return 1


def execute_command(args):
    """Execute a scraper script."""
    logger.info(f"Executing scraper: {args.asp}/{args.type}")
    
    # Initialize components
    supabase = SupabaseClient(settings.supabase_url, settings.supabase_service_role_key)
    generator = ScraperGenerator(api_key=settings.google_api_key)
    executor = ScraperExecutor(supabase, generator)
    
    # Execute scraper
    result = executor.execute_scraper(
        asp_name=args.asp,
        execution_type=args.type,
        auto_generate=not args.no_generate
    )
    
    if result.success:
        print(f"✅ Successfully executed: {args.asp}/{args.type}")
        print(f"   Records saved: {result.records_saved}")
        return 0
    else:
        print(f"❌ Execution failed: {result.error}")
        return 1


def execute_all_command(args):
    """Execute all scrapers."""
    logger.info(f"Executing all scrapers: type={args.type}")
    
    # Initialize components
    supabase = SupabaseClient(settings.supabase_url, settings.supabase_service_role_key)
    generator = ScraperGenerator(api_key=settings.google_api_key)
    executor = ScraperExecutor(supabase, generator)
    
    # Execute all scrapers
    results = executor.execute_all_scrapers(execution_type=args.type)
    
    # Print summary
    successful = sum(1 for r in results.values() if r.success)
    total = len(results)
    
    print(f"\n{'='*60}")
    print(f"Execution Summary: {successful}/{total} successful")
    print(f"{'='*60}")
    
    for asp_name, result in results.items():
        status = "✅" if result.success else "❌"
        print(f"{status} {asp_name}: {result.records_saved} records")
        if result.error:
            print(f"   Error: {result.error}")
    
    return 0 if successful == total else 1


def heal_command(args):
    """Heal a broken scraper."""
    logger.info(f"Healing scraper: {args.asp}/{args.type}")
    
    healer = ScraperHealer(api_key=settings.google_api_key)
    success = healer.heal_scraper(
        asp_name=args.asp,
        execution_type=args.type,
        error_message=args.error,
        script_output=""
    )
    
    if success:
        print(f"✅ Successfully healed: {args.asp}/{args.type}")
        return 0
    else:
        print(f"❌ Failed to heal scraper")
        return 1


def list_command(args):
    """List all available scrapers."""
    scrapers_dir = Path(__file__).parent.parent / "scrapers"
    
    if not scrapers_dir.exists():
        print("No scrapers directory found")
        return 1
    
    print("\nAvailable Scrapers:")
    print("="*60)
    
    for asp_dir in sorted(scrapers_dir.iterdir()):
        if not asp_dir.is_dir():
            continue
        
        asp_name = asp_dir.name
        scripts = []
        
        if (asp_dir / "daily.py").exists():
            scripts.append("daily")
        if (asp_dir / "monthly.py").exists():
            scripts.append("monthly")
        
        if scripts:
            print(f"📁 {asp_name}: {', '.join(scripts)}")
    
    print("="*60)
    return 0


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description="Scraper management CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Generate command
    generate_parser = subparsers.add_parser("generate", help="Generate scraper from YAML")
    generate_parser.add_argument("asp", help="ASP name (e.g., a8net, afb)")
    generate_parser.add_argument("--type", default="daily", choices=["daily", "monthly"], help="Execution type")
    generate_parser.add_argument("--force", action="store_true", help="Force regeneration")
    generate_parser.set_defaults(func=generate_command)
    
    # Execute command
    execute_parser = subparsers.add_parser("execute", help="Execute a scraper")
    execute_parser.add_argument("asp", help="ASP name (e.g., a8net, afb)")
    execute_parser.add_argument("--type", default="daily", choices=["daily", "monthly"], help="Execution type")
    execute_parser.add_argument("--no-generate", action="store_true", help="Don't auto-generate if missing")
    execute_parser.set_defaults(func=execute_command)
    
    # Execute all command
    execute_all_parser = subparsers.add_parser("execute-all", help="Execute all scrapers")
    execute_all_parser.add_argument("--type", default="daily", choices=["daily", "monthly"], help="Execution type")
    execute_all_parser.set_defaults(func=execute_all_command)
    
    # Heal command
    heal_parser = subparsers.add_parser("heal", help="Heal a broken scraper")
    heal_parser.add_argument("asp", help="ASP name")
    heal_parser.add_argument("--type", default="daily", choices=["daily", "monthly"], help="Execution type")
    heal_parser.add_argument("--error", required=True, help="Error message")
    heal_parser.set_defaults(func=heal_command)
    
    # List command
    list_parser = subparsers.add_parser("list", help="List all available scrapers")
    list_parser.set_defaults(func=list_command)
    
    # Parse arguments
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Execute command
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
