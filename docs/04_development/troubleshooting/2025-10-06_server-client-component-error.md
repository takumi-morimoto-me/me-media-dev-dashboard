# Server/Client Component間でのReactコンポーネント渡しエラー

## 発生日時
2025-10-06

## エラー内容

### エラーメッセージ
```
Only plain objects can be passed to Client Components from Server Components. Classes or other objects with methods are not supported.
  {title: "ダッシュボード", url: ..., icon: {$$typeof: ..., render: ...}}
                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

```
Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".
  {$$typeof: ..., render: function Table}
                          ^^^^^^^^^^^^^^
```

### 発生箇所
- `src/components/layout/sidebar/app-sidebar.tsx:21`
- Server Component (`AppSidebar`) から Client Component (`AppSidebarClient`) への props 渡し

## 原因
Server ComponentからClient Componentに、Reactコンポーネント（lucide-reactのアイコン）を直接渡そうとしていた。

Next.jsでは、Server ComponentからClient Componentには**プレーンなオブジェクトのみ**を渡すことができ、関数やReactコンポーネントは渡せない。

## 解決方法

### 1. navigationDataの修正
アイコンをReactコンポーネントから文字列に変更：

```typescript
// Before
import { LayoutDashboard, Table } from "lucide-react";

export const navigationData = [
  {
    title: "ダッシュボード",
    url: "/dashboard",
    icon: LayoutDashboard,  // ❌ Reactコンポーネント
  },
  // ...
];

// After
export const navigationData = [
  {
    title: "ダッシュボード",
    url: "/dashboard",
    icon: "LayoutDashboard",  // ✅ 文字列
  },
  // ...
];
```

### 2. Client Component側でアイコンマッピング
Client Component内でアイコン名からコンポーネントへのマッピングを定義：

```typescript
// app-sidebar-client.tsx
import { LayoutDashboard, Table } from "lucide-react"

// アイコンマッピング
const iconMap = {
  LayoutDashboard,
  Table,
} as const;

interface NavLink {
  title: string;
  url: string;
  icon: keyof typeof iconMap;  // "LayoutDashboard" | "Table"
}

// 使用箇所
{navigationData.map(({ icon, title, url }) => {
  const Icon = iconMap[icon];  // 文字列からコンポーネントを取得
  return (
    <Button key={title} ...>
      <Icon className="h-4 w-4" />
      {/* ... */}
    </Button>
  );
})}
```

## 学び
- Server ComponentとClient Componentの境界では、シリアライズ可能なデータ（プレーンオブジェクト、文字列、数値など）のみを渡す
- Reactコンポーネントやアイコンは、Client Component側でインポート・定義する
- アイコンなどの動的な要素は、文字列識別子を渡してClient Component側でマッピングする設計パターンが有効
