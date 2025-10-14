"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// バリデーションスキーマ
export const aspFormSchema = z.object({
  name: z.string().min(1, { message: "ASP名は必須です。" }),
  login_url: z.string().url({ message: "有効なURLを入力してください。" }),
  media_id: z.string().uuid({ message: "メディアを選択してください。" }),
  prompt: z.string().min(1, { message: "プロンプトは必須です。" }),
});

type AspFormValues = z.infer<typeof aspFormSchema>;

type Media = {
  id: string;
  name: string;
};

interface AspFormProps {
  media: Media[];
  onSubmit: (values: AspFormValues) => void;
  isPending: boolean;
  defaultValues?: Partial<AspFormValues>;
}

export function AspForm({ media, onSubmit, isPending, defaultValues }: AspFormProps) {
  const form = useForm<AspFormValues>({
    resolver: zodResolver(aspFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      login_url: defaultValues?.login_url || "",
      media_id: defaultValues?.media_id || "",
      prompt: defaultValues?.prompt || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ASP名</FormLabel>
              <FormControl>
                <Input placeholder="A8.net" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="login_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ログインURL</FormLabel>
              <FormControl>
                <Input placeholder="https://www.a8.net/" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="media_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>所属メディア</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="メディアを選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {media.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>操作プロンプト</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="例:&#10;1. {login_url}にアクセスする&#10;2. ユーザー名フィールドに{SECRET:ASP_USERNAME}を入力&#10;3. パスワードフィールドに{SECRET:ASP_PASSWORD}を入力&#10;4. 「ログイン」ボタンをクリック&#10;5. 「レポート」メニューをクリック&#10;6. 「成果報酬」のテーブルから昨日の確定報酬額を取得"
                  className="min-h-[300px] font-mono text-sm"
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground mt-2">
                AIエージェントへの操作指示を自然言語で記述してください。
                シークレット情報は {`{SECRET:KEY_NAME}`} 形式で記述します。
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
