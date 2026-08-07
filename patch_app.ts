import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace handleLogout definition
content = content.replace(
  /const handleLogout = async \(\) => {[\s\S]*?await logout\(\);/,
  `const handleLogout = async (clearEmail: boolean = false) => {
    try {
      await logout(clearEmail);`
);

// We need to change the manual click to handleLogout(true)
content = content.replace(
  /onClick=\{handleLogout\}/g,
  `onClick={() => handleLogout(true)}`
);

// the auto logouts (401) will just call handleLogout() which defaults to clearEmail=false
// Wait, in `src/App.tsx`, we have things like `if (isAuth) { handleLogout(); }`. These will use false, which is correct!

fs.writeFileSync('src/App.tsx', content);
