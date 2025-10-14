import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface AccountItemRow {
  parent_name: string;
  child_name: string;
  display_order: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { mediaId, items } = await request.json() as {
      mediaId: string;
      items: AccountItemRow[];
    };

    if (!mediaId || mediaId === 'all') {
      return NextResponse.json(
        { error: 'Valid media ID is required' },
        { status: 400 }
      );
    }

    // Step 1: Delete existing account items for this media
    const { error: deleteError } = await supabase
      .from('account_items')
      .delete()
      .eq('media_id', mediaId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete existing items' },
        { status: 500 }
      );
    }

    // Step 2: Group items by parent
    const parentMap = new Map<string, AccountItemRow[]>();
    items.forEach(item => {
      if (!parentMap.has(item.parent_name)) {
        parentMap.set(item.parent_name, []);
      }
      parentMap.get(item.parent_name)!.push(item);
    });

    // Step 3: Insert parent items and their children
    const parentIds = new Map<string, string>();

    for (const [parentName, children] of parentMap.entries()) {
      // Insert parent
      const { data: parentData, error: parentError } = await supabase
        .from('account_items')
        .insert({
          name: parentName,
          parent_id: null,
          media_id: mediaId,
          display_order: Math.min(...children.map(c => c.display_order)),
        })
        .select('id')
        .single();

      if (parentError || !parentData) {
        console.error('Parent insert error:', parentError);
        return NextResponse.json(
          { error: `Failed to insert parent: ${parentName}` },
          { status: 500 }
        );
      }

      parentIds.set(parentName, parentData.id);

      // Insert children
      const childrenToInsert = children.map(child => ({
        name: child.child_name,
        parent_id: parentData.id,
        media_id: mediaId,
        display_order: child.display_order,
      }));

      const { error: childrenError } = await supabase
        .from('account_items')
        .insert(childrenToInsert);

      if (childrenError) {
        console.error('Children insert error:', childrenError);
        return NextResponse.json(
          { error: `Failed to insert children for: ${parentName}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
