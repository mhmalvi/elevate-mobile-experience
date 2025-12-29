-- ============================================================================
-- Migration: Seed Quote Templates
-- Description: Pre-built quote templates for common trade services
-- Date: 2024-12-29
-- ============================================================================

-- First, ensure the quote_templates table exists
CREATE TABLE IF NOT EXISTS public.quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies if not exists
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public quote templates are viewable by authenticated users" ON public.quote_templates;
CREATE POLICY "Public quote templates are viewable by authenticated users"
  ON public.quote_templates
  FOR SELECT
  TO authenticated
  USING (is_public = TRUE);

-- ============================================================================
-- PLUMBER TEMPLATES
-- ============================================================================

INSERT INTO public.quote_templates (trade_type, name, description, default_items, is_public) VALUES
('Plumber', 'Hot Water System Installation', 'Complete hot water system replacement with installation',
  '[
    {"description": "Hot water system (250L electric)", "quantity": 1, "unit_price": 1200, "unit": "unit"},
    {"description": "Installation labour", "quantity": 4, "unit_price": 90, "unit": "hour"},
    {"description": "Copper piping and fittings", "quantity": 1, "unit_price": 200, "unit": "lot"},
    {"description": "Pressure relief valve", "quantity": 1, "unit_price": 45, "unit": "unit"},
    {"description": "Tempering valve installation", "quantity": 1, "unit_price": 150, "unit": "unit"}
  ]'::jsonb,
  TRUE
),

('Plumber', 'Bathroom Renovation', 'Full bathroom renovation plumbing',
  '[
    {"description": "Bathroom demolition and removal", "quantity": 1, "unit_price": 800, "unit": "lot"},
    {"description": "New toilet installation", "quantity": 1, "unit_price": 350, "unit": "unit"},
    {"description": "Vanity and basin installation", "quantity": 1, "unit_price": 600, "unit": "unit"},
    {"description": "Shower installation with taps", "quantity": 1, "unit_price": 1200, "unit": "unit"},
    {"description": "Plumbing labour", "quantity": 16, "unit_price": 95, "unit": "hour"},
    {"description": "Materials and fittings", "quantity": 1, "unit_price": 500, "unit": "lot"}
  ]'::jsonb,
  TRUE
),

('Plumber', 'Blocked Drain Service', 'Standard blocked drain call-out and clearing',
  '[
    {"description": "Call-out fee", "quantity": 1, "unit_price": 120, "unit": "visit"},
    {"description": "Drain clearing (up to 1 hour)", "quantity": 1, "unit_price": 180, "unit": "hour"},
    {"description": "CCTV drain inspection", "quantity": 1, "unit_price": 250, "unit": "service"},
    {"description": "High-pressure water jetting", "quantity": 1, "unit_price": 200, "unit": "service"}
  ]'::jsonb,
  TRUE
),

('Plumber', 'Tap Replacement', 'Kitchen or bathroom tap replacement',
  '[
    {"description": "Call-out fee", "quantity": 1, "unit_price": 90, "unit": "visit"},
    {"description": "Kitchen mixer tap", "quantity": 1, "unit_price": 150, "unit": "unit"},
    {"description": "Installation labour", "quantity": 1, "unit_price": 120, "unit": "hour"}
  ]'::jsonb,
  TRUE
),

-- ============================================================================
-- ELECTRICIAN TEMPLATES
-- ============================================================================

('Electrician', 'Switchboard Upgrade', 'Residential switchboard replacement and upgrade',
  '[
    {"description": "18-way switchboard", "quantity": 1, "unit_price": 450, "unit": "unit"},
    {"description": "RCD safety switches (2x)", "quantity": 2, "unit_price": 120, "unit": "unit"},
    {"description": "Circuit breakers (8x)", "quantity": 8, "unit_price": 35, "unit": "unit"},
    {"description": "Installation labour", "quantity": 6, "unit_price": 95, "unit": "hour"},
    {"description": "Testing and certification", "quantity": 1, "unit_price": 180, "unit": "service"}
  ]'::jsonb,
  TRUE
),

('Electrician', 'LED Downlight Installation', 'LED downlight supply and installation',
  '[
    {"description": "LED downlights (10W)", "quantity": 10, "unit_price": 25, "unit": "unit"},
    {"description": "Installation labour", "quantity": 3, "unit_price": 90, "unit": "hour"},
    {"description": "Ceiling patching (if required)", "quantity": 1, "unit_price": 150, "unit": "lot"}
  ]'::jsonb,
  TRUE
),

('Electrician', 'Power Point Installation', 'Additional power points and outlets',
  '[
    {"description": "Standard double power point", "quantity": 1, "unit_price": 45, "unit": "unit"},
    {"description": "Installation labour", "quantity": 0.5, "unit_price": 90, "unit": "hour"},
    {"description": "Cable and conduit", "quantity": 1, "unit_price": 30, "unit": "lot"}
  ]'::jsonb,
  TRUE
),

('Electrician', 'Smoke Alarm Installation', 'Photoelectric smoke alarm installation (NSW compliant)',
  '[
    {"description": "Photoelectric smoke alarm", "quantity": 1, "unit_price": 80, "unit": "unit"},
    {"description": "Installation labour", "quantity": 0.5, "unit_price": 90, "unit": "hour"}
  ]'::jsonb,
  TRUE
),

-- ============================================================================
-- CARPENTER TEMPLATES
-- ============================================================================

('Carpenter', 'Deck Construction', 'Timber deck construction',
  '[
    {"description": "Treated pine decking (per m²)", "quantity": 20, "unit_price": 120, "unit": "m²"},
    {"description": "Deck frame and bearers", "quantity": 1, "unit_price": 800, "unit": "lot"},
    {"description": "Labour", "quantity": 40, "unit_price": 75, "unit": "hour"},
    {"description": "Stainless steel screws and fixings", "quantity": 1, "unit_price": 150, "unit": "lot"}
  ]'::jsonb,
  TRUE
),

('Carpenter', 'Kitchen Cabinet Installation', 'Kitchen cabinet installation and benchtop',
  '[
    {"description": "Kitchen cabinets (supply)", "quantity": 1, "unit_price": 8000, "unit": "lot"},
    {"description": "Stone benchtop (per linear metre)", "quantity": 3, "unit_price": 650, "unit": "m"},
    {"description": "Installation labour", "quantity": 32, "unit_price": 80, "unit": "hour"},
    {"description": "Hardware and accessories", "quantity": 1, "unit_price": 400, "unit": "lot"}
  ]'::jsonb,
  TRUE
),

('Carpenter', 'Door Installation', 'Internal door replacement',
  '[
    {"description": "Hollow core door", "quantity": 1, "unit_price": 180, "unit": "unit"},
    {"description": "Door frame and architrave", "quantity": 1, "unit_price": 120, "unit": "set"},
    {"description": "Door hardware (handles, hinges)", "quantity": 1, "unit_price": 80, "unit": "set"},
    {"description": "Installation labour", "quantity": 3, "unit_price": 75, "unit": "hour"}
  ]'::jsonb,
  TRUE
),

-- ============================================================================
-- BUILDER TEMPLATES
-- ============================================================================

('Builder', 'Home Extension', 'Single room extension',
  '[
    {"description": "Foundation and concrete slab", "quantity": 1, "unit_price": 3500, "unit": "lot"},
    {"description": "Framing timber and materials", "quantity": 1, "unit_price": 2000, "unit": "lot"},
    {"description": "Roofing (per m²)", "quantity": 20, "unit_price": 85, "unit": "m²"},
    {"description": "Windows and doors", "quantity": 1, "unit_price": 1800, "unit": "lot"},
    {"description": "Labour", "quantity": 80, "unit_price": 75, "unit": "hour"}
  ]'::jsonb,
  TRUE
),

('Builder', 'Bathroom Renovation', 'Complete bathroom renovation',
  '[
    {"description": "Demolition and removal", "quantity": 1, "unit_price": 1200, "unit": "lot"},
    {"description": "Waterproofing", "quantity": 1, "unit_price": 800, "unit": "lot"},
    {"description": "Tiling (per m²)", "quantity": 15, "unit_price": 95, "unit": "m²"},
    {"description": "Fixtures and fittings", "quantity": 1, "unit_price": 2000, "unit": "lot"},
    {"description": "Labour", "quantity": 60, "unit_price": 75, "unit": "hour"}
  ]'::jsonb,
  TRUE
),

('Builder', 'Fence Construction', 'Timber paling fence',
  '[
    {"description": "Treated pine posts (100x100)", "quantity": 20, "unit_price": 35, "unit": "unit"},
    {"description": "Timber palings", "quantity": 1, "unit_price": 800, "unit": "lot"},
    {"description": "Rails and capping", "quantity": 1, "unit_price": 400, "unit": "lot"},
    {"description": "Concrete for posts", "quantity": 10, "unit_price": 25, "unit": "bag"},
    {"description": "Labour", "quantity": 24, "unit_price": 70, "unit": "hour"}
  ]'::jsonb,
  TRUE
),

-- ============================================================================
-- PAINTER TEMPLATES
-- ============================================================================

('Painter', 'Interior House Paint', 'Full interior house painting',
  '[
    {"description": "Paint preparation (per m²)", "quantity": 200, "unit_price": 8, "unit": "m²"},
    {"description": "Premium interior paint (per litre)", "quantity": 40, "unit_price": 35, "unit": "L"},
    {"description": "Painting labour (per m²)", "quantity": 200, "unit_price": 15, "unit": "m²"}
  ]'::jsonb,
  TRUE
),

('Painter', 'Exterior House Paint', 'Full exterior house painting',
  '[
    {"description": "High-pressure cleaning", "quantity": 1, "unit_price": 450, "unit": "service"},
    {"description": "Paint preparation (per m²)", "quantity": 150, "unit_price": 12, "unit": "m²"},
    {"description": "Exterior paint (per litre)", "quantity": 50, "unit_price": 45, "unit": "L"},
    {"description": "Painting labour (per m²)", "quantity": 150, "unit_price": 20, "unit": "m²"}
  ]'::jsonb,
  TRUE
),

('Painter', 'Single Room Paint', 'Bedroom or living room painting',
  '[
    {"description": "Surface preparation", "quantity": 1, "unit_price": 200, "unit": "room"},
    {"description": "Premium interior paint", "quantity": 10, "unit_price": 35, "unit": "L"},
    {"description": "Painting labour", "quantity": 8, "unit_price": 65, "unit": "hour"}
  ]'::jsonb,
  TRUE
),

-- ============================================================================
-- LANDSCAPER TEMPLATES
-- ============================================================================

('Landscaper', 'Garden Design & Installation', 'Complete garden transformation',
  '[
    {"description": "Garden design consultation", "quantity": 1, "unit_price": 500, "unit": "service"},
    {"description": "Soil preparation (per m²)", "quantity": 50, "unit_price": 15, "unit": "m²"},
    {"description": "Plants and shrubs", "quantity": 1, "unit_price": 1200, "unit": "lot"},
    {"description": "Mulch (per m³)", "quantity": 3, "unit_price": 85, "unit": "m³"},
    {"description": "Labour", "quantity": 20, "unit_price": 65, "unit": "hour"}
  ]'::jsonb,
  TRUE
),

('Landscaper', 'Lawn Installation', 'New lawn installation (turf or seed)',
  '[
    {"description": "Site preparation (per m²)", "quantity": 100, "unit_price": 8, "unit": "m²"},
    {"description": "Premium turf (per m²)", "quantity": 100, "unit_price": 18, "unit": "m²"},
    {"description": "Installation labour", "quantity": 8, "unit_price": 65, "unit": "hour"}
  ]'::jsonb,
  TRUE
),

('Landscaper', 'Retaining Wall', 'Timber or concrete sleeper retaining wall',
  '[
    {"description": "Concrete sleepers (200x75)", "quantity": 30, "unit_price": 45, "unit": "unit"},
    {"description": "Steel posts", "quantity": 10, "unit_price": 80, "unit": "unit"},
    {"description": "Drainage and aggregate", "quantity": 1, "unit_price": 400, "unit": "lot"},
    {"description": "Excavation and installation", "quantity": 16, "unit_price": 70, "unit": "hour"}
  ]'::jsonb,
  TRUE
),

-- ============================================================================
-- HVAC TEMPLATES
-- ============================================================================

('HVAC Technician', 'Air Conditioning Installation', 'Split system AC installation',
  '[
    {"description": "Split system AC unit (5.0kW cooling)", "quantity": 1, "unit_price": 1200, "unit": "unit"},
    {"description": "Installation labour", "quantity": 6, "unit_price": 95, "unit": "hour"},
    {"description": "Copper piping and brackets", "quantity": 1, "unit_price": 250, "unit": "lot"},
    {"description": "Electrical connection", "quantity": 1, "unit_price": 180, "unit": "service"}
  ]'::jsonb,
  TRUE
),

('HVAC Technician', 'Ducted Heating Service', 'Annual ducted heating maintenance',
  '[
    {"description": "System inspection and testing", "quantity": 1, "unit_price": 120, "unit": "service"},
    {"description": "Filter replacement", "quantity": 1, "unit_price": 65, "unit": "service"},
    {"description": "Duct cleaning", "quantity": 1, "unit_price": 180, "unit": "service"}
  ]'::jsonb,
  TRUE
),

('HVAC Technician', 'Evaporative Cooler Service', 'Evaporative cooling system service',
  '[
    {"description": "System inspection", "quantity": 1, "unit_price": 100, "unit": "service"},
    {"description": "Pad replacement", "quantity": 1, "unit_price": 150, "unit": "service"},
    {"description": "Pump service", "quantity": 1, "unit_price": 80, "unit": "service"}
  ]'::jsonb,
  TRUE
),

-- ============================================================================
-- GENERAL HANDYMAN TEMPLATES
-- ============================================================================

('Handyman', 'General Repairs', 'Minor repairs and maintenance',
  '[
    {"description": "Call-out fee", "quantity": 1, "unit_price": 80, "unit": "visit"},
    {"description": "Labour", "quantity": 2, "unit_price": 65, "unit": "hour"},
    {"description": "Materials", "quantity": 1, "unit_price": 100, "unit": "lot"}
  ]'::jsonb,
  TRUE
),

('Handyman', 'Gutter Cleaning', 'Residential gutter cleaning',
  '[
    {"description": "Gutter cleaning (per metre)", "quantity": 40, "unit_price": 8, "unit": "m"},
    {"description": "Downpipe clearing", "quantity": 4, "unit_price": 25, "unit": "unit"},
    {"description": "Labour", "quantity": 2, "unit_price": 60, "unit": "hour"}
  ]'::jsonb,
  TRUE
);

-- Add index for faster trade_type lookups
CREATE INDEX IF NOT EXISTS idx_quote_templates_trade_type ON public.quote_templates(trade_type);

-- Add comment
COMMENT ON TABLE public.quote_templates IS 'Pre-built quote templates for common trade services';
