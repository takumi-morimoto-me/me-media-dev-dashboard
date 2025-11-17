import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔄 マイグレーション 015 を適用中...\n');

  // Read migration file
  const migrationPath = join(process.cwd(), '../../packages/db/migrations/015_fix_asp_monthly_data_include_daily.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('📄 SQL:', migrationSQL.substring(0, 200) + '...\n');

  // Execute migration
  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

  if (error) {
    console.error('❌ マイグレーションエラー:', error);

    // Try direct SQL execution
    console.log('\n⚙️ 直接SQL実行を試みます...\n');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      if (statement) {
        console.log('実行中:', statement.substring(0, 100) + '...');
        const { error: execError } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        if (execError) {
          console.error('❌ エラー:', execError.message);
        } else {
          console.log('✅ 成功');
        }
      }
    }
  } else {
    console.log('✅ マイグレーション適用完了！');
  }

  // Test the function
  console.log('\n🧪 関数をテスト中...\n');

  const { data: testData, error: testError } = await supabase
    .rpc('get_asp_monthly_data', {
      p_media_id: '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12',
      p_fiscal_year: 2025
    });

  if (testError) {
    console.error('❌ テストエラー:', testError);
  } else {
    console.log('✅ 関数テスト成功！');
    console.log(`\n📊 取得データ数: ${testData?.length || 0}件\n`);

    // Show A8.net data
    const a8Data = testData?.filter((d: any) => d.asp_name === 'A8.net');
    if (a8Data && a8Data.length > 0) {
      console.log('A8.netのデータ:');
      a8Data.forEach((d: any) => {
        console.log(`  ${d.item_year}/${d.item_month}: ¥${d.actual?.toLocaleString()}`);
      });
    }
  }
}

main();
