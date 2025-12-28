-- Add RLS policies for public quote viewing (unauthenticated)
CREATE POLICY "Anyone can view quotes by id" 
ON public.quotes 
FOR SELECT 
USING (true);

-- Add RLS policies for public quote line items viewing
CREATE POLICY "Anyone can view quote line items" 
ON public.quote_line_items 
FOR SELECT 
USING (true);

-- Add RLS policies for public invoice viewing
CREATE POLICY "Anyone can view invoices by id" 
ON public.invoices 
FOR SELECT 
USING (true);

-- Add RLS policies for public invoice line items viewing  
CREATE POLICY "Anyone can view invoice line items" 
ON public.invoice_line_items 
FOR SELECT 
USING (true);

-- Add RLS policy for public profile viewing (for business details on quotes/invoices)
CREATE POLICY "Anyone can view profiles for document display" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Add RLS policy for public client viewing (for client details on quotes/invoices)
CREATE POLICY "Anyone can view clients for document display" 
ON public.clients 
FOR SELECT 
USING (true);