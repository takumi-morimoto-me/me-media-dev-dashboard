"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { aspFormSchema } from "@/components/agent/asp-form";
import { revalidatePath } from "next/cache";

export async function createAsp(values: z.infer<typeof aspFormSchema>) {
  const supabase = await createClient();

  // サーバーサイドでのバリデーション
  const validatedFields = aspFormSchema.safeParse(values);
  if (!validatedFields.success) {
    return {
      error: "無効なデータです。",
    };
  }

  const { name, login_url, media_id, prompt } = validatedFields.data;

  const { error } = await supabase.from("asps").insert({
    name,
    login_url,
    media_id,
    prompt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error creating ASP:", error);
    return {
      error: "ASPの作成に失敗しました。",
    };
  }

  // キャッシュをクリアして一覧を更新
  revalidatePath("/dashboard/agent");

  return {
    data: "ASPを正常に作成しました。",
  };
}
