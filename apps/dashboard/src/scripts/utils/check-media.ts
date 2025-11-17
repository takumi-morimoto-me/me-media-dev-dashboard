import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMedia() {
  console.log('🔍 メディア一覧を確認しています...\n');

  const { data: media, error } = await supabase
    .from('media')
    .select('id, name, slug')
    .order('name');

  if (error) {
    console.error('❌ メディアの取得に失敗しました:', error);
    return;
  }

  console.log(`📊 登録されているメディア: ${media?.length || 0}件\n`);

  media?.forEach(m => {
    console.log(`- ${m.name} (${m.slug})`);
    console.log(`  ID: ${m.id}`);
  });

  // ReReメディアの存在確認
  const rere = media?.find(m => m.name === 'ReRe');
  if (rere) {
    console.log('\n✅ ReRe メディアが見つかりました！');
  } else {
    console.log('\n❌ ReRe メディアが見つかりません。');
    console.log('💡 ReRe メディアを作成する必要があります。');
  }
}

checkMedia().catch(console.error);
