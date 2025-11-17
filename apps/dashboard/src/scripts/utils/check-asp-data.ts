import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAspData() {
  console.log('🔍 ASPデータをチェック中...\n');

  // Get ASP monthly data for 2025
  console.log('📊 get_asp_monthly_data (2025年):');
  const { data: monthlyData, error: monthlyError } = await supabase.rpc('get_asp_monthly_data', {
    p_media_id: null,
    p_fiscal_year: 2025,
  });

  if (monthlyError) {
    console.error('Error:', monthlyError);
  } else if (monthlyData) {
    console.log(`Total records: ${monthlyData.length}\n`);

    // afbのデータだけフィルタ
    const afbData = monthlyData.filter((d: any) => d.asp_name === 'afb');
    console.log(`afbのレコード数: ${afbData.length}`);

    afbData.forEach((d: any) => {
      console.log(`  ${d.item_year}/${d.item_month}: ¥${d.actual.toLocaleString()}`);
    });
  }

  // Get ASP daily data for 2025 October
  console.log('\n📊 get_asp_daily_data (2025年10月):');
  const { data: dailyData, error: dailyError } = await supabase.rpc('get_asp_daily_data', {
    p_media_id: null,
    p_fiscal_year: 2025,
  });

  if (dailyError) {
    console.error('Error:', dailyError);
  } else if (dailyData) {
    console.log(`Total records: ${dailyData.length}\n`);

    // afbの10月データだけフィルタ
    const afbOctData = dailyData.filter((d: any) =>
      d.asp_name === 'afb' && d.item_date.startsWith('2025-10')
    );
    console.log(`afb 10月のレコード数: ${afbOctData.length}`);

    afbOctData.slice(0, 10).forEach((d: any) => {
      console.log(`  ${d.item_date}: ¥${d.actual.toLocaleString()}`);
    });
  }

  // 実テーブルから直接データ取得
  console.log('\n📊 actualsテーブルから直接取得 (afb, 2025):');
  const { data: actualsData, error: actualsError } = await supabase
    .from('actuals')
    .select('date, amount, asp_id, asps(name)')
    .eq('asp_id', '09683e1e-769e-43ad-bfc6-fcc9c4aff354')
    .gte('date', '2025-01-01')
    .lte('date', '2025-12-31')
    .order('date', { ascending: true });

  if (actualsError) {
    console.error('Error:', actualsError);
  } else if (actualsData) {
    console.log(`Total records: ${actualsData.length}`);
    actualsData.forEach((d: any) => {
      console.log(`  ${d.date}: ¥${d.amount.toLocaleString()}`);
    });
  }
}

checkAspData();
