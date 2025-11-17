#!/usr/bin/env python3
"""a8appのデータ取得状況を確認"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# .env.localを読み込み
load_dotenv('.env.local')

# Supabase接続
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

# A8appのASP IDを取得
asp = supabase.table('asps').select('id, name').eq('name', 'A8app').single().execute()
asp_id = asp.data['id']

print(f"📊 A8app データ確認")
print(f"ASP ID: {asp_id}")
print("=" * 60)

# daily_actuals テーブルから取得
daily_result = supabase.table('daily_actuals')\
    .select('date, amount')\
    .eq('asp_id', asp_id)\
    .order('date')\
    .execute()

print(f"\n📅 日次データ (daily_actuals)")
print(f"件数: {len(daily_result.data)}件")

if daily_result.data:
    # 月ごとに集計
    monthly_summary = {}
    for record in daily_result.data:
        month = record['date'][:7]  # YYYY-MM
        if month not in monthly_summary:
            monthly_summary[month] = {'count': 0, 'total': 0}
        monthly_summary[month]['count'] += 1
        monthly_summary[month]['total'] += record['amount']

    print("\n月別サマリー:")
    for month in sorted(monthly_summary.keys()):
        info = monthly_summary[month]
        print(f"  {month}: {info['count']}件, 合計¥{info['total']:,}")

# actuals テーブルから取得
actuals_result = supabase.table('actuals')\
    .select('date, amount')\
    .eq('asp_id', asp_id)\
    .order('date')\
    .execute()

print(f"\n📆 月次データ (actuals)")
print(f"件数: {len(actuals_result.data)}件")

if actuals_result.data:
    for record in actuals_result.data:
        print(f"  {record['date']}: ¥{record['amount']:,}")

print("\n" + "=" * 60)
print(f"✅ データ確認完了")
