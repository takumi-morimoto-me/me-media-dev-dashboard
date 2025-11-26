import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings/settings-client";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();

  // Fetch current fiscal year start month setting
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'fiscal_year_start_month')
    .single();

  const fiscalYearStartMonth = setting?.value ? parseInt(setting.value) : 6;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">設定</h1>
      <SettingsClient fiscalYearStartMonth={fiscalYearStartMonth} />
    </div>
  );
}
