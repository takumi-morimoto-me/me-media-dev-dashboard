import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface CsvService {
  name: string;
  url: string;
}

async function addServicesFromCsv() {
  console.log('📋 CSVからサービスを追加します...\n');

  // ReReメディアを取得
  const { data: media, error: mediaError } = await supabase
    .from('media')
    .select('id, name')
    .eq('name', 'ReRe')
    .single();

  if (mediaError || !media) {
    console.error('❌ ReReメディアが見つかりません:', mediaError);
    console.log('💡 先にReReメディアを作成してください。');
    return;
  }

  console.log(`✅ ReRe メディアID: ${media.id}\n`);

  // CSVファイルを読み込み
  const csvPath = path.join(process.cwd(), '../../reference/affiliate-services.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // CSVをパース
  const lines = csvContent.split('\n').filter(line => line.trim());
  const services: CsvService[] = [];

  for (let i = 1; i < lines.length; i++) { // ヘッダーをスキップ
    const [name, url] = lines[i].split(',');
    if (name && url) {
      services.push({
        name: name.trim(),
        url: url.trim()
      });
    }
  }

  console.log(`📊 CSVに含まれるサービス: ${services.length}件\n`);

  // 現在登録されているサービスを取得
  const { data: existingAsps, error: aspsError } = await supabase
    .from('asps')
    .select('name');

  if (aspsError) {
    console.error('❌ 既存サービスの取得に失敗しました:', aspsError);
    return;
  }

  const existingNames = new Set(existingAsps?.map(asp => asp.name) || []);
  console.log(`✅ 既に登録されているサービス: ${existingNames.size}件`);
  existingNames.forEach(name => console.log(`  - ${name}`));

  // 未登録のサービスを特定
  const newServices = services.filter(service => !existingNames.has(service.name));

  console.log(`\n📥 追加するサービス: ${newServices.length}件`);
  newServices.forEach(service => console.log(`  - ${service.name}`));

  if (newServices.length === 0) {
    console.log('\n✅ すべてのサービスが既に登録されています。');
    return;
  }

  console.log('\n🚀 サービスを追加中...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const service of newServices) {
    // サービスを追加
    const { data: aspData, error: aspError } = await supabase
      .from('asps')
      .insert({
        name: service.name,
        login_url: service.url,
        prompt: null,
      })
      .select()
      .single();

    if (aspError || !aspData) {
      console.error(`❌ ${service.name} の追加に失敗:`, aspError?.message);
      errorCount++;
      continue;
    }

    // ReReメディアに紐付ける
    const { error: credError } = await supabase
      .from('asp_credentials')
      .insert({
        asp_id: aspData.id,
        media_id: media.id,
        username_secret_key: null,
        password_secret_key: null,
      });

    if (credError) {
      console.error(`❌ ${service.name} の認証情報追加に失敗:`, credError.message);
      // サービスは追加されたが認証情報の追加に失敗した場合、サービスを削除
      await supabase.from('asps').delete().eq('id', aspData.id);
      errorCount++;
      continue;
    }

    console.log(`✅ ${service.name}`);
    successCount++;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ 追加完了: ${successCount}件`);
  console.log(`❌ エラー: ${errorCount}件`);
  console.log(`\n📊 合計サービス数: ${existingNames.size + successCount}件`);
}

addServicesFromCsv().catch(console.error);
