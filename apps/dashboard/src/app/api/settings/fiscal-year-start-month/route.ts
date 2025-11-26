import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: NextRequest) {
  try {
    const { value } = await request.json();

    if (typeof value !== "number" || value < 1 || value > 12) {
      return NextResponse.json(
        { error: "Invalid month value. Must be between 1 and 12." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Upsert the setting
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "fiscal_year_start_month", value: value.toString() },
        { onConflict: "key" }
      );

    if (error) {
      console.error("Error updating fiscal year start month:", error);
      return NextResponse.json(
        { error: "Failed to update setting" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in fiscal-year-start-month API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
