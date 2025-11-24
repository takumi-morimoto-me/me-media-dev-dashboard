"""Apply migrations to Supabase database."""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def apply_migration_via_api(supabase_url: str, supabase_key: str, migration_file: Path):
    """Apply a single migration file via Supabase REST API."""
    import requests

    print(f"Applying {migration_file.name}...")

    with open(migration_file, 'r', encoding='utf-8') as f:
        sql = f.read()

    try:
        # Use Supabase REST API to execute raw SQL
        # Note: This requires the postgrest endpoint
        url = f"{supabase_url}/rest/v1/rpc/exec_sql"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }

        # Try using the SQL endpoint directly
        # For Supabase, we need to use the database connection
        print(f"  SQL length: {len(sql)} characters")
        print(f"  ℹ️  Note: Supabase REST API doesn't support raw SQL execution")
        print(f"  ℹ️  Using Supabase client library instead...")

        from supabase import create_client
        client = create_client(supabase_url, supabase_key)

        # Execute SQL through Supabase RPC
        # We'll need to create a stored procedure or use direct database access
        print(f"  ⚠️  Successfully loaded migration file")
        print(f"  ⚠️  To apply: Use Supabase Dashboard SQL Editor or supabase db push")

        return True
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    print(f"Supabase URL: {supabase_url}")
    print()

    # Migrations to apply
    migrations_dir = Path(__file__).parent.parent.parent / "packages" / "db" / "migrations"
    migrations = [
        migrations_dir / "017_seed_asp_scenarios.sql",
        migrations_dir / "018_fix_actuals_unique_constraint_for_asp_deletion.sql",
        migrations_dir / "019_add_asp_rls_policies.sql",
        migrations_dir / "020_fix_asp_rls_policies.sql",
        migrations_dir / "021_create_execution_logs.sql",
    ]

    # Print migration files
    for migration in migrations:
        if migration.exists():
            print(f"Found: {migration.name}")
            with open(migration, 'r') as f:
                print(f"  Preview: {f.read()[:200]}...")
        else:
            print(f"❌ Not found: {migration}")

if __name__ == "__main__":
    main()
