import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * daily_actuals テーブルから月次データを集計して actuals テーブルに保存
 *
 * 使い方:
 * pnpm exec tsx src/scripts/aggregate-daily-to-monthly.ts [asp_name]
 *
 * 例:
 * pnpm exec tsx src/scripts/aggregate-daily-to-monthly.ts A8app
 * pnpm exec tsx src/scripts/aggregate-daily-to-monthly.ts all  # 全ASP
 */

interface DailyRecord {
  date: string;
  amount: number;
  media_id: string;
  account_item_id: string;
  asp_id: string;
}

interface MonthlyAggregate {
  yearMonth: string;
  totalAmount: number;
  recordCount: number;
}

async function aggregateMonthlyData(aspName?: string) {
  console.log('📊 日次データから月次データを集計中...\n');

  // ASP情報を取得
  let asps: any[];
  if (aspName && aspName !== 'all') {
    const { data, error } = await supabase
      .from('asps')
      .select('id, name')
      .eq('name', aspName)
      .single();

    if (error || !data) {
      console.error(`❌ ASP "${aspName}" が見つかりません`);
      return;
    }
    asps = [data];
  } else {
    const { data, error } = await supabase
      .from('asps')
      .select('id, name')
      .order('name');

    if (error || !data) {
      console.error('❌ ASP一覧の取得に失敗しました');
      return;
    }
    asps = data;
  }

  let totalProcessed = 0;
  let totalAggregated = 0;

  for (const asp of asps) {
    console.log(`\n📋 ${asp.name} を処理中...`);

    // 日次データを取得
    const { data: dailyRecords, error: fetchError } = await supabase
      .from('daily_actuals')
      .select('date, amount, media_id, account_item_id, asp_id')
      .eq('asp_id', asp.id)
      .order('date');

    if (fetchError) {
      console.error(`  ❌ 日次データの取得エラー:`, fetchError.message);
      continue;
    }

    if (!dailyRecords || dailyRecords.length === 0) {
      console.log(`  ⚠️  日次データがありません`);
      continue;
    }

    console.log(`  📅 日次データ: ${dailyRecords.length}件`);

    // 月ごとに集計
    const monthlyMap = new Map<string, MonthlyAggregate>();

    for (const record of dailyRecords) {
      const yearMonth = record.date.substring(0, 7); // YYYY-MM

      if (!monthlyMap.has(yearMonth)) {
        monthlyMap.set(yearMonth, {
          yearMonth,
          totalAmount: 0,
          recordCount: 0
        });
      }

      const aggregate = monthlyMap.get(yearMonth)!;
      aggregate.totalAmount += record.amount;
      aggregate.recordCount++;
    }

    // actualsテーブルに保存
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const [yearMonth, aggregate] of monthlyMap.entries()) {
      // 月末の日付を計算
      const [year, month] = yearMonth.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const formattedDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;

      // サンプルレコードから必要な情報を取得
      const sampleRecord = dailyRecords[0];

      const { error } = await supabase
        .from('actuals')
        .upsert(
          {
            date: formattedDate,
            amount: aggregate.totalAmount,
            media_id: sampleRecord.media_id,
            account_item_id: sampleRecord.account_item_id,
            asp_id: asp.id,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'date,media_id,account_item_id,asp_id',
          }
        );

      if (error) {
        console.error(`  ❌ ${yearMonth} の保存エラー:`, error.message);
        errors++;
      } else {
        console.log(`  ✓ ${yearMonth}: ¥${aggregate.totalAmount.toLocaleString()} (${aggregate.recordCount}日分)`);
        inserted++;
        totalAggregated++;
      }
    }

    console.log(`  ✅ ${asp.name}: ${inserted}件の月次データを保存`);
    totalProcessed++;
  }

  console.log('\n============================================================');
  console.log('📊 集計結果');
  console.log('============================================================');
  console.log(`✅ 処理したASP: ${totalProcessed}件`);
  console.log(`✅ 作成した月次データ: ${totalAggregated}件`);
  console.log('============================================================\n');
}

// メイン処理
const aspName = process.argv[2];

if (!aspName) {
  console.log('使い方:');
  console.log('  pnpm exec tsx src/scripts/aggregate-daily-to-monthly.ts [asp_name]');
  console.log('');
  console.log('例:');
  console.log('  pnpm exec tsx src/scripts/aggregate-daily-to-monthly.ts A8app');
  console.log('  pnpm exec tsx src/scripts/aggregate-daily-to-monthly.ts all');
  process.exit(1);
}

aggregateMonthlyData(aspName).catch(console.error);
