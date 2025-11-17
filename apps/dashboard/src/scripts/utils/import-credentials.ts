import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// 実装済みのASP（スクレイパーが既にある）
const IMPLEMENTED_ASPS = [
  'A8.net',
  'もしもアフィリエイト',
  'Link-AG',
  'felmat'
];

async function importCredentials() {
  console.log('🔐 認証情報をインポートします...\n');

  // ReReメディアを取得
  const { data: media, error: mediaError } = await supabase
    .from('media')
    .select('id, name')
    .eq('name', 'ReRe')
    .single();

  if (mediaError || !media) {
    console.error('❌ ReReメディアが見つかりません:', mediaError);
    return;
  }

  console.log(`✅ ReRe メディアID: ${media.id}\n`);

  // CSVファイルを読み込み
  const csvPath = path.join(process.cwd(), 'asp-credentials.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // CSVをパース
  const lines = csvContent.split('\n').filter(line => line.trim());
  const credentials: Array<{ asp_name: string; username: string; password: string }> = [];

  for (let i = 1; i < lines.length; i++) { // ヘッダーをスキップ
    const line = lines[i];

    // 引用符を考慮したパース
    const matches = line.match(/^([^,]+),([^,]+),(".*"|[^,]+)$/);
    if (matches) {
      const asp_name = matches[1].trim();
      const username = matches[2].trim();
      let password = matches[3].trim();

      // 引用符を削除
      if (password.startsWith('"') && password.endsWith('"')) {
        password = password.slice(1, -1);
      }

      credentials.push({ asp_name, username, password });
    }
  }

  console.log(`📊 CSVに含まれる認証情報: ${credentials.length}件\n`);

  // 実装済みASPと未実装ASPに分ける
  const implementedCreds = credentials.filter(c => IMPLEMENTED_ASPS.includes(c.asp_name));
  const notImplementedCreds = credentials.filter(c => !IMPLEMENTED_ASPS.includes(c.asp_name));

  console.log('✅ スクレイパー実装済み:');
  implementedCreds.forEach(c => console.log(`  - ${c.asp_name}`));

  console.log('\n⚠️  スクレイパー未実装（これから実装が必要）:');
  notImplementedCreds.forEach(c => console.log(`  - ${c.asp_name}`));

  console.log('\n🚀 認証情報をSupabaseに保存中...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const cred of credentials) {
    // ASPを検索
    const { data: aspData, error: aspError } = await supabase
      .from('asps')
      .select('id, name')
      .eq('name', cred.asp_name)
      .single();

    if (aspError || !aspData) {
      console.log(`⚠️  ${cred.asp_name} がaspsテーブルに見つかりません`);
      errorCount++;
      continue;
    }

    // 既存の認証情報を確認
    const { data: existingCred } = await supabase
      .from('asp_credentials')
      .select('id')
      .eq('asp_id', aspData.id)
      .eq('media_id', media.id)
      .single();

    if (existingCred) {
      // 更新
      const { error: updateError } = await supabase
        .from('asp_credentials')
        .update({
          username_secret_key: cred.username,
          password_secret_key: cred.password,
        })
        .eq('asp_id', aspData.id)
        .eq('media_id', media.id);

      if (updateError) {
        console.error(`❌ ${cred.asp_name} の更新に失敗:`, updateError.message);
        errorCount++;
      } else {
        console.log(`✅ ${cred.asp_name} を更新`);
        successCount++;
      }
    } else {
      // 新規追加
      const { error: insertError } = await supabase
        .from('asp_credentials')
        .insert({
          asp_id: aspData.id,
          media_id: media.id,
          username_secret_key: cred.username,
          password_secret_key: cred.password,
        });

      if (insertError) {
        console.error(`❌ ${cred.asp_name} の追加に失敗:`, insertError.message);
        errorCount++;
      } else {
        console.log(`✅ ${cred.asp_name} を追加`);
        successCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ 成功: ${successCount}件`);
  console.log(`❌ エラー: ${errorCount}件`);

  console.log('\n💡 次のステップ:');
  console.log('未実装のASPについて、スクレイパーを実装する必要があります。');
  console.log('優先度の高いASPから順に実装していきましょう。');
}

importCredentials().catch(console.error);
