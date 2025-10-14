import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { name, slug } = await request.json();

    if (!name || !slug) {
      return NextResponse.json(
        { message: "メディア名とスラッグは必須です" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Insert media
    const { data, error } = await supabase
      .from("media")
      .insert({ name, slug })
      .select()
      .single();

    if (error) {
      console.error("Error creating media:", error);
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/media:", error);
    return NextResponse.json(
      { message: "メディアの作成に失敗しました" },
      { status: 500 }
    );
  }
}
