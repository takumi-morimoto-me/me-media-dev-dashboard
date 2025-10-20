"use server";

import { createClient } from "@/lib/supabase/server";
import { aspFormSchema, aspUpdateSchema, type AspFormValues, type AspUpdateValues } from "@/lib/validations/asp";
import { revalidatePath } from "next/cache";

export async function createAsp(values: AspFormValues) {
  const supabase = await createClient();

  // サーバーサイドでのバリデーション
  const validatedFields = aspFormSchema.safeParse(values);
  if (!validatedFields.success) {
    return {
      error: "無効なデータです。",
    };
  }

  const { name, login_url, prompt, credentials } = validatedFields.data;

  // 1. aspsテーブルにASP基本情報を挿入
  const { data: aspData, error: aspError } = await supabase
    .from("asps")
    .insert({
      name,
      login_url,
      prompt,
    })
    .select()
    .single();

  if (aspError || !aspData) {
    console.error("Error creating ASP:", aspError);
    return {
      error: "ASPの作成に失敗しました。",
    };
  }

  // 2. asp_credentialsテーブルにメディア別認証情報を挿入
  const credentialsToInsert = credentials.map(cred => ({
    asp_id: aspData.id,
    media_id: cred.media_id,
    username_secret_key: cred.username_secret_key || null,
    password_secret_key: cred.password_secret_key || null,
  }));

  const { error: credError } = await supabase
    .from("asp_credentials")
    .insert(credentialsToInsert);

  if (credError) {
    console.error("Error creating ASP credentials:", credError);
    // ASPは作成されたが認証情報の作成に失敗した場合、ASPも削除
    await supabase.from("asps").delete().eq("id", aspData.id);
    return {
      error: "認証情報の作成に失敗しました。",
    };
  }

  // キャッシュをクリアして一覧を更新
  revalidatePath("/dashboard/agent");

  return {
    data: "ASPを正常に作成しました。",
  };
}

export async function updateAsp(aspId: string, values: AspUpdateValues) {
  const supabase = await createClient();

  // サーバーサイドでのバリデーション
  const validatedFields = aspUpdateSchema.safeParse(values);
  if (!validatedFields.success) {
    return {
      error: "無効なデータです。",
    };
  }

  const { error } = await supabase
    .from("asps")
    .update(validatedFields.data)
    .eq("id", aspId);

  if (error) {
    console.error("Error updating ASP:", error);
    return {
      error: "ASPの更新に失敗しました。",
    };
  }

  // キャッシュをクリアして一覧を更新
  revalidatePath("/dashboard/agent");

  return {
    data: "ASPを正常に更新しました。",
  };
}

export async function deleteAsp(aspId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("asps")
    .delete()
    .eq("id", aspId);

  if (error) {
    console.error("Error deleting ASP:", error);
    return {
      error: "ASPの削除に失敗しました。",
    };
  }

  // キャッシュをクリアして一覧を更新
  revalidatePath("/dashboard/agent");

  return {
    data: "ASPを正常に削除しました。",
  };
}

export async function bulkDeleteAsps(aspIds: string[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("asps")
    .delete()
    .in("id", aspIds);

  if (error) {
    console.error("Error bulk deleting ASPs:", error);
    return {
      error: "ASPの一括削除に失敗しました。",
    };
  }

  // キャッシュをクリアして一覧を更新
  revalidatePath("/dashboard/agent");

  return {
    data: `${aspIds.length}件のASPを正常に削除しました。`,
  };
}

export async function updateAspMedias(aspId: string, mediaIds: string[]) {
  const supabase = await createClient();

  // 1. 既存のcredentialsを全削除
  const { error: deleteError } = await supabase
    .from("asp_credentials")
    .delete()
    .eq("asp_id", aspId);

  if (deleteError) {
    console.error("Error deleting credentials:", deleteError);
    return {
      error: "既存の認証情報の削除に失敗しました。",
    };
  }

  // 2. 新しいcredentialsを挿入
  if (mediaIds.length > 0) {
    const credentialsToInsert = mediaIds.map(mediaId => ({
      asp_id: aspId,
      media_id: mediaId,
      username_secret_key: null,
      password_secret_key: null,
    }));

    const { error: insertError } = await supabase
      .from("asp_credentials")
      .insert(credentialsToInsert);

    if (insertError) {
      console.error("Error inserting credentials:", insertError);
      return {
        error: "認証情報の作成に失敗しました。",
      };
    }
  }

  // キャッシュをクリアして一覧を更新
  revalidatePath("/dashboard/agent");

  return {
    data: "メディアを更新しました。",
  };
}
