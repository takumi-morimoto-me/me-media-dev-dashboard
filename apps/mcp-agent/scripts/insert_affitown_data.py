"""
affitownの月次データをasp_monthly_actualsに登録するスクリプト
"""

import os
import calendar
from supabase import create_client

# Supabase設定
url = os.getenv('SUPABASE_URL', 'https://pkjrepxggkbybkjifiqt.supabase.co')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranJlcHhnZ2tieWJramlmaXF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTcyNzA3NiwiZXhwIjoyMDc1MzAzMDc2fQ.HpV3ZJxATuesWehBG9Y9dSi4XRIeWXe05vCHXktY-1Y')
client = create_client(url, key)

def insert_affitown_data():
    """affitownの月次データを登録"""

    print('=' * 60)
    print('affitown 月次データ登録')
    print('=' * 60 + '\n')

    # affitownのASP IDを取得
    asp_response = client.table('asps').select('id,name').eq('name', 'アフィタウン').execute()

    if not asp_response.data:
        print('❌ アフィタウンがデータベースに見つかりません')
        return

    asp_id = asp_response.data[0]['id']
    print(f'✅ アフィタウン ASP ID: {asp_id}\n')

    # メディアID（ReReを使用）
    media_response = client.table('media').select('id,name').eq('name', 'ReRe').execute()
    if not media_response.data:
        print('❌ ReReが見つかりません')
        return

    media_id = media_response.data[0]['id']
    print(f'✅ ReRe Media ID: {media_id}\n')

    # ReReメディアのアフィリエイトaccount_item_idを取得
    account_item_response = client.table('account_items').select('id').eq('media_id', media_id).eq('name', 'アフィリエイト').execute()
    if not account_item_response.data:
        print('❌ アフィリエイトのaccount_itemが見つかりません')
        return

    account_item_id = account_item_response.data[0]['id']
    print(f'✅ アフィリエイト Account Item ID: {account_item_id}\n')

    # 2025年の月次データ（スクリーンショットから取得）
    data_2025 = {
        1: 0,
        2: 44400,
        3: 131000,
        4: 213000,
        5: 564000,
        6: 328000,
        7: 315644,
        8: 247960,
        9: 216968,
        10: 172900,
        11: 69664,
        12: 0,
    }

    # 2024年の月次データ
    data_2024 = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        7: 0,
        8: 0,
        9: 0,
        10: 0,
        11: 2400,
        12: 19000,
    }

    # データを登録 (actualsテーブルは date, asp_id, media_id, amount を使用)
    records = []

    for month, actual in data_2025.items():
        if actual > 0:  # 0円のデータは登録しない
            # 月の末日を日付として使用（他のデータと合わせる）
            last_day = calendar.monthrange(2025, month)[1]
            date = f'2025-{month:02d}-{last_day:02d}'
            records.append({
                'media_id': media_id,
                'asp_id': asp_id,
                'account_item_id': account_item_id,
                'date': date,
                'amount': actual,
            })

    for month, actual in data_2024.items():
        if actual > 0:  # 0円のデータは登録しない
            last_day = calendar.monthrange(2024, month)[1]
            date = f'2024-{month:02d}-{last_day:02d}'
            records.append({
                'media_id': media_id,
                'asp_id': asp_id,
                'account_item_id': account_item_id,
                'date': date,
                'amount': actual,
            })

    print(f'📋 登録するレコード数: {len(records)}件\n')

    # 既存データを削除
    delete_result = client.table('actuals').delete().eq(
        'asp_id', asp_id
    ).eq(
        'media_id', media_id
    ).execute()
    print(f'🗑️ 既存データを削除しました')

    # 新規登録
    result = client.table('actuals').insert(records).execute()
    print(f'✅ {len(result.data)}件のデータを登録しました')

    print('\n📋 登録内容（2025年）:')
    for month, actual in data_2025.items():
        print(f'  {month}月: {actual:,}円')

if __name__ == '__main__':
    insert_affitown_data()
