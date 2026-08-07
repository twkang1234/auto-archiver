import fs from 'fs';

let content = fs.readFileSync('src/lib/auth.ts', 'utf8');
content = content.replace(
  /export const logout = async \(\) => {[\s\S]*?};/,
`export const logout = async (clearEmail: boolean = false) => {
  await auth.signOut();
  cachedAccessToken = null;
  if (clearEmail) {
    cachedEmail = null;
  }
  try {
    localStorage.removeItem('g_access_token');
    if (clearEmail) {
      localStorage.removeItem('g_last_email');
    }
  } catch (e) {}
};`
);
fs.writeFileSync('src/lib/auth.ts', content);
