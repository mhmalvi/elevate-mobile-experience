import { faker } from '@faker-js/faker';

export const createMockClient = (overrides = {}) => ({
  id: faker.string.uuid(),
  user_id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  phone: faker.phone.number('+614## ### ###'),
  address: faker.location.streetAddress(),
  suburb: faker.location.city(),
  state: 'NSW',
  postcode: faker.location.zipCode('####'),
  notes: faker.lorem.sentence(),
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  deleted_at: null,
  ...overrides,
});

export const createMockQuote = (overrides = {}) => ({
  id: faker.string.uuid(),
  user_id: faker.string.uuid(),
  client_id: faker.string.uuid(),
  quote_number: `Q-${faker.number.int({ min: 1000, max: 9999 })}`,
  title: faker.commerce.productName(),
  description: faker.lorem.paragraph(),
  status: 'draft',
  subtotal: 1000,
  gst: 100,
  total: 1100,
  valid_until: faker.date.future().toISOString().split('T')[0],
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  deleted_at: null,
  ...overrides,
});

export const createMockInvoice = (overrides = {}) => ({
  id: faker.string.uuid(),
  user_id: faker.string.uuid(),
  client_id: faker.string.uuid(),
  invoice_number: `INV-${faker.number.int({ min: 1000, max: 9999 })}`,
  title: faker.commerce.productName(),
  description: faker.lorem.paragraph(),
  status: 'draft',
  subtotal: 2000,
  gst: 200,
  total: 2200,
  amount_paid: 0,
  due_date: faker.date.future().toISOString().split('T')[0],
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  deleted_at: null,
  ...overrides,
});

export const createMockJob = (overrides = {}) => ({
  id: faker.string.uuid(),
  user_id: faker.string.uuid(),
  client_id: faker.string.uuid(),
  title: faker.commerce.productName(),
  description: faker.lorem.paragraph(),
  status: 'scheduled',
  site_address: faker.location.streetAddress(),
  scheduled_date: faker.date.future().toISOString().split('T')[0],
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  deleted_at: null,
  ...overrides,
});

export const createMockUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  created_at: faker.date.past().toISOString(),
  ...overrides,
});

export const createMockProfile = (overrides = {}) => ({
  id: faker.string.uuid(),
  user_id: faker.string.uuid(),
  business_name: faker.company.name(),
  abn: faker.string.numeric(11),
  trade_type: 'electrician',
  phone: faker.phone.number('+614## ### ###'),
  email: faker.internet.email(),
  address: faker.location.streetAddress(),
  subscription_tier: 'free',
  created_at: faker.date.past().toISOString(),
  updated_at: faker.date.recent().toISOString(),
  ...overrides,
});
