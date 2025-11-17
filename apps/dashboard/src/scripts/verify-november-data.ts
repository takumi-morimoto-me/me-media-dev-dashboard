import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DataSummary {
  aspName: string;
  dataCount: number;
  totalAmount: number;
  dateRange: {
    start: string;
    end: string;
  };
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 11月分データ取得結果の確認');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // スクレイパー名 -> データベースASP名のマッピング
  const scraperToDbName: Record<string, string> = {
    'a8app': 'A8app',
    'accesstrade': 'アクセストレード',
    'afb': 'afb',
    'amazon': 'Amazonアソシエイト',
    'castalk': 'CASTALK',
    'circuitx': 'CircuitX',
    'dmm': 'DMMアフィリエイト',
    'docomo-affiliate': 'ドコモアフィリエイト',
    'imobile': 'i-mobile',
    'janet': 'JANet',
    'linkshare': 'リンクシェア',
    'presco': 'PRESCO',
    'ratelad': 'Ratel AD',
    'rentracks': 'レントラックス',
    'skyflag': 'SKYFLAG',
    'slvrbullet': 'SLVRbullet',
    'smaad': 'SmaAD',
    'smartc': 'Smart-C',
    'tg-affiliate': 'TGアフィリエイト',
    'ultiga': 'アルテガアフィリエイト',
    'valuecommerce': 'バリューコマース',
    'zucks': 'Zucks Affiliate',
  };

  // 完全実装済みASPリスト
  const completedScrapers = Object.keys(scraperToDbName);

  const summaries: DataSummary[] = [];
  let totalDataCount = 0;
  let totalAmount = 0;
  let successfulAsps = 0;

  for (const scraperName of completedScrapers) {
    const dbName = scraperToDbName[scraperName];

    // ASP情報を取得
    const { data: aspData, error: aspError } = await supabase
      .from('asps')
      .select('id, name')
      .eq('name', dbName)
      .single();

    if (aspError || !aspData) {
      console.log(`⚠️  ${scraperName} (${dbName}): ASPデータが見つかりません`);
      if (aspError) {
        console.log(`     エラー: ${aspError.message}`);
      }
      continue;
    }

    // 11月分のデータを取得
    const { data: dailyData, error } = await supabase
      .from('daily_actuals')
      .select('date, amount')
      .eq('asp_id', aspData.id)
      .gte('date', '2025-11-01')
      .lte('date', '2025-11-30')
      .order('date', { ascending: true });

    if (error) {
      console.log(`❌ ${scraperName} (${dbName}): データ取得エラー - ${error.message}`);
      continue;
    }

    if (!dailyData || dailyData.length === 0) {
      console.log(`⚠️  ${scraperName} (${dbName}): データなし`);
      continue;
    }

    const dataCount = dailyData.length;
    const amount = dailyData.reduce((sum, d) => sum + (d.amount || 0), 0);
    const dates = dailyData.map(d => d.date).sort();

    summaries.push({
      aspName: aspData.name,
      dataCount,
      totalAmount: amount,
      dateRange: {
        start: dates[0],
        end: dates[dates.length - 1],
      },
    });

    totalDataCount += dataCount;
    totalAmount += amount;
    if (amount > 0) {
      successfulAsps++;
    }

    console.log(`✅ ${aspData.name}`);
    console.log(`   📅 期間: ${dates[0]} ～ ${dates[dates.length - 1]}`);
    console.log(`   📊 データ件数: ${dataCount}件`);
    console.log(`   💰 合計金額: ¥${amount.toLocaleString()}`);
    console.log('');
  }

  // サマリー
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 集計結果');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ データ取得成功ASP: ${summaries.length}個 / 22個`);
  console.log(`💰 収益があったASP: ${successfulAsps}個`);
  console.log(`📊 総データ件数: ${totalDataCount}件`);
  console.log(`💰 11月合計金額: ¥${totalAmount.toLocaleString()}\n`);

  // トップ5
  if (summaries.length > 0) {
    const topAsps = [...summaries]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏆 11月の収益トップ5');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    topAsps.forEach((asp, index) => {
      console.log(`${index + 1}. ${asp.aspName}: ¥${asp.totalAmount.toLocaleString()}`);
    });
    console.log('');
  }

  // データなしのASP
  const noDataAsps = completedScrapers.filter(
    name => !summaries.find(s => s.aspName.toLowerCase().includes(name))
  );

  if (noDataAsps.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  11月データがないASP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    noDataAsps.forEach(asp => console.log(`   - ${asp}`));
    console.log('');
  }
}

main();
