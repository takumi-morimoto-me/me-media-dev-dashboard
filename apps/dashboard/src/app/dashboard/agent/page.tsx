import { createClient } from "@/lib/supabase/server";
import { AgentClient } from "@/components/agent/agent-client";

export default async function AgentPage() {
  const supabase = await createClient();

  // ASP一覧とメディア一覧を並行取得
  const [aspsResult, mediaResult] = await Promise.all([
    supabase
      .from("asps")
      .select("*")
      .order("name"),
    supabase
      .from("media")
      .select("id, name")
      .order("name"),
  ]);

  if (aspsResult.error) {
    console.error("Error fetching asps:", aspsResult.error);
  }

  if (mediaResult.error) {
    console.error("Error fetching media:", mediaResult.error);
  }

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6">
      <AgentClient
        asps={aspsResult.data || []}
        media={mediaResult.data || []}
      />
    </div>
  );
}