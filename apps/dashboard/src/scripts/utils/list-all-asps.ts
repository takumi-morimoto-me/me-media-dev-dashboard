import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('📋 Supabaseに登録されているASPの一覧:\n');

  const { data: asps, error } = await supabase
    .from('asps')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('エラー:', error);
    return;
  }

  if (!asps) {
    console.log('ASPが見つかりませんでした');
    return;
  }

  console.log(`合計: ${asps.length}件\n`);

  asps.forEach((asp, index) => {
    console.log(`${index + 1}. ${asp.name} (ID: ${asp.id})`);
  });

  // Check which ASPs have scrapers
  const scraperMapping: Record<string, string[]> = {
    'A8.net': ['a8net'],
    'もしもアフィリエイト': ['moshimo'],
    'Link-AG': ['linkag'],
    'felmat': ['felmat'],
    'afb': ['afb'],
    'アクセストレード': ['accesstrade'],
    'Amazonアソシエイト': ['amazon'],
    'DMMアフィリエイト': ['dmm'],
    'リンクシェア': ['linkshare'],
    'バリューコマース': ['valuecommerce'],
    'JANet': ['janet'],
    'TGアフィリエイト': ['tg-affiliate'],
    'レントラックス': ['rentracks'],
    'Smart-C': ['smartc'],
    'i-mobile': ['imobile'],
    'Zucks Affiliate': ['zucks'],
  };

  console.log('\n\n🔍 スクレイパーの実装状況:\n');

  const aspWithScrapers = asps.map(asp => {
    const hasImplementedScraper = scraperMapping[asp.name] !== undefined;

    return {
      ...asp,
      hasImplementedScraper,
    };
  });

  console.log('✅ スクレイパー実装済み:');
  aspWithScrapers
    .filter(asp => asp.hasImplementedScraper)
    .forEach(asp => console.log(`  - ${asp.name}`));

  console.log('\n❌ スクレイパー未実装:');
  aspWithScrapers
    .filter(asp => !asp.hasImplementedScraper)
    .forEach(asp => console.log(`  - ${asp.name}`));
}

main();
