import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Define the structure of the incoming request body
interface ImportItem {
  parent: string;
  account_item: string;
  values: {
    year: number;
    month: number;
    budget: number | null;
    actual: number | null;
  }[];
}

interface RequestBody {
  mediaId: string;
  items: ImportItem[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { mediaId, items } = (await request.json()) as RequestBody;

    if (!mediaId || mediaId === 'all') {
      return NextResponse.json(
        { error: 'A valid media ID is required.' },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items to import.' },
        { status: 400 }
      );
    }

    // Call a single database function to handle the entire upsert process transactionally.
    const { error } = await supabase.rpc('import_financial_data', {
      p_media_id: mediaId,
      p_items: items,
    });

    if (error) {
      console.error('RPC import_financial_data error:', error);
      return NextResponse.json(
        { error: `Database import failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Import Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}