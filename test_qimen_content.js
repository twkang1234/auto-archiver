import fs from "fs";

async function run() {
  try {
    const url = 'https://app.soul-treasure.net/qimen-case/fh2fkjul';
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await response.text();
    fs.writeFileSync("case_page.html", html);
    console.log("HTML downloaded");
    
    // Let's print out lines containing "入墓" or "門迫" or "馬"
    const lines = html.split("\n");
    lines.forEach((line, idx) => {
      if (line.includes("入墓") || line.includes("門迫") || line.includes("擊刑") || line.includes("空") || line.includes("馬")) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    });
  } catch (err) {
    console.error(err);
  }
}
run();
