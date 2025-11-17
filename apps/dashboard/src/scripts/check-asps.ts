import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  const { data: asps } = await supabase
    .from('asps')
    .select('id, name')
    .order('name');

  console.log('Registered ASPs:');
  asps?.forEach(asp => console.log(`  - ${asp.name} (${asp.id})`));

  // Check if WEBRIDGE exists
  const webridge = asps?.find(a => a.name.toLowerCase().includes('webridge'));
  console.log(`\nWEBRIDGE exists: ${webridge ? 'Yes - ' + webridge.name : 'No'}`);
}

main();
