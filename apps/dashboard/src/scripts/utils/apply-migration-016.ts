import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Try to get direct database URL
const databaseUrl = process.env.DATABASE_URL;

async function main() {
  console.log('🔄 マイグレーション 016 を適用中...\n');
  console.log('目的: get_asp_monthly_dataの重複を修正（actualsテーブルのみを使用）\n');

  // Read migration file
  const migrationPath = join(process.cwd(), '../../packages/db/migrations/016_fix_asp_monthly_data_no_duplicate.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('📄 SQL適用中...\n');

  let migrationApplied = false;

  // Try using direct database connection if available
  if (databaseUrl) {
    try {
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      await client.query(migrationSQL);
      await client.end();
      console.log('✅ マイグレーション適用完了！（直接接続）\n');
      migrationApplied = true;
    } catch (e) {
      console.log('⚠️  直接接続失敗:', e);
    }
  }

  // If direct connection failed, output SQL to run manually
  if (!migrationApplied) {
    console.log('⚠️  以下のSQLをSupabaseダッシュボードのSQL Editorで実行してください:\n');
    console.log('─'.repeat(80));
    console.log(migrationSQL);
    console.log('─'.repeat(80));
    console.log('\n');
  }

  // Test the function
  console.log('🧪 修正を確認中...\n');

  const { data: testData, error: testError } = await supabase
    .rpc('get_asp_monthly_data', {
      p_media_id: null,
      p_fiscal_year: 2025
    });

  if (testError) {
    console.error('❌ テストエラー:', testError);
  } else {
    console.log(`📊 取得データ数: ${testData?.length || 0}件\n`);

    // Show afb data for October
    const afbData = testData?.filter((d: any) => d.asp_name === 'afb' && d.item_month === 10);
    if (afbData && afbData.length > 0) {
      console.log('afb 10月のデータ:');
      afbData.forEach((d: any) => {
        console.log(`  ${d.item_year}/${d.item_month}: ¥${d.actual?.toLocaleString()}`);
      });
      console.log('\n期待値: ¥15,880 (actualsテーブルのみ、daily_actualsは含まない)');
    }
  }
}

main();
