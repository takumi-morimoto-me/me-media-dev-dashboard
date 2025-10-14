# dashboardアプリへのshadcn/uiコンポーネント追加

- **日付**: 2025-10-14
- **関連パッケージ**: `apps/dashboard`

---

## 1. 追加したコンポーネント

### 1.1 formコンポーネント
```bash
cd apps/dashboard
npx shadcn@latest add form
```

**インストールされたファイル:**
- `src/components/ui/form.tsx` (新規作成)
- `src/components/ui/label.tsx` (更新)
- `src/components/ui/button.tsx` (スキップ - 既存と同一)

**依存関係:**
- React Hook Form
- Zod (バリデーション)

### 1.2 textareaコンポーネント
```bash
npx shadcn@latest add textarea
```

**インストールされたファイル:**
- `src/components/ui/textarea.tsx` (新規作成)

## 2. ビルドエラーの解決

### エラー内容
```
Module not found: Can't resolve '@/components/ui/textarea'
```

### 原因
`asp-form.tsx`で`textarea`コンポーネントをインポートしていたが、コンポーネントが未インストールだった。

### 解決策
textareaコンポーネントをインストールすることで解決。

## 3. Supabaseクライアント関連エラーの解決

### エラー内容
```
Export createServerClient doesn't exist in target module
```

### 原因
- `@/lib/supabase/server.ts`が`createClient`関数をエクスポートしているのに
- 複数のファイルで`createServerClient`としてインポートしていた

### 解決策

以下のファイルを修正：

**1. `src/actions/asp-actions.ts`**
```typescript
// 修正前
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

export async function createAsp(values: z.infer<typeof aspFormSchema>) {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  // ...
}

// 修正後
import { createClient } from "@/lib/supabase/server";

export async function createAsp(values: z.infer<typeof aspFormSchema>) {
  const supabase = await createClient();
  // ...
}
```

**2. `src/app/dashboard/agent/page.tsx`**
```typescript
// 修正前
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

export default async function AgentPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  // ...
}

// 修正後
import { createClient } from "@/lib/supabase/server";

export default async function AgentPage() {
  const supabase = await createClient();
  // ...
}
```

### 修正のポイント
1. `createServerClient` → `createClient`に変更
2. `cookies()`の呼び出しを削除（`createClient`内部で処理される）
3. `await createClient()`として非同期で呼び出し

## 4. まとめ

- shadcn/uiコンポーネントは必要に応じて個別にインストールする
- インポートエラーは、存在しないモジュールをインポートしている可能性が高い
- Supabaseクライアントの作成方法がNext.js 15で変更されているため、最新のパターンに従う
