import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAspUsage() {
  console.log('🔍 ASPの使用状況を確認しています...\n');

  // 全ASPを取得
  const { data: asps, error: aspsError } = await supabase
    .from('asps')
    .select('id, name')
    .order('name');

  if (aspsError || !asps) {
    console.error('❌ ASPの取得に失敗しました:', aspsError);
    return;
  }

  console.log(`📊 登録されているASP: ${asps.length}件\n`);

  const usedAsps: string[] = [];
  const unusedAsps: string[] = [];

  for (const asp of asps) {
    // daily_actualsにデータがあるかチェック
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_actuals')
      .select('id', { count: 'exact', head: true })
      .eq('asp_id', asp.id)
      .limit(1);

    // actualsにデータがあるかチェック
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('actuals')
      .select('id', { count: 'exact', head: true })
      .eq('asp_id', asp.id)
      .limit(1);

    const hasDailyData = !dailyError && dailyData !== null;
    const hasMonthlyData = !monthlyError && monthlyData !== null;

    if (hasDailyData || hasMonthlyData) {
      usedAsps.push(asp.name);
      console.log(`✅ ${asp.name} - データあり (daily: ${hasDailyData}, monthly: ${hasMonthlyData})`);
    } else {
      unusedAsps.push(asp.name);
      console.log(`❌ ${asp.name} - データなし`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\n📈 データ取得済み ASP (${usedAsps.length}件):`);
  usedAsps.forEach(name => console.log(`  - ${name}`));

  console.log(`\n🗑️  未使用 ASP (${unusedAsps.length}件):`);
  unusedAsps.forEach(name => console.log(`  - ${name}`));

  console.log('\n' + '='.repeat(50));
  console.log('\n💡 削除候補のASP IDを取得中...\n');

  const { data: unusedAspIds } = await supabase
    .from('asps')
    .select('id, name')
    .in('name', unusedAsps);

  if (unusedAspIds && unusedAspIds.length > 0) {
    console.log('削除用SQL:');
    console.log('```sql');
    console.log('DELETE FROM asps WHERE id IN (');
    unusedAspIds.forEach((asp, index) => {
      const comma = index < unusedAspIds.length - 1 ? ',' : '';
      console.log(`  '${asp.id}'${comma} -- ${asp.name}`);
    });
    console.log(');');
    console.log('```');
  }
}

checkAspUsage().catch(console.error);
