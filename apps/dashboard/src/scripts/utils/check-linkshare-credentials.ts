import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: asps, error } = await supabase
    .from('asps')
    .select('id, name');

  console.log('全ASPs:');
  asps?.forEach(asp => {
    console.log(`  - ${asp.name} (ID: ${asp.id})`);
  });

  // リンクシェアを探す（完全一致優先）
  const linkshare = asps?.find(asp => asp.name === 'リンクシェア');

  if (linkshare) {
    console.log(`\n見つかったASP: ${linkshare.name}`);
    console.log(`ASP ID: ${linkshare.id}`);

    const { data: creds, error: credError } = await supabase
      .from('asp_credentials')
      .select('*')
      .eq('asp_id', linkshare.id);

    if (creds && creds.length > 0) {
      console.log('\n認証情報が存在します:');
      console.log('  データ:', JSON.stringify(creds[0], null, 2));
    } else {
      console.log('\n⚠️ 認証情報が登録されていません');
      console.log('asp_credentialsテーブルに以下のデータを登録してください:');
      console.log(`  asp_id: ${linkshare.id}`);
      console.log('  username: (リンクシェアのログインID)');
      console.log('  password: (リンクシェアのパスワード)');
    }
  } else {
    console.log('\n⚠️ リンクシェアのASPが見つかりません');
    console.log('aspsテーブルに登録してください');
  }
}

check();
