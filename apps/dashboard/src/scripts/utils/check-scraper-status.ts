import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScraperStatus() {
  // メディアIDを取得
  const { data: media } = await supabase
    .from('media')
    .select('id')
    .eq('name', 'ReRe')
    .single();

  if (!media) {
    console.error('メディアが見つかりません');
    return;
  }

  // 各ASPのデータ取得状況を確認
  const { data: asps } = await supabase
    .from('asps')
    .select('id, name')
    .order('name');

  if (!asps) {
    console.error('ASPが見つかりません');
    return;
  }

  console.log('\n📊 ASPデータ取得状況\n');
  console.log('=' .repeat(80));

  const working = [];
  const noData = [];

  for (const asp of asps) {
    const { data: actuals, count } = await supabase
      .from('daily_actuals')
      .select('*', { count: 'exact', head: true })
      .eq('media_id', media.id)
      .eq('asp_id', asp.id);

    if (count && count > 0) {
      working.push({ name: asp.name, count });
    } else {
      noData.push(asp.name);
    }
  }

  console.log('\n✅ データ取得成功 (' + working.length + '件):');
  working
    .sort((a, b) => b.count - a.count)
    .forEach(asp => {
      console.log(`  - ${asp.name.padEnd(30)} (${asp.count}件)`);
    });

  console.log('\n❌ データ未取得 (' + noData.length + '件):');
  noData.forEach(name => {
    console.log(`  - ${name}`);
  });

  console.log('\n' + '='.repeat(80) + '\n');
}

checkScraperStatus();
