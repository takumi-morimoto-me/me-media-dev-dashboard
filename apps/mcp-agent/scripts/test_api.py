"""Link-AGとfelmatをGemini API経由でテストするスクリプト"""

import os
import logging
from dotenv import load_dotenv
from agent.supabase_client import SupabaseClient
from agent.browser import BrowserController
from agent.gemini_client import GeminiClient
from agent.agent_loop import AgentLoop

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Load environment
load_dotenv()

# Initialize clients
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
gemini_api_key = os.getenv("GOOGLE_API_KEY")

if not all([supabase_url, supabase_key, gemini_api_key]):
    print("❌ 環境変数が不足しています")
    print(f"SUPABASE_URL: {'✓' if supabase_url else '✗'}")
    print(f"SUPABASE_SERVICE_ROLE_KEY: {'✓' if supabase_key else '✗'}")
    print(f"GOOGLE_API_KEY: {'✓' if gemini_api_key else '✗'}")
    exit(1)

# Create clients
supabase_client = SupabaseClient(supabase_url, supabase_key)
browser = BrowserController()
gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
gemini_client = GeminiClient(gemini_api_key, gemini_model)

# Create agent loop
agent_loop = AgentLoop(supabase_client, browser, gemini_client)

# Test ASPs (更新したシナリオをテスト)
asp_names = ["Link-AG", "felmat"]

print("\\n" + "="*60)
print("Link-AGとfelmatをGemini API経由でテスト")
print("="*60 + "\\n")

results = {}
for asp_name in asp_names:
    print(f"\\n{'='*60}")
    print(f"処理中: {asp_name}")
    print(f"{'='*60}\\n")

    success = agent_loop.run_asp_scraper(asp_name)
    results[asp_name] = success

    # Wait between ASPs
    import time
    time.sleep(5)

# Summary
print(f"\\n{'='*60}")
print("テスト結果サマリー")
print(f"{'='*60}\\n")

for asp_name, success in results.items():
    status = "✅ 成功" if success else "❌ 失敗"
    print(f"{asp_name}: {status}")

successful = sum(1 for success in results.values() if success)
total = len(results)

print(f"\\n成功: {successful}/{total}")
print(f"{'='*60}\\n")
