import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const WORKING_ASPS = ['A8app', 'アクセストレード', 'CASTALK', 'i-mobile', 'アルテガアフィリエイト', 'バリューコマース'];

const NAME_TO_FILENAME: Record<string, string> = {
  'A8app': 'a8app',
  'アクセストレード': 'accesstrade',
  'CASTALK': 'castalk',
  'i-mobile': 'imobile',
  'アルテガアフィリエイト': 'ultiga',
  'バリューコマース': 'valuecommerce'
};

async function main() {
  console.log('🔍 動作中のASPプロンプトを取得中...\n');

  const { data: asps, error } = await supabase
    .from('asps')
    .select('name, prompt, login_url, category')
    .in('name', WORKING_ASPS);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  const outputDir = '/Users/t.morimoto/Desktop/me-media-dev-dashboard/apps/mcp-agent/scripts/scenarios/working';

  for (const asp of asps || []) {
    const slug = NAME_TO_FILENAME[asp.name] || asp.name.toLowerCase().replace(/\s+/g, '-');
    const filename = `${slug}.txt`;
    const filepath = join(outputDir, filename);

    const content = asp.prompt || 'プロンプトが見つかりません';

    writeFileSync(filepath, content, 'utf-8');
    console.log(`✅ ${asp.name}: ${filepath}`);
    console.log(`   カテゴリ: ${asp.category || 'なし'}`);
    console.log(`   ログインURL: ${asp.login_url || 'なし'}`);
    console.log(`   プロンプト長: ${content.length}文字\n`);
  }

  console.log(`\n📦 ${asps?.length || 0}個のプロンプトを保存しました`);
}

main();
