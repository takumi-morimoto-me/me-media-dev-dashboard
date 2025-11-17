#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ActualWithAsp = {
  date: string;
  asp_id: string;
  amount: number;
  asps: { name: string } | null;
};

async function main() {
  const { data, error } = await supabase
    .from('actuals')
    .select('date, asp_id, asps(name), amount')
    .in('date', ['2025-08-01', '2025-09-01', '2025-10-01'])
    .order('date');

  if (error) {
    console.error('エラー:', error);
    return;
  }

  const typedData = data as unknown as ActualWithAsp[] | null;

  console.log('\n月初日付で保存されているデータ（本来は月末であるべき）:');
  console.log('='.repeat(60));
  typedData?.forEach(row => {
    console.log(`  日付: ${row.date}`);
    console.log(`  ASP: ${row.asps?.name || 'Unknown'}`);
    console.log(`  金額: ¥${row.amount}`);
    console.log('  ---');
  });
  console.log('='.repeat(60));
  console.log(`\n合計: ${typedData?.length || 0}件`);
}

main();
