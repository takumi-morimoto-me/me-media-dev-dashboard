#!/usr/bin/env tsx
/**
 * ASP認証情報CSVマージスクリプト
 *
 * affiliate-services.csvのASPリストをベースに、
 * asp-credentials.csvから認証情報を取得して新しいCSVを作成
 */

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd(), '../../');
const REFERENCE_DIR = path.join(PROJECT_ROOT, 'reference');
const OLD_CREDENTIALS_FILE = path.join(REFERENCE_DIR, 'asp-credentials-old.csv');
const NEW_SERVICES_FILE = path.join(REFERENCE_DIR, 'affiliate-services.csv');
const OUTPUT_FILE = path.join(REFERENCE_DIR, 'asp-credentials.csv');

interface OldCredential {
  カテゴリ: string;
  サービス名: string;
  ID: string;
  PW: string;
  URL: string;
}

interface NewService {
  サービス名: string;
  URL: string;
}

interface MergedCredential {
  サービス名: string;
  ID: string;
  PW: string;
  URL: string;
}

/**
 * CSVを読み込んでパース
 */
function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = values[index]?.trim() || '';
    });
    return obj;
  });
}

/**
 * サービス名を正規化（比較用）
 */
function normalizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/（.+?）/g, '') // 全角括弧内を削除
    .replace(/\(.+?\)/g, '')  // 半角括弧内を削除
    .replace(/\s+/g, '')       // 空白を削除
    .replace(/アフィリエイト/g, '')
    .trim();
}

/**
 * サービス名でマッチング
 */
function findMatchingCredential(
  serviceName: string,
  credentials: OldCredential[]
): OldCredential | undefined {
  const normalized = normalizeServiceName(serviceName);

  return credentials.find(cred => {
    const credNormalized = normalizeServiceName(cred.サービス名);
    return credNormalized.includes(normalized) || normalized.includes(credNormalized);
  });
}

async function main() {
  console.log('🔄 ASP認証情報マージ処理を開始します...\n');

  // 既存の認証情報を読み込み
  console.log('📖 既存の認証情報を読み込み中...');
  const oldCredentials = parseCSV(OLD_CREDENTIALS_FILE) as OldCredential[];
  console.log(`   ${oldCredentials.length}件の認証情報を読み込みました\n`);

  // 新しいサービスリストを読み込み
  console.log('📖 新しいサービスリストを読み込み中...');
  const newServices = parseCSV(NEW_SERVICES_FILE) as NewService[];
  console.log(`   ${newServices.length}件のサービスを読み込みました\n`);

  // マッチング処理
  console.log('🔍 サービスをマッチング中...\n');
  const mergedData: MergedCredential[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;

  newServices.forEach(service => {
    const matchedCred = findMatchingCredential(service.サービス名, oldCredentials);

    if (matchedCred) {
      mergedData.push({
        サービス名: service.サービス名,
        ID: matchedCred.ID,
        PW: matchedCred.PW,
        URL: service.URL,
      });
      console.log(`✅ ${service.サービス名} -> マッチ (${matchedCred.サービス名})`);
      matchedCount++;
    } else {
      mergedData.push({
        サービス名: service.サービス名,
        ID: '',
        PW: '',
        URL: service.URL,
      });
      console.log(`⚠️  ${service.サービス名} -> 認証情報なし`);
      unmatchedCount++;
    }
  });

  console.log(`\n📊 マッチング結果:`);
  console.log(`   マッチ: ${matchedCount}件`);
  console.log(`   未マッチ: ${unmatchedCount}件`);
  console.log(`   合計: ${mergedData.length}件\n`);

  // CSVに書き出し
  console.log('💾 新しいCSVファイルを作成中...');
  const csvContent = [
    'サービス名,ID,PW,URL',
    ...mergedData.map(item =>
      `${item.サービス名},${item.ID},${item.PW},${item.URL}`
    )
  ].join('\n');

  fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf-8');
  console.log(`   ✅ ${OUTPUT_FILE} を作成しました\n`);

  // 古いファイルを削除
  console.log('🗑️  古いファイルを削除中...');
  fs.unlinkSync(OLD_CREDENTIALS_FILE);
  console.log(`   ✅ ${OLD_CREDENTIALS_FILE} を削除しました\n`);

  console.log('🎉 完了しました！');
}

main().catch(error => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});
