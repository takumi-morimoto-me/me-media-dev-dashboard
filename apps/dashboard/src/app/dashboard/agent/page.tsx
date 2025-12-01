import { AgentClient } from "@/components/agent/agent-client";

// 動的レンダリングを強制（ビルド時の静的生成を防ぐ）
export const dynamic = 'force-dynamic';

export default function AgentPage() {
  return (
    <div className="flex-1 flex flex-col">
      <AgentClient />
    </div>
  );
}