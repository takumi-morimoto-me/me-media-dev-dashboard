/**
 * 全ASPの月次スクレイパーを修正するスクリプト
 *
 * 問題: 多くの月次スクレイパーが日次スクレイパーを誤用しており、以下のエラーが発生:
 * - extractDailyData is not a function (正しくは scrapeDailyData)
 * - is not a constructor
 * - Module not found
 *
 * 解決策: 日次スクレイパーのメソッド名を修正し、月次用のラッパーメソッドを追加
 */

import * as fs from 'fs';
import * as path from 'path';

const ASP_LIST = [
  'a8app', 'accesstrade', 'afb', 'amazon', 'castalk', 'circuitx',
  'dmm', 'docomo-affiliate', 'felmat', 'imobile', 'janet', 'linkag',
  'linkshare', 'moshimo', 'presco', 'ratelad', 'rentracks', 'skyflag',
  'slvrbullet', 'smaad', 'smartc', 'tg-affiliate', 'ultiga',
  'valuecommerce', 'zucks'
];

async function fixMonthlyScrapers() {
  console.log('🔧 月次スクレイパーの修正を開始します...\n');

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const asp of ASP_LIST) {
    console.log(`📝 ${asp} を処理中...`);

    const monthlyPath = path.join(process.cwd(), 'src/scripts/asp/monthly', asp, 'index.ts');
    const dailyPath = path.join(process.cwd(), 'src/scripts/asp/daily', asp, 'index.ts');

    // 月次スクレイパーが存在するか確認
    if (!fs.existsSync(monthlyPath)) {
      console.log(`  ⚠️  月次スクレイパーが存在しません`);
      skipped++;
      continue;
    }

    // 日次スクレイパーが存在するか確認
    if (!fs.existsSync(dailyPath)) {
      console.log(`  ⚠️  日次スクレイパーが存在しません`);
      skipped++;
      continue;
    }

    try {
      // 日次スクレイパーを読み込み
      let dailyContent = fs.readFileSync(dailyPath, 'utf-8');

      // scrapeDailyData メソッドに extractDailyData エイリアスを追加
      if (dailyContent.includes('async scrapeDailyData()') && !dailyContent.includes('async extractDailyData()')) {
        // scrapeDailyData の直後に extractDailyData エイリアスを追加
        const scrapeDailyDataMatch = dailyContent.match(/(async scrapeDailyData\(\)[^{]*{[\s\S]*?^  })/m);

        if (scrapeDailyDataMatch) {
          const insertPosition = dailyContent.indexOf(scrapeDailyDataMatch[0]) + scrapeDailyDataMatch[0].length;

          const aliasMethod = `\n\n  // Alias for monthly scrapers\n  async extractDailyData() {\n    return await this.scrapeDailyData();\n  }`;

          dailyContent = dailyContent.slice(0, insertPosition) + aliasMethod + dailyContent.slice(insertPosition);

          fs.writeFileSync(dailyPath, dailyContent);
          console.log(`  ✅ extractDailyData() エイリアスを追加`);
          fixed++;
        } else {
          console.log(`  ⚠️  scrapeDailyData メソッドが見つかりません`);
          skipped++;
        }
      } else if (dailyContent.includes('async extractDailyData()')) {
        console.log(`  ℹ️  既に extractDailyData() が存在します`);
        skipped++;
      } else {
        console.log(`  ⚠️  scrapeDailyData メソッドが見つかりません`);
        skipped++;
      }

      // saveToSupabase メソッドも確認して追加（存在しない場合）
      if (!dailyContent.includes('async saveToSupabase(')) {
        const saveToDatabase = dailyContent.match(/async saveToDatabase\([^)]*\)[^{]*{[\s\S]*?^  }/m);

        if (saveToDatabase) {
          const insertPosition = dailyContent.indexOf(saveToDatabase[0]) + saveToDatabase[0].length;

          const aliasMethod = `\n\n  // Alias for monthly scrapers\n  async saveToSupabase(data: DailyData[]) {\n    return await this.saveToDatabase(data);\n  }`;

          dailyContent = dailyContent.slice(0, insertPosition) + aliasMethod + dailyContent.slice(insertPosition);

          fs.writeFileSync(dailyPath, dailyContent);
          console.log(`  ✅ saveToSupabase() エイリアスを追加`);
        }
      }

      // 日次スクレイパーの自動実行を防ぐ (main() の直接呼び出しを修正)
      if (dailyContent.match(/^main\(\);$/m)) {
        dailyContent = dailyContent.replace(/^main\(\);$/m, `if (require.main === module) {\n  main();\n}`);
        fs.writeFileSync(dailyPath, dailyContent);
        console.log(`  ✅ 自動実行を防止（require.main チェック追加）`);
      }

    } catch (error) {
      console.error(`  ❌ エラー:`, error);
      errors++;
    }

    console.log('');
  }

  console.log('\n============================================================');
  console.log('📊 修正結果');
  console.log('============================================================');
  console.log(`✅ 修正完了: ${fixed}件`);
  console.log(`⚠️  スキップ: ${skipped}件`);
  console.log(`❌ エラー: ${errors}件`);
  console.log('============================================================\n');
}

fixMonthlyScrapers().catch(console.error);
