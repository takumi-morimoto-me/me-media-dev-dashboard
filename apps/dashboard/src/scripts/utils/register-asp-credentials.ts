import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ASP credentials to register
const credentials = [
  { asp_name: 'A8.net', username: 'takakuureru', password: 'Hu8nE23xdpf7' },
  { asp_name: 'もしもアフィリエイト', username: 'reredev', password: 'Pa7MHBCe' },
  { asp_name: 'アクセストレード', username: 'reredev', password: 'jdy5342hgg' },
  { asp_name: 'Link-AG', username: 'rere-dev', password: 'ydh563czoq' },
  { asp_name: 'felmat', username: 'rere-dev', password: '6345ejrfideg' },
  { asp_name: 'Smart-C', username: '163850', password: 'hd547gka' },
  { asp_name: 'Zucks Affiliate', username: 'beginners@marketenterprise.co.jp', password: '785tgwayugh' },
  { asp_name: 'Amazonアソシエイト', username: 'beginners@marketenterprise.co.jp', password: 'guamr745hgba' },
  { asp_name: 'リンクシェア', username: 'beginners@marketenterprise.co.jp', password: 'b%)vQ6.BqG6U^t' },
  { asp_name: 'TGアフィリエイト', username: 'rere_begi', password: 'kdur635-evrm' },
  { asp_name: 'DMMアフィリエイト', username: 'beginners@marketenterprise.co.jp', password: 'gyhil2arehf' },
  { asp_name: 'i-mobile', username: 'beginners@marketenterprise.co.jp', password: 's7Vh5k4Bc2pm' },
  { asp_name: 'CASTALK', username: 'o-media@marketenterprise.co.jp', password: 'cPZJXjs4K' },
  { asp_name: 'PRESCO', username: 'beginners@marketenterprise.co.jp', password: 'zw@PeqcLCQ6C85s' },
  { asp_name: 'SmaAD', username: 'beginners@marketenterprise.co.jp', password: '5Q2j5Z2MDBvvEHv' },
  { asp_name: 'CircuitX', username: 'beginners@marketenterprise.co.jp', password: 'hdyk25d' },
  { asp_name: 'SKYFLAG', username: 'beginners@marketenterprise.co.jp', password: 'qcAbv!yNJqt6MEn' },
  { asp_name: 'アルテガアフィリエイト', username: 'o-media@marketenterprise.co.jp', password: 'OfOg0514' },
  { asp_name: 'ドコモアフィリエイト', username: 'reredev', password: '53h7ghay' },
  { asp_name: 'A8app', username: 'beginners@marketenterprise.co.jp', password: '54jeggkgyds' },
];

async function main() {
  console.log('🔐 ASP認証情報を登録中...\n');

  // Get ReRe media ID
  const { data: media, error: mediaError } = await supabase
    .from('media')
    .select('id, name')
    .eq('name', 'ReRe')
    .single();

  if (mediaError || !media) {
    console.error('❌ ReReメディアが見つかりません:', mediaError);
    return;
  }

  console.log(`✅ ReReメディアID: ${media.id}\n`);

  // Get all ASPs
  const { data: asps, error: aspsError } = await supabase
    .from('asps')
    .select('id, name');

  if (aspsError || !asps) {
    console.error('❌ ASP取得エラー:', aspsError);
    return;
  }

  console.log(`📋 登録済みASP数: ${asps.length}\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const cred of credentials) {
    // Find matching ASP
    const asp = asps.find(a => a.name === cred.asp_name);

    if (!asp) {
      console.log(`⚠️  スキップ: ${cred.asp_name} (ASPテーブルに未登録)`);
      skipCount++;
      continue;
    }

    // Check if credentials already exist
    const { data: existing } = await supabase
      .from('asp_credentials')
      .select('id')
      .eq('asp_id', asp.id)
      .eq('media_id', media.id)
      .single();

    if (existing) {
      console.log(`⏭️  スキップ: ${cred.asp_name} (既に登録済み)`);
      skipCount++;
      continue;
    }

    // Insert credentials
    const { error } = await supabase
      .from('asp_credentials')
      .insert({
        asp_id: asp.id,
        media_id: media.id,
        username_secret_key: cred.username,
        password_secret_key: cred.password,
      });

    if (error) {
      console.error(`❌ ${cred.asp_name}: ${error.message}`);
      errorCount++;
    } else {
      console.log(`✅ ${cred.asp_name}: 登録完了`);
      successCount++;
    }
  }

  console.log(`\n📊 登録結果:`);
  console.log(`  ✅ 成功: ${successCount}件`);
  console.log(`  ⏭️  スキップ: ${skipCount}件`);
  console.log(`  ❌ エラー: ${errorCount}件`);
}

main();
