import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔄 認証情報を更新中...\n');

  const { data: media } = await supabase
    .from('media')
    .select('id')
    .eq('name', 'ReRe')
    .single();

  if (!media) {
    console.error('❌ ReReメディアが見つかりません');
    return;
  }

  // Update i-mobile credentials
  const { data: imobile } = await supabase
    .from('asps')
    .select('id')
    .eq('name', 'i-mobile')
    .single();

  if (imobile) {
    const { data: existing } = await supabase
      .from('asp_credentials')
      .select('id, username_secret_key')
      .eq('asp_id', imobile.id)
      .eq('media_id', media.id)
      .single();

    if (existing && !existing.username_secret_key) {
      console.log('i-mobile: 認証情報を更新中...');
      const { error } = await supabase
        .from('asp_credentials')
        .update({
          username_secret_key: 'beginners@marketenterprise.co.jp',
          password_secret_key: 's7Vh5k4Bc2pm'
        })
        .eq('id', existing.id);

      if (error) {
        console.error('❌ i-mobile更新エラー:', error.message);
      } else {
        console.log('✅ i-mobile: 更新完了');
      }
    }
  }

  console.log('\n📊 更新完了');
  console.log('\n⚠️  以下のASPは認証情報がありません（リストに記載なし）:');
  console.log('  - バリューコマース');
  console.log('  - JANet');
  console.log('  - レントラックス');
}

main();
