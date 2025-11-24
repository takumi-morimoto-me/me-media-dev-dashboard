"""Create execution_logs table."""

import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

def main():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("❌ Missing credentials")
        return

    # Create Supabase client
    supabase = create_client(supabase_url, supabase_key)

    # Check if execution_logs table exists by trying to query it
    try:
        result = supabase.table("execution_logs").select("id").limit(1).execute()
        print("✅ execution_logs table already exists")
    except Exception as e:
        if "relation" in str(e).lower() and "does not exist" in str(e).lower():
            print("⚠️  execution_logs table doesn't exist")
            print("ℹ️  Note: You need to apply migration 021_create_execution_logs.sql via Supabase Dashboard")
            print("ℹ️  Go to: Supabase Dashboard > SQL Editor > Run the migration SQL")
        else:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
