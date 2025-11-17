import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function renameMediaToReRe() {
  console.log('📝 メディア名を変更中...\n');

  // 現在の名前を確認
  const { data: currentMedia, error: selectError } = await supabase
    .from('media')
    .select('*')
    .or('name.eq.ビギナーズ,name.eq.ReRe');

  if (selectError) {
    console.error('❌ メディア情報の取得に失敗:', selectError);
    return;
  }

  console.log('現在のメディア情報:');
  currentMedia?.forEach(m => {
    console.log(`  - ID: ${m.id}, 名前: ${m.name}`);
  });

  // ビギナーズをReReに変更
  const beginners = currentMedia?.find(m => m.name === 'ビギナーズ');
  if (beginners) {
    const { error: updateError } = await supabase
      .from('media')
      .update({ name: 'ReRe' })
      .eq('id', beginners.id);

    if (updateError) {
      console.error('\n❌ メディア名の変更に失敗:', updateError);
      return;
    }

    console.log(`\n✅ メディア名を変更しました: "ビギナーズ" → "ReRe" (ID: ${beginners.id})`);
  } else {
    console.log('\n⚠️ "ビギナーズ" という名前のメディアが見つかりませんでした');

    const rere = currentMedia?.find(m => m.name === 'ReRe');
    if (rere) {
      console.log(`✅ "ReRe" はすでに存在します (ID: ${rere.id})`);
    }
  }
}

renameMediaToReRe();
