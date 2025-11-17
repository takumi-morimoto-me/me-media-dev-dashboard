import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  console.log('🔍 重複データをチェック中...\n');

  // afbのASP ID
  const afbAspId = '09683e1e-769e-43ad-bfc6-fcc9c4aff354';

  // actualsテーブルの重複チェック
  console.log('📊 actualsテーブルの重複チェック:');
  const { data: actualsData, error: actualsError } = await supabase
    .from('actuals')
    .select('date, media_id, account_item_id, asp_id, amount, created_at')
    .eq('asp_id', afbAspId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (actualsError) {
    console.error('Error:', actualsError);
  } else if (actualsData) {
    console.log(`Total records: ${actualsData.length}`);

    // 重複をグループ化
    const groups = new Map<string, typeof actualsData>();
    actualsData.forEach(record => {
      const key = `${record.date}-${record.media_id}-${record.account_item_id}-${record.asp_id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    });

    const duplicates = Array.from(groups.entries()).filter(([_, records]) => records.length > 1);
    console.log(`重複グループ数: ${duplicates.length}\n`);

    if (duplicates.length > 0) {
      duplicates.forEach(([key, records]) => {
        console.log(`Key: ${key}`);
        console.log(`  Count: ${records.length}`);
        records.forEach((r, i) => {
          console.log(`    [${i + 1}] date: ${r.date}, amount: ${r.amount}, created_at: ${r.created_at}`);
        });
        console.log('');
      });
    }
  }

  // daily_actualsテーブルの重複チェック
  console.log('\n📊 daily_actualsテーブルの重複チェック:');
  const { data: dailyData, error: dailyError } = await supabase
    .from('daily_actuals')
    .select('date, media_id, account_item_id, asp_id, amount, created_at')
    .eq('asp_id', afbAspId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (dailyError) {
    console.error('Error:', dailyError);
  } else if (dailyData) {
    console.log(`Total records: ${dailyData.length}`);

    // 重複をグループ化
    const groups = new Map<string, typeof dailyData>();
    dailyData.forEach(record => {
      const key = `${record.date}-${record.media_id}-${record.account_item_id}-${record.asp_id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    });

    const duplicates = Array.from(groups.entries()).filter(([_, records]) => records.length > 1);
    console.log(`重複グループ数: ${duplicates.length}\n`);

    if (duplicates.length > 0) {
      duplicates.forEach(([key, records]) => {
        console.log(`Key: ${key}`);
        console.log(`  Count: ${records.length}`);
        records.forEach((r, i) => {
          console.log(`    [${i + 1}] date: ${r.date}, amount: ${r.amount}, created_at: ${r.created_at}`);
        });
        console.log('');
      });
    }
  }
}

checkDuplicates();
