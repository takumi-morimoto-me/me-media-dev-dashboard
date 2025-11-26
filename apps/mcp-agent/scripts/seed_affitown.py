"""
affitownをSupabaseに登録するスクリプト
"""

import os
from supabase import create_client

# Supabase設定
url = os.getenv('SUPABASE_URL', 'https://pkjrepxggkbybkjifiqt.supabase.co')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranJlcHhnZ2tieWJramlmaXF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTcyNzA3NiwiZXhwIjoyMDc1MzAzMDc2fQ.HpV3ZJxATuesWehBG9Y9dSi4XRIeWXe05vCHXktY-1Y')
client = create_client(url, key)

def seed_affitown():
    """affitownをaspsテーブルとasp_credentialsテーブルに登録"""

    print('=' * 60)
    print('affitown 登録スクリプト')
    print('=' * 60 + '\n')

    # affitownが既に存在するかチェック
    asp_response = client.table('asps').select('id,name').eq('name', 'アフィタウン').execute()

    if asp_response.data:
        asp_id = asp_response.data[0]['id']
        print(f'✅ アフィタウンは既に登録されています: {asp_id}')
    else:
        # 新規登録
        asp_data = {
            'name': 'アフィタウン',
            'prompt': None,  # YAMLから読み込む
        }

        result = client.table('asps').insert(asp_data).execute()
        asp_id = result.data[0]['id']
        print(f'➕ アフィタウンを登録しました: {asp_id}')

    # メディア一覧を取得
    media_response = client.table('media').select('id,name').execute()
    medias = {m['name']: m['id'] for m in media_response.data}

    print(f'\n📋 登録されているメディア: {len(medias)}件')
    for name in medias.keys():
        print(f'  - {name}')

    # 各メディアに認証情報を登録
    # affitownの認証情報（共通）
    affitown_username = 'AFFITOWN_USERNAME'
    affitown_password = 'AFFITOWN_PASSWORD'

    for media_name, media_id in medias.items():
        cred_data = {
            'media_id': media_id,
            'asp_id': asp_id,
            'username_secret_key': affitown_username,
            'password_secret_key': affitown_password
        }

        # 既存のレコードをチェック
        existing = client.table('asp_credentials').select('*').eq(
            'media_id', media_id
        ).eq(
            'asp_id', asp_id
        ).execute()

        if existing.data:
            # 更新
            result = client.table('asp_credentials').update(cred_data).eq(
                'id', existing.data[0]['id']
            ).execute()
            print(f'🔄 更新: {media_name}')
        else:
            # 新規登録
            result = client.table('asp_credentials').insert(cred_data).execute()
            print(f'➕ 登録: {media_name}')

    print('\n✅ affitownの登録が完了しました！')

if __name__ == '__main__':
    seed_affitown()
