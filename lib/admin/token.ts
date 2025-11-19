export function isValidAdminToken(token: string | null) {
  const adminToken = process.env.ADMIN_SECRET_TOKEN;
  return Boolean(adminToken && token && token === adminToken);
}

