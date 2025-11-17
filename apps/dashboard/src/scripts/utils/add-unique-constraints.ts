import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addUniqueConstraints() {
  console.log('🔧 UNIQUE制約を追加中...\n');

  // actualsテーブルにUNIQUE制約を追加
  console.log('📊 actualsテーブルにUNIQUE制約を追加:');
  const { error: actualsError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE actuals
      ADD CONSTRAINT actuals_unique_constraint
      UNIQUE (date, media_id, account_item_id, asp_id);
    `
  });

  if (actualsError) {
    console.error('Error adding constraint to actuals:', actualsError);
  } else {
    console.log('✅ actualsテーブルにUNIQUE制約を追加しました');
  }

  // daily_actualsテーブルにUNIQUE制約を追加
  console.log('\n📊 daily_actualsテーブルにUNIQUE制約を追加:');
  const { error: dailyError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE daily_actuals
      ADD CONSTRAINT daily_actuals_unique_constraint
      UNIQUE (date, media_id, account_item_id, asp_id);
    `
  });

  if (dailyError) {
    console.error('Error adding constraint to daily_actuals:', dailyError);
  } else {
    console.log('✅ daily_actualsテーブルにUNIQUE制約を追加しました');
  }

  console.log('\n✅ すべてのUNIQUE制約を追加しました！');
}

addUniqueConstraints();
