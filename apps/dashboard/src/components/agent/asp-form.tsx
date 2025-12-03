"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { aspFormSchema, type AspFormValues } from "@/lib/validations/asp";
import { useState } from "react";

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
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);

  const form = useForm<AspFormValues>({
    resolver: zodResolver(aspFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      login_url: defaultValues?.login_url ?? "",
      credentials: defaultValues?.credentials ?? [],
    },
  });

  const handleMediaToggle = (mediaId: string) => {
    const newSelectedIds = selectedMediaIds.includes(mediaId)
      ? selectedMediaIds.filter(id => id !== mediaId)
      : [...selectedMediaIds, mediaId];

    setSelectedMediaIds(newSelectedIds);

    // credentialsを更新
    const newCredentials = newSelectedIds.map(id => {
      const existing = form.getValues("credentials").find(c => c.media_id === id);
      return existing || {
        media_id: id,
        username_secret_key: "",
        password_secret_key: "",
      };
    });

    form.setValue("credentials", newCredentials);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl mx-auto p-6 space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-base">ASP名</FormLabel>
              <FormControl>
                <Input placeholder="A8.net" {...field} className="h-11" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="login_url"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-base">ログインURL</FormLabel>
              <FormControl>
                <Input placeholder="https://www.a8.net/" {...field} className="h-11" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="credentials"
          render={() => (
            <FormItem className="space-y-3">
              <FormLabel className="text-base">メディア選択</FormLabel>
              <div className="space-y-2">
                {media.map((m) => (
                  <div key={m.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={m.id}
                      checked={selectedMediaIds.includes(m.id)}
                      onCheckedChange={() => handleMediaToggle(m.id)}
                    />
                    <label htmlFor={m.id} className="text-sm cursor-pointer">
                      {m.name}
                    </label>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 選択されたメディアごとの認証情報入力 */}
        {selectedMediaIds.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-base font-medium">認証情報設定</h3>
            {selectedMediaIds.map((mediaId, index) => {
              const mediaName = media.find(m => m.id === mediaId)?.name;
              return (
                <div key={mediaId} className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium">{mediaName}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name={`credentials.${index}.username_secret_key`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">ユーザー名シークレットキー</FormLabel>
                          <FormControl>
                            <Input placeholder="ASP_USERNAME" {...field} className="h-9" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`credentials.${index}.password_secret_key`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">パスワードシークレットキー</FormLabel>
                          <FormControl>
                            <Input placeholder="ASP_PASSWORD" {...field} className="h-9" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isPending} className="px-8">
            {isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
