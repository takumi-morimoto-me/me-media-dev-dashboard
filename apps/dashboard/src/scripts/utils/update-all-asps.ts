import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { A8NetDailyScraper } from './a8net-daily-scraper';
import { MoshimoDailyScraper } from './moshimo-daily-scraper';
import { LinkAGDailyScraper } from './linkag-daily-scraper';
import { FelmatDailyScraper } from './felmat-daily-scraper';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAllAsps() {
  console.log('🔄 全ASPの最新データを取得します...\n');

  // 必要な情報を取得
  const { data: asps } = await supabase
    .from('asps')
    .select('id, name')
    .in('name', ['A8.net', 'もしもアフィリエイト', 'Link-AG', 'felmat']);

  const { data: media } = await supabase
    .from('media')
    .select('id, name')
    .eq('name', 'ReRe')
    .single();

  const { data: accountItems } = await supabase
    .from('account_items')
    .select('id, name')
    .eq('media_id', media?.id)
    .eq('name', '売上');

  if (!asps || !media || !accountItems || accountItems.length === 0) {
    console.error('❌ 必要な情報の取得に失敗しました');
    return;
  }

  const mediaId = media.id;
  const accountItemId = accountItems[0].id;

  console.log(`✅ メディアID: ${mediaId} (${media.name})`);
  console.log(`✅ 勘定科目ID: ${accountItemId} (売上)\n`);

  // 現在の年月を取得（YYYYMM形式）
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 各ASPのスクレイピングを実行
  for (const asp of asps) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 ${asp.name} のデータを取得中...\n`);

    try {
      switch (asp.name) {
        case 'A8.net':
          if (!process.env.A8NET_USERNAME || !process.env.A8NET_PASSWORD) {
            console.log('⚠️  A8.netの認証情報が設定されていません');
            break;
          }
          const a8Scraper = new A8NetDailyScraper(
            {
              username: process.env.A8NET_USERNAME,
              password: process.env.A8NET_PASSWORD,
            },
            {
              headless: true,
              month: String(now.getMonth() + 1),
              mediaId,
              accountItemId,
              aspId: asp.id,
            }
          );
          await a8Scraper.initialize();
          await a8Scraper.login();
          await a8Scraper.navigateToDailyReport();
          const a8Data = await a8Scraper.scrapeDailyData();
          await a8Scraper.saveToDatabase(a8Data);
          await a8Scraper.close();
          console.log(`✅ A8.net: ${a8Data.length}件のデータを保存`);
          break;

        case 'もしもアフィリエイト':
          if (!process.env.MOSHIMO_USERNAME || !process.env.MOSHIMO_PASSWORD) {
            console.log('⚠️  もしもアフィリエイトの認証情報が設定されていません');
            break;
          }
          const moshimoScraper = new MoshimoDailyScraper(
            {
              username: process.env.MOSHIMO_USERNAME,
              password: process.env.MOSHIMO_PASSWORD,
            },
            {
              headless: true,
              startYearMonth: currentYearMonth,
              endYearMonth: currentYearMonth,
              mediaId,
              accountItemId,
              aspId: asp.id,
            }
          );
          await moshimoScraper.initialize();
          await moshimoScraper.login();
          const moshimoData = await moshimoScraper.scrapeAllMonths();
          await moshimoScraper.saveToDatabase(moshimoData);
          await moshimoScraper.close();
          console.log(`✅ もしもアフィリエイト: ${moshimoData.length}件のデータを保存`);
          break;

        case 'Link-AG':
          if (!process.env.LINKAG_USERNAME || !process.env.LINKAG_PASSWORD) {
            console.log('⚠️  Link-AGの認証情報が設定されていません');
            break;
          }
          const linkagScraper = new LinkAGDailyScraper(
            {
              username: process.env.LINKAG_USERNAME,
              password: process.env.LINKAG_PASSWORD,
            },
            {
              headless: true,
              startYearMonth: currentYearMonth,
              endYearMonth: currentYearMonth,
              mediaId,
              accountItemId,
              aspId: asp.id,
            }
          );
          await linkagScraper.initialize();
          await linkagScraper.login();
          const linkagData = await linkagScraper.scrapeAllMonths();
          await linkagScraper.saveToDatabase(linkagData);
          await linkagScraper.close();
          console.log(`✅ Link-AG: ${linkagData.length}件のデータを保存`);
          break;

        case 'felmat':
          if (!process.env.FELMAT_USERNAME || !process.env.FELMAT_PASSWORD) {
            console.log('⚠️  felmatの認証情報が設定されていません');
            break;
          }
          const felmatScraper = new FelmatDailyScraper(
            {
              username: process.env.FELMAT_USERNAME,
              password: process.env.FELMAT_PASSWORD,
            },
            {
              headless: true,
              startYearMonth: currentYearMonth,
              endYearMonth: currentYearMonth,
              mediaId,
              accountItemId,
              aspId: asp.id,
            }
          );
          await felmatScraper.initialize();
          await felmatScraper.login();
          const felmatData = await felmatScraper.scrapeAllMonths();
          await felmatScraper.saveToDatabase(felmatData);
          await felmatScraper.close();
          console.log(`✅ felmat: ${felmatData.length}件のデータを保存`);
          break;
      }
    } catch (error) {
      console.error(`❌ ${asp.name} でエラーが発生しました:`, error);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n✅ すべてのASPのデータ取得が完了しました！');
}

updateAllAsps().catch(console.error);
