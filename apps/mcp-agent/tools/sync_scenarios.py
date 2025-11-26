#!/usr/bin/env python3
"""Sync YAML scenarios to Supabase database."""

import sys
import os
import argparse
import logging

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from core import SupabaseClient, ScenarioLoader

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Sync YAML scenarios to Supabase database"
    )
    parser.add_argument(
        "--asp",
        type=str,
        help="Specific ASP to sync (e.g., 'afb', 'a8net'). If not specified, syncs all.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all available scenarios without syncing",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be synced without actually syncing",
    )
    args = parser.parse_args()

    # Initialize loader
    loader = ScenarioLoader()

    # List mode
    if args.list:
        scenarios = loader.list_scenarios()
        print("\n=== Available Scenarios ===\n")
        for name in scenarios:
            scenario = loader.load_scenario(name)
            if scenario:
                display_name = scenario.get("display_name", name)
                db_name = scenario.get("asp_name_in_db", display_name)
                has_daily = "daily" in scenario
                has_monthly = "monthly" in scenario
                types = []
                if has_daily:
                    types.append("daily")
                if has_monthly:
                    types.append("monthly")
                print(f"  {name}")
                print(f"    Display: {display_name}")
                print(f"    DB Name: {db_name}")
                print(f"    Types:   {', '.join(types)}")
                print()
        return

    # Dry run mode
    if args.dry_run:
        print("\n=== Dry Run Mode ===\n")
        asp_names = [args.asp] if args.asp else loader.list_scenarios()
        for name in asp_names:
            scenario = loader.load_scenario(name)
            if scenario:
                db_name = scenario.get("asp_name_in_db", scenario.get("display_name", name))
                actions = loader.get_actions(name, "daily") or loader.get_actions(name, "monthly")
                if actions:
                    print(f"Would sync: {name} -> {db_name}")
                    print(f"  Actions: {len(actions)} steps")
        return

    # Sync mode
    print("\n=== Syncing Scenarios to Database ===\n")

    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    # Initialize Supabase client
    supabase_client = SupabaseClient(
        url=supabase_url, service_role_key=supabase_key
    )

    # Sync
    results = loader.sync_to_database(supabase_client, args.asp)

    # Print results
    print("\n=== Sync Results ===\n")
    success_count = 0
    for name, success in results.items():
        status = "OK" if success else "FAILED"
        print(f"  {name}: {status}")
        if success:
            success_count += 1

    print(f"\nSynced {success_count}/{len(results)} scenarios")


if __name__ == "__main__":
    main()
