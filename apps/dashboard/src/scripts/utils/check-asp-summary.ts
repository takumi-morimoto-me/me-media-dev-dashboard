import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('\n📊 ASP Implementation Summary\n');
  console.log('='.repeat(80));

  const { data: asps } = await supabase
    .from('asps')
    .select('id, name')
    .order('name');

  if (!asps) {
    console.error('Failed to fetch ASPs');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const asp of asps) {
    const { count: totalCount } = await supabase
      .from('daily_actuals')
      .select('*', { count: 'exact', head: true })
      .eq('asp_id', asp.id);

    const { count: recentCount } = await supabase
      .from('daily_actuals')
      .select('*', { count: 'exact', head: true })
      .eq('asp_id', asp.id)
      .gte('date', weekAgo);

    const { count: todayCount } = await supabase
      .from('daily_actuals')
      .select('*', { count: 'exact', head: true })
      .eq('asp_id', asp.id)
      .eq('date', today);

    const status = todayCount && todayCount > 0 ? '✅' : recentCount && recentCount > 0 ? '⚠️' : '❌';

    console.log(`${status} ${asp.name.padEnd(35)} | Total: ${String(totalCount || 0).padStart(4)} | Week: ${String(recentCount || 0).padStart(3)} | Today: ${String(todayCount || 0).padStart(2)}`);
  }

  console.log('='.repeat(80));
  console.log('\n✅ = Data today | ⚠️ = Data this week | ❌ = No recent data\n');
}

main();
