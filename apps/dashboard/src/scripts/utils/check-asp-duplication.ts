import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkAspDuplication() {
  console.log('📊 ASPデータの重複チェック\n');

  // Get media ID
  const { data: media } = await supabase
    .from('media')
    .select('id, name')
    .limit(1)
    .single();

  if (!media) {
    console.log('❌ メディアが見つかりません');
    return;
  }

  console.log(`📱 メディア: ${media.name} (${media.id})\n`);

  const currentYear = new Date().getFullYear();

  // Check monthly ASP data
  console.log('=== 月次ASPデータ (get_asp_monthly_data) ===');
  const { data: aspMonthlyData, error: monthlyError } = await supabase
    .rpc('get_asp_monthly_data', {
      p_media_id: media.id,
      p_fiscal_year: currentYear,
    });

  if (monthlyError) {
    console.error('❌ 月次データ取得エラー:', monthlyError);
  } else {
    console.log(`✅ 月次データ件数: ${aspMonthlyData?.length || 0}`);
    if (aspMonthlyData && aspMonthlyData.length > 0) {
      console.log('サンプル:', JSON.stringify(aspMonthlyData.slice(0, 3), null, 2));
    }
  }

  // Check daily ASP data
  console.log('\n=== 日次ASPデータ (get_asp_daily_data) ===');
  const { data: aspDailyData, error: dailyError } = await supabase
    .rpc('get_asp_daily_data', {
      p_media_id: media.id,
      p_fiscal_year: currentYear,
    });

  if (dailyError) {
    console.error('❌ 日次データ取得エラー:', dailyError);
  } else {
    console.log(`✅ 日次データ件数: ${aspDailyData?.length || 0}`);
    if (aspDailyData && aspDailyData.length > 0) {
      console.log('サンプル:', JSON.stringify(aspDailyData.slice(0, 3), null, 2));
    }
  }

  // Check raw data from actuals table (monthly)
  console.log('\n=== actualsテーブル（月次）の生データ ===');
  const { data: rawActuals } = await supabase
    .from('actuals')
    .select('*, asp:asps(name)')
    .eq('media_id', media.id)
    .limit(5)
    .order('date', { ascending: false });

  if (rawActuals) {
    console.log(`✅ actuals件数サンプル: ${rawActuals.length}`);
    rawActuals.forEach(a => {
      console.log(`  ${a.date} | ${a.asp?.name} | ¥${a.amount}`);
    });
  }

  // Check raw data from daily_actuals table
  console.log('\n=== daily_actualsテーブル（日次）の生データ ===');
  const { data: rawDailyActuals } = await supabase
    .from('daily_actuals')
    .select('*, asp:asps(name)')
    .eq('media_id', media.id)
    .limit(5)
    .order('date', { ascending: false });

  if (rawDailyActuals) {
    console.log(`✅ daily_actuals件数サンプル: ${rawDailyActuals.length}`);
    rawDailyActuals.forEach(a => {
      console.log(`  ${a.date} | ${a.asp?.name} | ¥${a.amount}`);
    });
  }

  // Check for potential duplicates: same ASP, same month
  console.log('\n=== 重複の可能性チェック ===');
  const aspNames = new Set([
    ...((aspMonthlyData || []) as any[]).map(d => d.asp_name),
    ...((aspDailyData || []) as any[]).map(d => d.asp_name),
  ]);

  for (const aspName of aspNames) {
    const monthlyForAsp = ((aspMonthlyData || []) as any[]).filter(d => d.asp_name === aspName);
    const dailyForAsp = ((aspDailyData || []) as any[]).filter(d => d.asp_name === aspName);

    if (monthlyForAsp.length > 0 && dailyForAsp.length > 0) {
      const monthlyTotal = monthlyForAsp.reduce((sum, d) => sum + (d.actual || 0), 0);
      const dailyTotal = dailyForAsp.reduce((sum, d) => sum + (d.actual || 0), 0);

      console.log(`\n${aspName}:`);
      console.log(`  月次データ: ${monthlyForAsp.length}件, 合計¥${monthlyTotal}`);
      console.log(`  日次データ: ${dailyForAsp.length}件, 合計¥${dailyTotal}`);

      if (Math.abs(monthlyTotal - dailyTotal) < 100) {
        console.log(`  ⚠️  合計金額がほぼ同じ！重複の可能性あり`);
      }
    }
  }
}

checkAspDuplication().catch(console.error);
