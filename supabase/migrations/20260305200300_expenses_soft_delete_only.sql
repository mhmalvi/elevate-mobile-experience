-- DB-M4: Remove hard-DELETE policy on expenses.
-- Expenses should use soft-delete (UPDATE deleted_at) like all other entities.
-- The app must use UPDATE to set deleted_at instead of issuing DELETE statements.

DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;

-- No replacement DELETE policy is created intentionally.
-- To "delete" an expense, use:
--   UPDATE expenses SET deleted_at = NOW() WHERE id = :id AND user_id = auth.uid();
-- This is enforced by the existing UPDATE policy which allows owners to update their rows.
