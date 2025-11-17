import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkLinkAGAsp() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('\n📋 ASPsテーブルからLink-AGを検索中...\n');

  const { data, error } = await supabase
    .from('asps')
    .select('*')
    .ilike('name', '%link%ag%');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('✅ Link-AG ASPが見つかりました:');
    data.forEach(asp => {
      console.log(`  ID: ${asp.id}`);
      console.log(`  Name: ${asp.name}`);
      console.log(`  Category: ${asp.category}`);
      console.log('');
    });
  } else {
    console.log('⚠️  Link-AG ASPが見つかりませんでした。');
    console.log('\n新しくASPを登録しますか？（y/n）');
    console.log('\nSupabaseダッシュボードで以下のSQLを実行してください:');
    console.log(`
INSERT INTO public.asps (name, category)
VALUES ('Link-A', 'ASP')
RETURNING id;
    `);
  }

  // すべてのASPを表示
  const { data: allAsps } = await supabase
    .from('asps')
    .select('*')
    .order('name');

  if (allAsps && allAsps.length > 0) {
    console.log('\n📋 すべてのASP:');
    allAsps.forEach(asp => {
      console.log(`  - ${asp.name} (${asp.id})`);
    });
  }
}

checkLinkAGAsp().catch(console.error);
