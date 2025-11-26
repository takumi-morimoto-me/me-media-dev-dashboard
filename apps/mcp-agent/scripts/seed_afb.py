"""
afbの認証情報をSupabaseに登録するスクリプト
"""

import os
from supabase import create_client

# Supabase設定
url = os.getenv('SUPABASE_URL', 'https://pkjrepxggkbybkjifiqt.supabase.co')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranJlcHhnZ2tieWJramlmaXF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTcyNzA3NiwiZXhwIjoyMDc1MzAzMDc2fQ.HpV3ZJxATuesWehBG9Y9dSi4XRIeWXe05vCHXktY-1Y')
client = create_client(url, key)

def seed_afb_credentials():
    """afbの認証情報をasp_credentialsテーブルに登録"""

    print('=' * 60)
    print('afb 認証情報登録スクリプト')
    print('=' * 60 + '\n')

    # afbのASP IDを取得
    asp_response = client.table('asps').select('id,name').eq('name', 'afb（ビギナーズ・OJ）').execute()

    if not asp_response.data:
        print('❌ afb（ビギナーズ・OJ）がデータベースに見つかりません')
        return

    asp_id = asp_response.data[0]['id']
    print(f'✅ afb ASP ID: {asp_id}\n')

    # メディア一覧を取得
    media_response = client.table('media').select('id,name').execute()
    medias = {m['name']: m['id'] for m in media_response.data}

    print(f'📋 登録されているメディア: {len(medias)}件\n')

    # ReReのメディアIDを取得
    rere_media_id = medias.get('ReRe')

    if not rere_media_id:
        print('❌ ReReが見つかりません')
        print('利用可能なメディア:')
        for name in medias.keys():
            print(f'  - {name}')
        return

    print(f'✅ ReRe ID: {rere_media_id}\n')

    # 認証情報を登録/更新
    cred_data = {
        'media_id': rere_media_id,
        'asp_id': asp_id,
        'username_secret_key': 'AFB_RERE_USERNAME',
        'password_secret_key': 'AFB_RERE_PASSWORD'
    }

    # 既存のレコードをチェック
    existing = client.table('asp_credentials').select('*').eq(
        'media_id', cred_data['media_id']
    ).eq(
        'asp_id', cred_data['asp_id']
    ).execute()

    if existing.data:
        # 更新
        result = client.table('asp_credentials').update(cred_data).eq(
            'id', existing.data[0]['id']
        ).execute()
        print(f'🔄 更新: AFB認証情報')
        print(f'  - username_secret_key: {cred_data["username_secret_key"]}')
        print(f'  - password_secret_key: {cred_data["password_secret_key"]}')
    else:
        # 新規登録
        result = client.table('asp_credentials').insert(cred_data).execute()
        print(f'➕ 登録: AFB認証情報')
        print(f'  - username_secret_key: {cred_data["username_secret_key"]}')
        print(f'  - password_secret_key: {cred_data["password_secret_key"]}')

    print('\n✅ afbの認証情報登録が完了しました！\n')
    print('📋 登録内容:')
    print(f'  - メディア: ReRe')
    print(f'  - ASP: afb（ビギナーズ・OJ）')
    print(f'  - username_secret_key: {cred_data["username_secret_key"]}')
    print(f'  - password_secret_key: {cred_data["password_secret_key"]}')

if __name__ == '__main__':
    seed_afb_credentials()
