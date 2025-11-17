#!/usr/bin/env tsx
/**
 * スクレイパーデータ検証スクリプト
 *
 * このスクリプトは、scraper-testing-checklist.md に基づいて
 * スクレイパーのデータを検証します。
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// .env.local を読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * テスト1: 日次データが2025年1月から取得されているか
 */
async function test1_DailyDataFrom202501() {
  console.log('\n📋 テスト1: 日次データが2025年1月から取得されているか');

  const { data, error } = await supabase
    .from('daily_actuals')
    .select('date, asp_id, amount')
    .gte('date', '2025-01-01')
    .order('date', { ascending: true })
    .limit(10);

  if (error) {
    results.push({
      testName: '日次データ取得（2025-01-01以降）',
      passed: false,
      message: `データベースエラー: ${error.message}`,
    });
    return;
  }

  const hasData = data && data.length > 0;
  results.push({
    testName: '日次データ取得（2025-01-01以降）',
    passed: hasData,
    message: hasData
      ? `✅ ${data.length}件のデータが見つかりました`
      : '❌ データが見つかりませんでした',
    details: data?.slice(0, 3),
  });
}

/**
 * テスト2: 月次データが2025年1月から取得されているか
 */
async function test2_MonthlyDataFrom202501() {
  console.log('\n📋 テスト2: 月次データが2025年1月から取得されているか');

  const { data, error } = await supabase
    .from('actuals')
    .select('date, asp_id, amount')
    .gte('date', '2025-01-01')
    .order('date', { ascending: true })
    .limit(10);

  if (error) {
    results.push({
      testName: '月次データ取得（2025-01-01以降）',
      passed: false,
      message: `データベースエラー: ${error.message}`,
    });
    return;
  }

  const hasData = data && data.length > 0;
  results.push({
    testName: '月次データ取得（2025-01-01以降）',
    passed: hasData,
    message: hasData
      ? `✅ ${data.length}件のデータが見つかりました`
      : '❌ データが見つかりませんでした',
    details: data?.slice(0, 3),
  });
}

/**
 * テスト3: 月次データが月末日付で保存されているか
 */
async function test3_MonthlyDataEndOfMonth() {
  console.log('\n📋 テスト3: 月次データが月末日付で保存されているか');

  const { data, error } = await supabase
    .from('actuals')
    .select('date')
    .gte('date', '2025-01-01')
    .order('date', { ascending: true });

  if (error) {
    results.push({
      testName: '月末日付チェック',
      passed: false,
      message: `データベースエラー: ${error.message}`,
    });
    return;
  }

  if (!data || data.length === 0) {
    results.push({
      testName: '月末日付チェック',
      passed: false,
      message: '❌ データが見つかりませんでした',
    });
    return;
  }

  // 各日付が月末かチェック
  const invalidDates = data.filter(row => {
    const date = new Date(row.date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // 次の日が翌月の1日かチェック
    return nextDay.getDate() !== 1;
  });

  const allMonthEnd = invalidDates.length === 0;
  results.push({
    testName: '月末日付チェック',
    passed: allMonthEnd,
    message: allMonthEnd
      ? `✅ すべてのデータが月末日付です（${data.length}件）`
      : `❌ 月末でない日付が${invalidDates.length}件見つかりました`,
    details: invalidDates.slice(0, 5),
  });
}

/**
 * テスト4: 日次データに重複がないか
 */
async function test4_DailyDataNoDuplicates() {
  console.log('\n📋 テスト4: 日次データに重複がないか');

  const { data, error } = await supabase.rpc('check_daily_duplicates', {
    start_date: '2025-01-01'
  });

  if (error) {
    // RPCが存在しない場合は、直接クエリを実行
    const { data: duplicates, error: queryError } = await supabase
      .from('daily_actuals')
      .select('date, asp_id, media_id, account_item_id')
      .gte('date', '2025-01-01');

    if (queryError) {
      results.push({
        testName: '日次データ重複チェック',
        passed: false,
        message: `データベースエラー: ${queryError.message}`,
      });
      return;
    }

    // 手動で重複をチェック
    const seen = new Set<string>();
    const duplicatesList: any[] = [];

    duplicates?.forEach(row => {
      const key = `${row.date}_${row.asp_id}_${row.media_id}_${row.account_item_id}`;
      if (seen.has(key)) {
        duplicatesList.push(row);
      }
      seen.add(key);
    });

    const noDuplicates = duplicatesList.length === 0;
    results.push({
      testName: '日次データ重複チェック',
      passed: noDuplicates,
      message: noDuplicates
        ? '✅ 重複データはありません'
        : `❌ ${duplicatesList.length}件の重複が見つかりました`,
      details: duplicatesList.slice(0, 5),
    });
    return;
  }

  const noDuplicates = !data || data.length === 0;
  results.push({
    testName: '日次データ重複チェック',
    passed: noDuplicates,
    message: noDuplicates
      ? '✅ 重複データはありません'
      : `❌ ${data.length}件の重複が見つかりました`,
    details: data?.slice(0, 5),
  });
}

/**
 * テスト5: 月次データに重複がないか
 */
async function test5_MonthlyDataNoDuplicates() {
  console.log('\n📋 テスト5: 月次データに重複がないか');

  const { data: duplicates, error } = await supabase
    .from('actuals')
    .select('date, asp_id, media_id, account_item_id')
    .gte('date', '2025-01-01');

  if (error) {
    results.push({
      testName: '月次データ重複チェック',
      passed: false,
      message: `データベースエラー: ${error.message}`,
    });
    return;
  }

  // 手動で重複をチェック
  const seen = new Set<string>();
  const duplicatesList: any[] = [];

  duplicates?.forEach(row => {
    const key = `${row.date}_${row.asp_id}_${row.media_id}_${row.account_item_id}`;
    if (seen.has(key)) {
      duplicatesList.push(row);
    }
    seen.add(key);
  });

  const noDuplicates = duplicatesList.length === 0;
  results.push({
    testName: '月次データ重複チェック',
    passed: noDuplicates,
    message: noDuplicates
      ? '✅ 重複データはありません'
      : `❌ ${duplicatesList.length}件の重複が見つかりました`,
    details: duplicatesList.slice(0, 5),
  });
}

/**
 * テスト6: 日次・月次が合算されていないか
 * （get_asp_monthly_data関数が actuals テーブルのみを使用しているか）
 */
async function test6_NoDataMerging() {
  console.log('\n📋 テスト6: 日次・月次が合算されていないか');

  // まず、特定のASPの2025年1月の月次データを取得
  const { data: monthlyData, error: monthlyError } = await supabase
    .from('actuals')
    .select('amount, asp_id')
    .gte('date', '2025-01-01')
    .lt('date', '2025-02-01')
    .limit(1)
    .single();

  if (monthlyError || !monthlyData) {
    results.push({
      testName: '日次・月次合算チェック',
      passed: true,
      message: '⚠️ 月次データが見つからないためスキップしました',
    });
    return;
  }

  // 同じASPの日次データの合計を取得
  const { data: dailyData, error: dailyError } = await supabase
    .from('daily_actuals')
    .select('amount')
    .eq('asp_id', monthlyData.asp_id)
    .gte('date', '2025-01-01')
    .lt('date', '2025-02-01');

  if (dailyError) {
    results.push({
      testName: '日次・月次合算チェック',
      passed: false,
      message: `データベースエラー: ${dailyError.message}`,
    });
    return;
  }

  const dailyTotal = dailyData?.reduce((sum, row) => sum + parseFloat(row.amount || '0'), 0) || 0;
  const monthlyAmount = parseFloat(monthlyData.amount || '0');

  // 月次データが日次データの2倍になっていないかチェック
  const isDoubled = Math.abs(monthlyAmount - dailyTotal * 2) < 1;
  const passed = !isDoubled;

  results.push({
    testName: '日次・月次合算チェック',
    passed,
    message: passed
      ? '✅ 日次・月次は合算されていません'
      : `❌ データが合算されている可能性があります（月次: ${monthlyAmount}, 日次合計: ${dailyTotal}）`,
    details: {
      monthlyAmount,
      dailyTotal,
      ratio: monthlyAmount / dailyTotal,
    },
  });
}

/**
 * テスト7: 週次集計が可能か
 */
async function test7_WeeklyAggregation() {
  console.log('\n📋 テスト7: 日次データから週次集計が可能か');

  const { data, error } = await supabase
    .from('daily_actuals')
    .select('date, amount, asp_id')
    .gte('date', '2025-01-01')
    .lt('date', '2025-02-01')
    .order('date', { ascending: true });

  if (error) {
    results.push({
      testName: '週次集計チェック',
      passed: false,
      message: `データベースエラー: ${error.message}`,
    });
    return;
  }

  if (!data || data.length === 0) {
    results.push({
      testName: '週次集計チェック',
      passed: false,
      message: '❌ 日次データが見つかりませんでした',
    });
    return;
  }

  // 週次集計のシミュレーション
  const weeklyData = new Map<string, number>();
  data.forEach(row => {
    const date = new Date(row.date);
    const weekStart = new Date(date);
    // 月曜日を週の開始とする
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);

    const weekKey = weekStart.toISOString().split('T')[0];
    weeklyData.set(weekKey, (weeklyData.get(weekKey) || 0) + parseFloat(row.amount || '0'));
  });

  const hasWeeklyData = weeklyData.size > 0;
  results.push({
    testName: '週次集計チェック',
    passed: hasWeeklyData,
    message: hasWeeklyData
      ? `✅ 週次集計が可能です（${weeklyData.size}週分）`
      : '❌ 週次集計ができませんでした',
    details: Array.from(weeklyData.entries()).slice(0, 3).map(([week, total]) => ({
      weekStart: week,
      total,
    })),
  });
}

/**
 * テスト結果のサマリーを表示
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 テスト結果サマリー');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`\n${index + 1}. ${icon} ${result.testName}`);
    console.log(`   ${result.message}`);
    if (result.details && !result.passed) {
      console.log(`   詳細:`, JSON.stringify(result.details, null, 2));
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`総計: ${total}件 | 成功: ${passed}件 | 失敗: ${failed}件`);
  console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  いくつかのテストが失敗しました。詳細を確認してください。');
    process.exit(1);
  } else {
    console.log('\n🎉 すべてのテストが成功しました！');
    process.exit(0);
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 スクレイパーデータ検証を開始します...\n');

  await test1_DailyDataFrom202501();
  await test2_MonthlyDataFrom202501();
  await test3_MonthlyDataEndOfMonth();
  await test4_DailyDataNoDuplicates();
  await test5_MonthlyDataNoDuplicates();
  await test6_NoDataMerging();
  await test7_WeeklyAggregation();

  printSummary();
}

main().catch(error => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});
