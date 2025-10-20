import dotenv from 'dotenv';

// .env.localファイルを読み込む
dotenv.config({ path: '.env.local' });

async function checkData() {
  // クライアントの作成（サーバー側の実装を使用）
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 データベースの情報を確認中...\n');

  // 1. メディア一覧
  const { data: media, error: mediaError } = await supabase
    .from('media')
    .select('id, name, slug')
    .order('name');

  if (mediaError) {
    console.error('❌ メディア取得エラー:', mediaError);
  } else {
    console.log('📱 メディア一覧:');
    media?.forEach(m => {
      console.log(`  - ${m.name} (slug: ${m.slug}, id: ${m.id})`);
    });
  }

  // 2. 勘定科目一覧
  const { data: accountItems, error: accountItemsError } = await supabase
    .from('account_items')
    .select('*')
    .order('name');

  if (accountItemsError) {
    console.error('\n❌ 勘定科目取得エラー:', accountItemsError);
  } else {
    console.log('\n💰 勘定科目一覧:');
    accountItems?.forEach(item => {
      console.log(`  - ${item.name} (id: ${item.id})`);
    });
  }

  // 3. ASP一覧
  const { data: asps, error: aspsError } = await supabase
    .from('asps')
    .select('id, name, login_url')
    .order('name');

  if (aspsError) {
    console.error('\n❌ ASP取得エラー:', aspsError);
  } else {
    console.log('\n🔗 ASP一覧:');
    if (asps && asps.length > 0) {
      asps.forEach(asp => {
        console.log(`  - ${asp.name} (url: ${asp.login_url}, id: ${asp.id})`);
      });
    } else {
      console.log('  （登録なし）');
    }
  }

  // 4. ReReメディアのID確認
  const rereMedia = media?.find(m => m.slug === 'rere' || m.name.toLowerCase().includes('rere'));
  if (rereMedia) {
    console.log('\n✅ ReReメディアID:', rereMedia.id);
  } else {
    console.log('\n⚠️  ReReメディアが見つかりません');
  }

  // 5. A8.netのASP確認
  const a8Asp = asps?.find(asp => asp.name.toLowerCase().includes('a8'));
  if (a8Asp) {
    console.log('✅ A8.net ASP ID:', a8Asp.id);
  } else {
    console.log('⚠️  A8.netのASPが見つかりません（登録が必要です）');
  }
}

checkData().catch(console.error);
