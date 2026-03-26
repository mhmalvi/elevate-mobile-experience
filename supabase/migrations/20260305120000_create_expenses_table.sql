-- Create expenses table for BAS reporting
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  team_id UUID REFERENCES teams(id),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_name TEXT,
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_expenses_user_deleted ON expenses(user_id, deleted_at);
CREATE INDEX idx_expenses_date ON expenses(date);

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses" ON expenses
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "Users can insert own expenses" ON expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON expenses
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "Users can delete own expenses" ON expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at (uses existing generic function from comprehensive_fixes migration)
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
