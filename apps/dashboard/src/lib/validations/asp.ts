import { z } from "zod";

// メディア別認証情報のスキーマ
export const aspCredentialSchema = z.object({
  media_id: z.string().uuid(),
  username_secret_key: z.string().optional(),
  password_secret_key: z.string().optional(),
});

// ASPフォームのバリデーションスキーマ
export const aspFormSchema = z.object({
  name: z.string().min(1, { message: "ASP名は必須です。" }),
  login_url: z.string().url({ message: "有効なURLを入力してください。" }),
  prompt: z.string(),
  credentials: z.array(aspCredentialSchema).min(1, { message: "少なくとも1つのメディアを選択してください。" }),
});

// 部分更新用のスキーマ
export const aspUpdateSchema = z.object({
  name: z.string().min(1, { message: "ASP名は必須です。" }).optional(),
  login_url: z.string().url({ message: "有効なURLを入力してください。" }).optional(),
  prompt: z.string().optional(),
  category: z.string().optional(),
  is_active: z.boolean().optional(),
});

export type AspCredential = z.infer<typeof aspCredentialSchema>;
export type AspFormValues = z.infer<typeof aspFormSchema>;
export type AspUpdateValues = z.infer<typeof aspUpdateSchema>;
