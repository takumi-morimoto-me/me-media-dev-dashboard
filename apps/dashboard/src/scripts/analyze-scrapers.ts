import * as fs from 'fs';
import * as path from 'path';

interface ScraperAnalysis {
  name: string;
  hasLogin: boolean;
  hasScrapeData: boolean;
  hasSaveToDatabase: boolean;
  hasCSVDownload: boolean;
  hasCredentials: boolean;
  lineCount: number;
  completeness: 'complete' | 'partial' | 'skeleton';
  notes: string[];
}

function analyzeScraperCode(scraperPath: string, name: string): ScraperAnalysis {
  const content = fs.readFileSync(scraperPath, 'utf-8');
  const lines = content.split('\n');

  const analysis: ScraperAnalysis = {
    name,
    hasLogin: false,
    hasScrapeData: false,
    hasSaveToDatabase: false,
    hasCSVDownload: false,
    hasCredentials: false,
    lineCount: lines.length,
    completeness: 'skeleton',
    notes: [],
  };

  // ログイン機能があるか
  if (content.includes('async login(') || content.includes('async function login')) {
    analysis.hasLogin = true;

    // ログイン実装が充実しているか
    if (content.includes('page.goto') && content.includes('fill') || content.includes('type')) {
      analysis.notes.push('ログイン実装あり');
    }
  }

  // データ取得機能があるか
  if (content.includes('scrapeDailyData') || content.includes('scrapeData') || content.includes('extractData')) {
    analysis.hasScrapeData = true;

    // データ取得の実装内容を確認
    if (content.includes('locator(') && content.includes('textContent')) {
      analysis.notes.push('DOM解析でデータ取得');
    }
  }

  // CSV ダウンロード機能があるか
  if (content.includes('downloadCSV') || content.includes('waitForEvent(\'download\')') || content.includes('download.saveAs')) {
    analysis.hasCSVDownload = true;
    analysis.notes.push('CSVダウンロード機能あり');
  }

  // データベース保存機能があるか
  if (content.includes('saveToDatabase') || content.includes('supabase') && content.includes('upsert')) {
    analysis.hasSaveToDatabase = true;

    if (content.includes('daily_actuals')) {
      analysis.notes.push('daily_actualsテーブルに保存');
    }
  }

  // 認証情報があるか
  if (content.includes('username:') || content.includes('email:') || content.includes('password:')) {
    analysis.hasCredentials = true;
  }

  // main関数が実装されているか
  const hasMainFunction = content.includes('async function main(') || content.includes('async function main()');
  const callsMain = content.includes('main()') || content.includes('await scraper.');

  // 完成度の判定
  if (analysis.hasLogin && analysis.hasScrapeData && analysis.hasSaveToDatabase && hasMainFunction) {
    analysis.completeness = 'complete';
  } else if ((analysis.hasLogin || analysis.hasCSVDownload) && (analysis.hasScrapeData || analysis.hasCSVDownload)) {
    analysis.completeness = 'partial';
  }

  // 特定のパターンをチェック
  if (content.includes('TODO') || content.includes('実装はレポートページの構造を確認してから')) {
    analysis.notes.push('未実装部分あり');
    analysis.completeness = 'partial';
  }

  if (content.includes('手動') || content.includes('manual')) {
    analysis.notes.push('手動操作が必要');
  }

  return analysis;
}

async function main() {
  const dailyScrapersPath = 'src/scripts/asp/daily';
  const scraperDirs = fs.readdirSync(dailyScrapersPath).filter(item => {
    const fullPath = path.join(dailyScrapersPath, item);
    return fs.statSync(fullPath).isDirectory();
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 スクレイパーコード分析');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const analyses: ScraperAnalysis[] = [];

  for (const dir of scraperDirs.sort()) {
    const indexPath = path.join(dailyScrapersPath, dir, 'index.ts');

    if (fs.existsSync(indexPath)) {
      const analysis = analyzeScraperCode(indexPath, dir);
      analyses.push(analysis);
    }
  }

  // 完成度別に集計
  const complete = analyses.filter(a => a.completeness === 'complete');
  const partial = analyses.filter(a => a.completeness === 'partial');
  const skeleton = analyses.filter(a => a.completeness === 'skeleton');

  console.log(`✅ 完成: ${complete.length}個`);
  console.log(`⚠️  部分実装: ${partial.length}個`);
  console.log(`❌ スケルトン: ${skeleton.length}個`);
  console.log(`📊 合計: ${analyses.length}個\n`);

  // 完成したスクレイパーの詳細
  if (complete.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 完成しているスクレイパー');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    complete.forEach(a => {
      console.log(`📦 ${a.name} (${a.lineCount}行)`);
      console.log(`   ✓ ログイン: ${a.hasLogin ? 'あり' : 'なし'}`);
      console.log(`   ✓ データ取得: ${a.hasScrapeData ? 'あり' : 'なし'}`);
      console.log(`   ✓ DB保存: ${a.hasSaveToDatabase ? 'あり' : 'なし'}`);
      console.log(`   ✓ CSV: ${a.hasCSVDownload ? 'あり' : 'なし'}`);
      if (a.notes.length > 0) {
        console.log(`   📝 ${a.notes.join(', ')}`);
      }
      console.log('');
    });
  }

  // 部分実装のスクレイパー
  if (partial.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  部分実装のスクレイパー');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    partial.forEach(a => {
      console.log(`📦 ${a.name} (${a.lineCount}行)`);
      console.log(`   ログイン: ${a.hasLogin ? '✓' : '✗'} | データ取得: ${a.hasScrapeData ? '✓' : '✗'} | DB保存: ${a.hasSaveToDatabase ? '✓' : '✗'} | CSV: ${a.hasCSVDownload ? '✓' : '✗'}`);
      if (a.notes.length > 0) {
        console.log(`   📝 ${a.notes.join(', ')}`);
      }
      console.log('');
    });
  }

  // スケルトンのスクレイパー
  if (skeleton.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ スケルトンのみのスクレイパー');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    skeleton.forEach(a => {
      console.log(`📦 ${a.name} (${a.lineCount}行)`);
      if (a.notes.length > 0) {
        console.log(`   📝 ${a.notes.join(', ')}`);
      }
    });
    console.log('');
  }

  // 結果をJSONファイルに保存
  const reportPath = 'scraper-analysis-results.json';
  fs.writeFileSync(reportPath, JSON.stringify(analyses, null, 2));
  console.log(`📄 詳細レポートを保存しました: ${reportPath}\n`);
}

main();
