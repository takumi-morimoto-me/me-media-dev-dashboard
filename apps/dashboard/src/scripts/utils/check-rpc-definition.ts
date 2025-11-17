import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpcDefinition() {
  console.log('🔍 RPCの定義を確認中...\n');

  // get_asp_monthly_data の結果を詳細確認
  console.log('📊 get_asp_monthly_data (afb, 2025年10月):');
  const { data: monthlyData, error: monthlyError } = await supabase.rpc('get_asp_monthly_data', {
    p_media_id: null,
    p_fiscal_year: 2025,
  });

  if (monthlyError) {
    console.error('Error:', monthlyError);
  } else if (monthlyData) {
    const afbOctData = monthlyData.filter((d: any) =>
      d.asp_name === 'afb' && d.item_month === 10
    );
    console.log(`afb 10月のレコード数: ${afbOctData.length}`);
    afbOctData.forEach((d: any) => {
      console.log(`  ${d.item_year}/${d.item_month}: ¥${d.actual.toLocaleString()}`);
      console.log(`    Full data:`, d);
    });
  }

  // actualsテーブルから10月のデータを直接確認
  console.log('\n📊 actualsテーブル (afb, 2025年10月):');
  const { data: actualsData, error: actualsError } = await supabase
    .from('actuals')
    .select('date, amount')
    .eq('asp_id', '09683e1e-769e-43ad-bfc6-fcc9c4aff354')
    .gte('date', '2025-10-01')
    .lte('date', '2025-10-31');

  if (actualsError) {
    console.error('Error:', actualsError);
  } else if (actualsData) {
    console.log(`レコード数: ${actualsData.length}`);
    actualsData.forEach(d => {
      console.log(`  ${d.date}: ¥${d.amount.toLocaleString()}`);
    });
    const total = actualsData.reduce((sum, d) => sum + d.amount, 0);
    console.log(`  合計: ¥${total.toLocaleString()}`);
  }

  // daily_actualsテーブルから10月のデータを直接確認
  console.log('\n📊 daily_actualsテーブル (afb, 2025年10月):');
  const { data: dailyActualsData, error: dailyActualsError } = await supabase
    .from('daily_actuals')
    .select('date, amount')
    .eq('asp_id', '09683e1e-769e-43ad-bfc6-fcc9c4aff354')
    .gte('date', '2025-10-01')
    .lte('date', '2025-10-31');

  if (dailyActualsError) {
    console.error('Error:', dailyActualsError);
  } else if (dailyActualsData) {
    console.log(`レコード数: ${dailyActualsData.length}`);
    const nonZero = dailyActualsData.filter(d => d.amount > 0);
    console.log(`  非ゼロレコード数: ${nonZero.length}`);
    nonZero.forEach(d => {
      console.log(`  ${d.date}: ¥${d.amount.toLocaleString()}`);
    });
    const total = dailyActualsData.reduce((sum, d) => sum + d.amount, 0);
    console.log(`  合計: ¥${total.toLocaleString()}`);
  }

  console.log('\n🧮 もしRPCが両方を合算している場合:');
  if (actualsData && dailyActualsData) {
    const actualsTotal = actualsData.reduce((sum, d) => sum + d.amount, 0);
    const dailyTotal = dailyActualsData.reduce((sum, d) => sum + d.amount, 0);
    console.log(`  actuals: ¥${actualsTotal.toLocaleString()}`);
    console.log(`  daily_actuals: ¥${dailyTotal.toLocaleString()}`);
    console.log(`  合計: ¥${(actualsTotal + dailyTotal).toLocaleString()}`);
  }
}

checkRpcDefinition();
