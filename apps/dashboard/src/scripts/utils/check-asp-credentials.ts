import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCredentials() {
  const { data, error } = await supabase
    .from('asp_credentials')
    .select('asp_id, username_secret_key, password_secret_key, asps(name)')
    .eq('media_id', '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12');

  if (error) {
    console.error('エラー:', error);
    return;
  }

  const registered = data.filter(c => c.username_secret_key && c.password_secret_key);
  const unregistered = data.filter(c => !c.username_secret_key || !c.password_secret_key);

  console.log('✅ 認証情報が登録されているASP (' + registered.length + '件):');
  registered.forEach(c => console.log('  - ' + (c.asps as any).name));

  console.log('\n❌ 認証情報が未登録のASP (' + unregistered.length + '件):');
  unregistered.forEach(c => console.log('  - ' + (c.asps as any).name));
}

checkCredentials();
