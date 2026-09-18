/** Shared E2E test credentials — keep passwords in sync across setup specs. */
export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!';
export const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'test@example.com';

export const TEST_USER = {
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
};

export const TEST_ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.com',
  password: TEST_PASSWORD,
};
