# `asp-form.tsx` における react-hook-form の型エラー

-   **発生日:** 2025-10-15
-   **関連ファイル:**
    -   `apps/dashboard/src/components/agent/asp-form.tsx`
    -   `apps/dashboard/src/lib/validations/asp.ts`

## 問題

`asp-form.tsx` コンポーネントで、`react-hook-form` の `useForm` フックや `FormField` コンポーネントにおいて、多数のTypeScript型エラーが発生した。

エラーメッセージの要点:
`Type 'Resolver<... { prompt?: string | undefined; } ...>' is not assignable to type 'Resolver<... { prompt: string; } ...>'`

## 原因

`zod` を使用したバリデーションスキーマ `aspFormSchema` (`lib/validations/asp.ts`) の定義が原因でした。

`prompt` フィールドを `z.string().default("")` と定義していました。

```typescript:apps/dashboard/src/lib/validations/asp.ts
export const aspFormSchema = z.object({
  // ...
  prompt: z.string().default(""),
});
```

この `.default("")` により、`zodResolver` はバリデーション前のデータとして `prompt` フィールドが `undefined` である可能性を考慮し、フィールドの型を `string | undefined` として推論していました。

一方で、`z.infer<typeof aspFormSchema>` を使って生成される `AspFormValues` 型では、`.default()` があるため `prompt` フィールドは必須の `string` 型として推論されます。

この2つの型の不一致が、`useForm<AspFormValues>({ resolver: zodResolver(aspFormSchema) })` のように型を明示的に指定している箇所で、`react-hook-form` 内部の型エラーを引き起こしていました。

## 解決策

`lib/validations/asp.ts` の `aspFormSchema` から `.default("")` を削除し、`prompt` フィールドを単純な `z.string()` に変更しました。

```typescript:apps/dashboard/src/lib/validations/asp.ts
export const aspFormSchema = z.object({
  // ...
  prompt: z.string(),
});
```

これにより、`zodResolver` と `z.infer` が推論する `prompt` の型がどちらも `string` となり、型の不一致が解消されました。

フォームの初期値（空文字列）は、`asp-form.tsx` の `useForm` フックの `defaultValues` プロパティで設定されているため、バリデーションスキーマ側でのデフォルト値設定は不要でした。

```typescript:apps/dashboard/src/components/agent/asp-form.tsx
const form = useForm<AspFormValues>({
  resolver: zodResolver(aspFormSchema),
  defaultValues: {
    // ...
    prompt: defaultValues?.prompt ?? "",
  },
});
```
