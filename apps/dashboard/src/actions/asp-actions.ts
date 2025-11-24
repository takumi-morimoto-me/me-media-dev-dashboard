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

// CSV一括登録のための型定義
export interface CsvImportRow {
  name: string;
  login_url: string;
  username?: string;
  password?: string;
  prompt?: string;
  media_name?: string;
  content_type?: string;
}

export interface CsvImportResult {
  success: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string; data?: CsvImportRow }>;
}

export async function bulkImportAspsFromCsv(rows: CsvImportRow[]): Promise<{ data?: CsvImportResult; error?: string }> {
  const supabase = await createClient();

  const result: CsvImportResult = {
    success: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // ASP名でグループ化して処理
  const aspGroups = new Map<string, CsvImportRow[]>();
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;

    if (!aspGroups.has(name)) {
      aspGroups.set(name, []);
    }
    aspGroups.get(name)!.push(row);
  }

  let rowNumber = 2; // ヘッダー行を考慮して+2

  for (const [, aspRows] of aspGroups.entries()) {
    // 最初の行からASP基本情報を取得
    const firstRow = aspRows[0];

    // バリデーション
    if (!firstRow.name || !firstRow.name.trim()) {
      result.errors.push({
        row: rowNumber,
        message: "サービス名が空です",
        data: firstRow,
      });
      result.skipped++;
      rowNumber += aspRows.length;
      continue;
    }

    if (!firstRow.login_url || !firstRow.login_url.trim()) {
      result.errors.push({
        row: rowNumber,
        message: "ログインURLが空です",
        data: firstRow,
      });
      result.skipped++;
      rowNumber += aspRows.length;
      continue;
    }

    const aspData = {
      name: firstRow.name.trim(),
      login_url: firstRow.login_url.trim(),
      prompt: firstRow.prompt?.trim() || null,
    };

    // 既存のASPを確認
    const { data: existingAsps, error: searchError } = await supabase
      .from("asps")
      .select("id, name")
      .eq("name", aspData.name);

    if (searchError) {
      result.errors.push({
        row: rowNumber,
        message: `検索エラー: ${searchError.message}`,
        data: firstRow,
      });
      rowNumber += aspRows.length;
      continue;
    }

    let aspId: string;

    if (existingAsps && existingAsps.length > 0) {
      // 既存のASPを更新
      aspId = existingAsps[0].id;
      const { error: updateError } = await supabase
        .from("asps")
        .update({
          login_url: aspData.login_url,
          prompt: aspData.prompt,
        })
        .eq("id", aspId);

      if (updateError) {
        result.errors.push({
          row: rowNumber,
          message: `更新エラー: ${updateError.message}`,
          data: firstRow,
        });
        rowNumber += aspRows.length;
        continue;
      }
      result.updated++;
    } else {
      // 新規ASPを登録
      const { data: insertedAsp, error: insertError } = await supabase
        .from("asps")
        .insert([aspData])
        .select("id")
        .single();

      if (insertError || !insertedAsp) {
        result.errors.push({
          row: rowNumber,
          message: `登録エラー: ${insertError?.message || "ASPの登録に失敗しました"}`,
          data: firstRow,
        });
        rowNumber += aspRows.length;
        continue;
      }
      aspId = insertedAsp.id;
      result.success++;
    }

    // 各行の認証情報を処理
    for (const row of aspRows) {
      const currentRowNumber = rowNumber++;

      // media_name, username, password が全て指定されているかチェック
      const hasMediaName = row.media_name && row.media_name.trim();
      const hasUsername = row.username && row.username.trim();
      const hasPassword = row.password && row.password.trim();

      // 認証情報が部分的に指定されている場合はスキップ
      if (!hasMediaName && !hasUsername && !hasPassword) {
        // 全て空の場合はスキップ（エラーにしない）
        continue;
      }

      // media_nameのみ必須チェック
      if (!hasMediaName || !row.media_name) {
        result.errors.push({
          row: currentRowNumber,
          message: "認証情報を登録する場合、media_nameは必須です",
          data: row,
        });
        continue;
      }

      const mediaNameValue = row.media_name.trim();

      // メディア名からメディアIDを検索
      const { data: mediaData, error: mediaError } = await supabase
        .from("media")
        .select("id")
        .eq("name", mediaNameValue)
        .single();

      if (mediaError || !mediaData) {
        result.errors.push({
          row: currentRowNumber,
          message: `指定されたメディアが見つかりません: ${mediaNameValue}`,
          data: row,
        });
        continue;
      }

      const mediaIdValue = mediaData.id;

      // 既存の認証情報を確認
      const { data: existingCreds, error: credSearchError } = await supabase
        .from("asp_credentials")
        .select("id")
        .eq("asp_id", aspId)
        .eq("media_id", mediaIdValue);

      if (credSearchError) {
        result.errors.push({
          row: currentRowNumber,
          message: `認証情報の検索エラー: ${credSearchError.message}`,
          data: row,
        });
        continue;
      }

      const credData = {
        asp_id: aspId,
        media_id: mediaIdValue,
        username_secret_key: hasUsername && row.username ? row.username.trim() : null,
        password_secret_key: hasPassword && row.password ? row.password.trim() : null,
      };

      if (existingCreds && existingCreds.length > 0) {
        // 既存の認証情報を更新
        const { error: updateCredError } = await supabase
          .from("asp_credentials")
          .update({
            username_secret_key: credData.username_secret_key,
            password_secret_key: credData.password_secret_key,
          })
          .eq("asp_id", aspId)
          .eq("media_id", mediaIdValue);

        if (updateCredError) {
          result.errors.push({
            row: currentRowNumber,
            message: `認証情報の更新エラー: ${updateCredError.message}`,
            data: row,
          });
        }
      } else {
        // 新規認証情報を登録
        const { error: insertCredError } = await supabase
          .from("asp_credentials")
          .insert([credData]);

        if (insertCredError) {
          result.errors.push({
            row: currentRowNumber,
            message: `認証情報の登録エラー: ${insertCredError.message}`,
            data: row,
          });
        }
      }
    }
  }

  // キャッシュをクリアして一覧を更新
  revalidatePath("/dashboard/agent");

  return { data: result };
}

export async function exportAspsAsCsv(): Promise<{ data?: string; error?: string }> {
  const supabase = await createClient();

  // ASPと認証情報を取得
  const { data: asps, error: aspsError } = await supabase
    .from("asps")
    .select("id, name, login_url, prompt")
    .order("created_at", { ascending: true });

  if (aspsError) {
    return { error: "ASPデータの取得に失敗しました。" };
  }

  // 認証情報をメディア情報と結合して取得
  const { data: credentials, error: credError } = await supabase
    .from("asp_credentials")
    .select("asp_id, media_id, username_secret_key, password_secret_key, media(name)");

  if (credError) {
    return { error: "認証情報の取得に失敗しました。" };
  }

  // CSVヘッダー
  let csvContent = "name,login_url,username,password,prompt,media_name,content_type\n";

  // データ行を追加
  if (asps && asps.length > 0) {
    for (const asp of asps) {
      const name = (asp.name || "").replace(/,/g, "，"); // カンマをエスケープ
      const loginUrl = (asp.login_url || "").replace(/,/g, "，");
      const prompt = (asp.prompt || "").replace(/,/g, "，");

      // このASPに紐づく認証情報を取得
      const aspCredentials = credentials?.filter(c => c.asp_id === asp.id) || [];

      if (aspCredentials.length > 0) {
        // 認証情報がある場合、各メディアごとに行を出力
        for (const cred of aspCredentials) {
          const mediaName = (cred.media && typeof cred.media === 'object' && 'name' in cred.media)
            ? cred.media.name
            : "";
          const username = (cred.username_secret_key || "").replace(/,/g, "，");
          const password = (cred.password_secret_key || "").replace(/,/g, "，");
          const contentType = ""; // content_typeは現在DBに保存されていないため空

          csvContent += `${name},${loginUrl},${username},${password},${prompt},${mediaName},${contentType}\n`;
        }
      } else {
        // 認証情報がない場合、基本情報のみ出力
        csvContent += `${name},${loginUrl},,,${prompt},,\n`;
      }
    }
  }

  return { data: csvContent };
}
