import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Mapping from the provided list to ASP names in the database
const credentialsMap: Record<string, { username: string; password: string }> = {
  'A8.net': { username: 'takakuureru', password: 'Hu8nE23xdpf7' },
  'もしもアフィリエイト': { username: 'reredev', password: 'Pa7MHBCe' },
  'CASTALK': { username: 'o-media@marketenterprise.co.jp', password: 'cPZJXjs4K' },
  'アルテガアフィリエイト': { username: 'o-media@marketenterprise.co.jp', password: 'OfOg0514' },
  'アクセストレード': { username: 'reredev', password: 'jdy5342hgg' },
  'ドコモアフィリエイト': { username: 'reredev', password: '53h7ghay' },
  'Link-AG': { username: 'rere-dev', password: 'ydh563czoq' },
  'felmat': { username: 'rere-dev', password: '6345ejrfideg' },
  'CircuitX': { username: 'beginners@marketenterprise.co.jp', password: 'hdyk25d' },
  'A8app': { username: 'beginners@marketenterprise.co.jp', password: '54jeggkgyds' },
  'Smart-C': { username: '163850', password: 'hd547gka' },
  'PRESCO': { username: 'beginners@marketenterprise.co.jp', password: 'zw@PeqcLCQ6C85s' },
  'SmaAD': { username: 'beginners@marketenterprise.co.jp', password: '5Q2j5Z2MDBvvEHv' },
  'Zucks Affiliate': { username: 'beginners@marketenterprise.co.jp', password: '785tgwayugh' },
  'SKYFLAG': { username: 'beginners@marketenterprise.co.jp', password: 'qcAbv!yNJqt6MEn' },
  'Amazonアソシエイト': { username: 'beginners@marketenterprise.co.jp', password: 'guamr745hgba' },
  'リンクシェア': { username: 'beginners@marketenterprise.co.jp', password: 'b%)vQ6.BqG6U^t' },
  'TGアフィリエイト': { username: 'rere_begi', password: 'kdur635-evrm' },
  'DMMアフィリエイト': { username: 'beginners@marketenterprise.co.jp', password: 'gyhil2arehf' },
  'i-mobile': { username: 'beginners@marketenterprise.co.jp', password: 's7Vh5k4Bc2pm' },
};

async function main() {
  console.log('🔄 認証情報を同期中...\n');

  const { data: media } = await supabase
    .from('media')
    .select('id')
    .eq('name', 'ReRe')
    .single();

  if (!media) {
    console.error('❌ ReReメディアが見つかりません');
    return;
  }

  console.log(`✅ メディアID: ${media.id}\n`);

  const { data: asps } = await supabase
    .from('asps')
    .select('id, name');

  if (!asps) {
    console.error('❌ ASP取得エラー');
    return;
  }

  let updateCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const [aspName, creds] of Object.entries(credentialsMap)) {
    const asp = asps.find(a => a.name === aspName);

    if (!asp) {
      console.log(`⚠️  スキップ: ${aspName} (ASPテーブルに未登録)`);
      skipCount++;
      continue;
    }

    // Get existing credentials
    const { data: existing } = await supabase
      .from('asp_credentials')
      .select('id, username_secret_key, password_secret_key')
      .eq('asp_id', asp.id)
      .eq('media_id', media.id)
      .single();

    if (!existing) {
      // Insert new credentials
      const { error } = await supabase
        .from('asp_credentials')
        .insert({
          asp_id: asp.id,
          media_id: media.id,
          username_secret_key: creds.username,
          password_secret_key: creds.password,
        });

      if (error) {
        console.error(`❌ ${aspName}: 挿入エラー - ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ ${aspName}: 新規登録`);
        updateCount++;
      }
    } else if (!existing.username_secret_key || !existing.password_secret_key) {
      // Update null credentials
      const { error } = await supabase
        .from('asp_credentials')
        .update({
          username_secret_key: creds.username,
          password_secret_key: creds.password,
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`❌ ${aspName}: 更新エラー - ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ ${aspName}: null認証情報を更新`);
        updateCount++;
      }
    } else if (existing.username_secret_key !== creds.username || existing.password_secret_key !== creds.password) {
      // Update if credentials are different
      console.log(`🔄 ${aspName}: 認証情報が異なります - 更新中...`);
      const { error } = await supabase
        .from('asp_credentials')
        .update({
          username_secret_key: creds.username,
          password_secret_key: creds.password,
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`❌ ${aspName}: 更新エラー - ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ ${aspName}: 認証情報を更新`);
        updateCount++;
      }
    } else {
      console.log(`⏭️  ${aspName}: 既に最新`);
      skipCount++;
    }
  }

  console.log(`\n📊 同期結果:`);
  console.log(`  ✅ 更新/新規: ${updateCount}件`);
  console.log(`  ⏭️  スキップ: ${skipCount}件`);
  console.log(`  ❌ エラー: ${errorCount}件`);

  console.log(`\n⚠️  以下のASPは認証情報がリストにありません:`);
  console.log(`  - バリューコマース`);
  console.log(`  - JANet`);
  console.log(`  - レントラックス`);
  console.log(`  - afb (リストにoutletmeがありますが、ビギナーズではありません)`);
}

main();
