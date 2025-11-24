-- Create execution_logs table for tracking scraper runs
CREATE TABLE IF NOT EXISTS execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asp_id UUID REFERENCES asps(id) ON DELETE CASCADE,
  execution_type TEXT NOT NULL CHECK (execution_type IN ('daily', 'monthly', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_saved INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_execution_logs_asp_id ON execution_logs(asp_id);
CREATE INDEX idx_execution_logs_status ON execution_logs(status);
CREATE INDEX idx_execution_logs_started_at ON execution_logs(started_at DESC);
CREATE INDEX idx_execution_logs_execution_type ON execution_logs(execution_type);

-- Add RLS policies
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read access to execution_logs" ON execution_logs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow service role full access to execution_logs" ON execution_logs
  FOR ALL TO service_role USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_execution_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_execution_logs_updated_at
  BEFORE UPDATE ON execution_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_execution_logs_updated_at();

-- Add comments
COMMENT ON TABLE execution_logs IS 'Tracks execution history of ASP scrapers';
COMMENT ON COLUMN execution_logs.execution_type IS 'Type of execution: daily, monthly, or manual';
COMMENT ON COLUMN execution_logs.status IS 'Execution status: running, success, failed, or partial';
COMMENT ON COLUMN execution_logs.records_saved IS 'Number of records successfully saved';
COMMENT ON COLUMN execution_logs.metadata IS 'Additional execution metadata (date range, retry count, etc.)';
