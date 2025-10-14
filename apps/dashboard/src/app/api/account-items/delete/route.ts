import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { itemIds } = await request.json() as {
      itemIds: string[];
    };

    if (!itemIds || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'Item IDs are required' },
        { status: 400 }
      );
    }

    // Delete account items (this will cascade delete children and related budgets/actuals if foreign keys are set up correctly)
    const { error: deleteError } = await supabase
      .from('account_items')
      .delete()
      .in('id', itemIds);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete items' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
