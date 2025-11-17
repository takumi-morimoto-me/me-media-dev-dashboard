import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface AspCredentialData {
  aspName: string;
  username: string;
  password: string;
  loginUrl: string;
}

const aspCredentials: AspCredentialData[] = [
  { aspName: 'A8.net', username: 'takakuureru', password: 'Hu8nE23xdpf7', loginUrl: 'http://www.a8.net/' },
  { aspName: 'もしもアフィリエイト', username: 'reredev', password: 'Pa7MHBCe', loginUrl: 'https://af.moshimo.com/' },
  { aspName: 'CASTALK', username: 'o-media@marketenterprise.co.jp', password: 'cPZJXjs4K', loginUrl: 'https://castalk-partner.com/' },
  { aspName: 'アルテガアフィリエイト', username: 'o-media@marketenterprise.co.jp', password: 'OfOg0514', loginUrl: 'https://ultelo.jp/' },
  { aspName: 'アクセストレード', username: 'reredev', password: 'jdy5342hgg', loginUrl: 'https://www.accesstrade.ne.jp/' },
  { aspName: 'ドコモアフィリエイト', username: 'reredev', password: '53h7ghay', loginUrl: 'https://affiliate-sp.docomo.ne.jp/pt/login' },
  { aspName: 'Link-AG', username: 'rere-dev', password: 'ydh563czoq', loginUrl: 'https://link-ag.net/' },
  { aspName: 'felmat', username: 'rere-dev', password: '6345ejrfideg', loginUrl: 'https://www.felmat.net/publisher/top' },
  { aspName: 'CircuitX', username: 'beginners@marketenterprise.co.jp', password: 'hdyk25d', loginUrl: 'https://x-dashboard.cir.io/' },
  { aspName: 'A8app', username: 'beginners@marketenterprise.co.jp', password: '54jeggkgyds', loginUrl: 'https://admin.seedapp.jp/' },
  { aspName: 'Smart-C', username: '163850', password: 'hd547gka', loginUrl: 'https://smart-c.jp/publisher/top' },
  { aspName: 'PRESCO', username: 'beginners@marketenterprise.co.jp', password: 'zw@PeqcLCQ6C85s', loginUrl: 'https://presco.ai/' },
  { aspName: 'SmaAD', username: 'beginners@marketenterprise.co.jp', password: '5Q2j5Z2MDBvvEHv', loginUrl: 'https://smaad.net/smaaffi/' },
  { aspName: 'Zucks Affiliate', username: 'beginners@marketenterprise.co.jp', password: '785tgwayugh', loginUrl: 'https://affiliate.zucks.jp/signin' },
  { aspName: 'SKYFLAG', username: 'beginners@marketenterprise.co.jp', password: 'qcAbv!yNJqt6MEn', loginUrl: 'https://dashboard.skyflag.jp/mediaOwnerLogin' },
  { aspName: 'Amazonアソシエイト', username: 'beginners@marketenterprise.co.jp', password: 'guamr745hgba', loginUrl: 'https://affiliate.amazon.co.jp/' },
  { aspName: 'リンクシェア', username: 'beginners@marketenterprise.co.jp', password: 'b%)vQ6.BqG6U^t', loginUrl: 'https://www.linkshare.ne.jp/' },
  { aspName: 'TGアフィリエイト', username: 'rere_begi', password: 'kdur635-evrm', loginUrl: 'https://www.linkshare.ne.jp/TG/' },
  { aspName: 'DMMアフィリエイト', username: 'beginners@marketenterprise.co.jp', password: 'gyhil2arehf', loginUrl: 'https://affiliate.dmm.com/' },
  { aspName: 'i-mobile', username: 'beginners@marketenterprise.co.jp', password: 's7Vh5k4Bc2pm', loginUrl: 'https://sppartner.i-mobile.co.jp/login.aspx' },
  { aspName: 'afb', username: 'beginners@marketenterprise.co.jp', password: 'Me20190416', loginUrl: 'https://www.afi-b.com/' },
  { aspName: 'JANet', username: 'beginners@marketenterprise.co.jp', password: 'Me20190416', loginUrl: 'https://j-a-net.jp/' },
  { aspName: 'バリューコマース', username: 'beginners@marketenterprise.co.jp', password: 'Me20190416', loginUrl: 'https://aff.valuecommerce.ne.jp/login' },
];

async function updateAspCredentials() {
  console.log('📋 ASP認証情報を更新中...\n');

  // メディアIDを取得（ReReに名称変更済みの想定）
  const { data: media, error: mediaError } = await supabase
    .from('media')
    .select('id, name')
    .eq('name', 'ReRe')
    .single();

  if (mediaError || !media) {
    console.error('❌ メディア "ReRe" が見つかりません:', mediaError);
    return;
  }

  console.log(`✅ メディアID: ${media.id} (${media.name})\n`);

  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;

  for (const cred of aspCredentials) {
    console.log(`\n処理中: ${cred.aspName}`);

    // ASP IDを取得
    const { data: asp, error: aspError } = await supabase
      .from('asps')
      .select('id')
      .eq('name', cred.aspName)
      .single();

    if (aspError || !asp) {
      console.log(`  ⚠️ ASP "${cred.aspName}" がデータベースに見つかりません`);
      notFoundCount++;
      continue;
    }

    // 認証情報を upsert
    const { error: credError } = await supabase
      .from('asp_credentials')
      .upsert({
        asp_id: asp.id,
        media_id: media.id,
        username_secret_key: cred.username,
        password_secret_key: cred.password,
      }, {
        onConflict: 'asp_id,media_id'
      });

    if (credError) {
      console.log(`  ❌ 認証情報の保存に失敗: ${credError.message}`);
      failCount++;
      continue;
    }

    // login_urlをaspsテーブルに更新
    const { error: aspUpdateError } = await supabase
      .from('asps')
      .update({ login_url: cred.loginUrl })
      .eq('id', asp.id);

    if (aspUpdateError) {
      console.log(`  ⚠️ login_urlの更新に失敗: ${aspUpdateError.message}`);
    }

    console.log(`  ✅ 更新完了`);
    successCount++;
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n✅ 更新完了: ${successCount}件`);
  console.log(`❌ 失敗: ${failCount}件`);
  console.log(`⚠️ ASP未登録: ${notFoundCount}件\n`);
}

updateAspCredentials();
