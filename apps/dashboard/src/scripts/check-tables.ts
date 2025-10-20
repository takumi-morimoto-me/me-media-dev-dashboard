import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkTables() {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 テーブル構造を確認中...\n');

  // budgetsテーブルのデータを確認
  const { data: budgets, error: budgetsError } = await supabase
    .from('budgets')
    .select('*')
    .limit(3);

  if (budgetsError) {
    console.error('❌ budgetsテーブルエラー:', budgetsError);
  } else {
    console.log('📊 budgetsテーブルのサンプル:');
    console.log(JSON.stringify(budgets, null, 2));
  }

  // actualsテーブルが存在するか確認
  const { data: actuals, error: actualsError } = await supabase
    .from('actuals')
    .select('*')
    .limit(3);

  if (actualsError) {
    console.log('\n❌ actualsテーブルエラー:', actualsError.message);
    console.log('⚠️  actualsテーブルが存在しない可能性があります');
  } else {
    console.log('\n📊 actualsテーブルのサンプル:');
    console.log(JSON.stringify(actuals, null, 2));
  }

  // monthly_actualsテーブルが存在するか確認
  const { data: monthlyActuals, error: monthlyActualsError } = await supabase
    .from('monthly_actuals')
    .select('*')
    .limit(3);

  if (monthlyActualsError) {
    console.log('\n❌ monthly_actualsテーブルエラー:', monthlyActualsError.message);
    console.log('⚠️  monthly_actualsテーブルが存在しない可能性があります');
  } else {
    console.log('\n📊 monthly_actualsテーブルのサンプル:');
    console.log(JSON.stringify(monthlyActuals, null, 2));
  }
}

checkTables().catch(console.error);
