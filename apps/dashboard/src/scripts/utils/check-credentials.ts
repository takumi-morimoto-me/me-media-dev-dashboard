import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔐 登録済み認証情報を確認\n');

  const { data: media } = await supabase
    .from('media')
    .select('id')
    .eq('name', 'ReRe')
    .single();

  if (!media) {
    console.error('❌ ReReメディアが見つかりません');
    return;
  }

  const { data: credentials, error } = await supabase
    .from('asp_credentials')
    .select(`
      id,
      username_secret_key,
      asp:asps(name)
    `)
    .eq('media_id', media.id)
    .order('asp(name)');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`✅ 登録済み認証情報: ${credentials?.length || 0}件\n`);

  credentials?.forEach((cred: any) => {
    console.log(`${cred.asp?.name}: ${cred.username_secret_key}`);
  });

  // Check for missing credentials
  const { data: asps } = await supabase
    .from('asps')
    .select('id, name');

  const registeredAspIds = new Set(credentials?.map((c: any) => c.asp?.name));
  const missingAsps = asps?.filter(asp => !registeredAspIds.has(asp.name));

  if (missingAsps && missingAsps.length > 0) {
    console.log(`\n❌ 認証情報未登録のASP (${missingAsps.length}件):\n`);
    missingAsps.forEach(asp => {
      console.log(`  - ${asp.name}`);
    });
  }
}

main();
