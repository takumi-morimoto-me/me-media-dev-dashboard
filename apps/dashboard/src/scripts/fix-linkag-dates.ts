#!/usr/bin/env tsx
/**
 * Link-AGの月次データの日付を月初から月末に修正するスクリプト
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Supabase環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface DateFix {
  wrongDate: string;
  correctDate: string;
  month: string;
}

const dateFixes: DateFix[] = [
  { wrongDate: '2025-08-01', correctDate: '2025-07-31', month: '2025年7月' },
  { wrongDate: '2025-09-01', correctDate: '2025-08-31', month: '2025年8月' },
  { wrongDate: '2025-10-01', correctDate: '2025-09-30', month: '2025年9月' },
];

async function main() {
  console.log('🔧 Link-AGの月次データの日付を修正します...\n');

  for (const fix of dateFixes) {
    console.log(`📅 ${fix.month}のデータを修正中...`);
    console.log(`   ${fix.wrongDate} → ${fix.correctDate}`);

    // 現在の間違ったデータを取得
    const { data: oldData, error: fetchError } = await supabase
      .from('actuals')
      .select('*')
      .eq('date', fix.wrongDate)
      .eq('asp_id', '88256cb4-d177-47d3-bf04-db48bf859843') // Link-AG
      .single();

    if (fetchError) {
      console.error(`   ❌ エラー: ${fetchError.message}`);
      continue;
    }

    if (!oldData) {
      console.log(`   ⚠️  データが見つかりません`);
      continue;
    }

    console.log(`   金額: ¥${oldData.amount}`);

    // 古いデータを削除
    const { error: deleteError } = await supabase
      .from('actuals')
      .delete()
      .eq('date', fix.wrongDate)
      .eq('asp_id', '88256cb4-d177-47d3-bf04-db48bf859843');

    if (deleteError) {
      console.error(`   ❌ 削除エラー: ${deleteError.message}`);
      continue;
    }

    // 正しい日付で再挿入
    const { error: insertError } = await supabase.from('actuals').insert({
      date: fix.correctDate,
      amount: oldData.amount,
      media_id: oldData.media_id,
      account_item_id: oldData.account_item_id,
      asp_id: oldData.asp_id,
    });

    if (insertError) {
      console.error(`   ❌ 挿入エラー: ${insertError.message}`);
      continue;
    }

    console.log(`   ✅ 修正完了\n`);
  }

  console.log('🎉 すべての日付を修正しました！');
  console.log('\n検証のため、テストを再実行してください:');
  console.log('pnpm exec tsx src/scripts/test-scraper-data.ts');
}

main().catch(error => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});
