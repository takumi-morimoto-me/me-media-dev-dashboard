import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RequestBody {
  accountItemId: string;
  mediaId: string;
  date: string; // YYYY-MM-DD format
  amount: number;
  type: 'budget' | 'actual';
  displayUnit: 'monthly' | 'weekly' | 'daily';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = (await request.json()) as RequestBody;
    const { accountItemId, mediaId, date, amount, type, displayUnit } = body;

    if (!accountItemId || !mediaId || !date) {
      return NextResponse.json(
        { error: 'accountItemId, mediaId, and date are required.' },
        { status: 400 }
      );
    }

    // Check if this account item is an affiliate item (should not be editable)
    const { data: accountItem, error: accountItemError } = await supabase
      .from('account_items')
      .select('name')
      .eq('id', accountItemId)
      .single();

    if (accountItemError || !accountItem) {
      return NextResponse.json(
        { error: 'Account item not found.' },
        { status: 404 }
      );
    }

    if (accountItem.name.includes('アフィリエイト')) {
      return NextResponse.json(
        { error: 'Affiliate items cannot be manually edited.' },
        { status: 403 }
      );
    }

    // Determine which table to use based on displayUnit
    const tableName = displayUnit === 'monthly' ? 'actuals' : 'daily_actuals';
    const columnName = type === 'budget' ? 'budget' : 'amount';

    // For monthly data, use the end of month date
    let targetDate = date;
    if (displayUnit === 'monthly') {
      // Convert to end of month
      const [year, month] = date.split('-').map(Number);
      const endOfMonth = new Date(year, month, 0);
      targetDate = endOfMonth.toISOString().split('T')[0];
    }

    // Upsert the data (without asp_id for non-affiliate items)
    const upsertData: Record<string, unknown> = {
      date: targetDate,
      media_id: mediaId,
      account_item_id: accountItemId,
      [columnName]: amount,
    };

    // For actuals table, we need asp_id (set to null for manual entries)
    // But the constraint requires asp_id, so we need to handle this differently
    // We'll use a special "manual" entry approach - update existing or insert with null asp_id

    const { data: existingData, error: fetchError } = await supabase
      .from(tableName)
      .select('id')
      .eq('date', targetDate)
      .eq('media_id', mediaId)
      .eq('account_item_id', accountItemId)
      .is('asp_id', null)
      .maybeSingle();

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: `Database fetch failed: ${fetchError.message}` },
        { status: 500 }
      );
    }

    let error;
    if (existingData) {
      // Update existing record
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ [columnName]: amount })
        .eq('id', existingData.id);
      error = updateError;
    } else {
      // Insert new record with asp_id = null
      upsertData.asp_id = null;
      const { error: insertError } = await supabase
        .from(tableName)
        .insert(upsertData);
      error = insertError;
    }

    if (error) {
      console.error('Upsert error:', error);
      return NextResponse.json(
        { error: `Database update failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Update Cell Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
