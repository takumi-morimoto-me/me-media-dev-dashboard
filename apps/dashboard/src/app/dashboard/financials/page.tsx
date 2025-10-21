import { createClient } from "@/lib/supabase/server";
import FinancialsClient from "@/components/financials/financials-client";

export const dynamic = 'force-dynamic';

interface FinancialsPageProps {
  searchParams: Promise<{
    media?: string;
    year?: string;
  }>;
}

export default async function FinancialsPage({ searchParams }: FinancialsPageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  // Parallel fetch for settings, monthly data, daily data, account items, and ASP data
  const settingPromise = supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'fiscal_year_start_month')
    .single();

  const mediaParam = params.media || 'all';
  const year = params.year ? parseInt(params.year) : new Date().getFullYear();
  const mediaId = mediaParam === 'all' ? null : mediaParam;

  const monthlyDataPromise = supabase.rpc('get_financial_monthly_data', {
    p_media_id: mediaId,
    p_fiscal_year: year,
  });

  const dailyDataPromise = supabase.rpc('get_financial_daily_data', {
    p_media_id: mediaId,
    p_fiscal_year: year,
  });

  const aspMonthlyDataPromise = supabase.rpc('get_asp_monthly_data', {
    p_media_id: mediaId,
    p_fiscal_year: year,
  });

  const aspDailyDataPromise = supabase.rpc('get_asp_daily_data', {
    p_media_id: mediaId,
    p_fiscal_year: year,
  });

  const accountItemsPromise = mediaId
    ? supabase
        .from('account_items')
        .select('id, name, parent_id, display_order')
        .eq('media_id', mediaId)
    : supabase
        .from('account_items')
        .select('id, name, parent_id, display_order');

  const [
    { data: setting, error: settingError },
    { data: monthlyData, error: monthlyDataError },
    { data: dailyData, error: dailyDataError },
    { data: aspMonthlyData, error: aspMonthlyDataError },
    { data: aspDailyData, error: aspDailyDataError },
    { data: accountItems, error: accountItemsError }
  ] = await Promise.all([
    settingPromise,
    monthlyDataPromise,
    dailyDataPromise,
    aspMonthlyDataPromise,
    aspDailyDataPromise,
    accountItemsPromise
  ]);

  // Default to 6 if not set, but log the error
  const fiscalYearStartMonth = setting?.value ? parseInt(setting.value) : 6;
  if (settingError) {
    console.error("Error fetching fiscal year start month setting:", settingError);
  }

  if (monthlyDataError || dailyDataError || accountItemsError || aspMonthlyDataError || aspDailyDataError) {
    console.error("Error fetching page data:", { monthlyDataError, dailyDataError, accountItemsError, aspMonthlyDataError, aspDailyDataError });
    return (
      <FinancialsClient
        monthlyData={[]}
        dailyData={[]}
        aspMonthlyData={[]}
        aspDailyData={[]}
        accountItems={[]}
        fiscalYearStartMonth={fiscalYearStartMonth}
      />
    );
  }

  return (
    <FinancialsClient
      monthlyData={monthlyData || []}
      dailyData={dailyData || []}
      aspMonthlyData={aspMonthlyData || []}
      aspDailyData={aspDailyData || []}
      accountItems={accountItems || []}
      fiscalYearStartMonth={fiscalYearStartMonth}
    />
  );
}
