import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  const aspId = '7902bd90-face-4d0e-8575-33d57cf9a89f';

  const { data, error } = await supabase
    .from('asp_credentials')
    .select('*')
    .eq('asp_id', aspId);

  if (error) {
    console.error('認証情報検索エラー:', error);
  } else if (!data || data.length === 0) {
    console.log('認証情報が見つかりません。asp_credentialsテーブルにAmazonアソシエイトの認証情報を追加してください。');
    console.log('ASP ID:', aspId);
  } else {
    console.log('認証情報が見つかりました（件数:', data.length, '件）');
  }
}

check();
