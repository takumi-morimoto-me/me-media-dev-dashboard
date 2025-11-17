import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  // ASPを確認
  const { data: asps } = await supabase
    .from('asps')
    .select('*');

  console.log('ASPs:');
  asps?.forEach(asp => {
    console.log(`  - ${asp.name} (ID: ${asp.id})`);
  });

  // アクセストレードのASP IDを探す
  const accesstradeAsp = asps?.find((a: any) => a.name === 'アクセストレード' || a.name.includes('accesstrade') || a.name.includes('AccessTrade'));

  if (accesstradeAsp) {
    console.log('\nAccessTrade ASP ID:', accesstradeAsp.id);

    // 認証情報を確認
    const { data: creds } = await supabase
      .from('asp_credentials')
      .select('*')
      .eq('asp_id', accesstradeAsp.id);

    console.log('Credentials:', creds);
  } else {
    console.log('\nアクセストレードのASPが見つかりません');
  }
}

check();
