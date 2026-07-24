import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper mapping for palace names to numbers
const palaceNumToName: Record<number, string> = {
  1: "坎宮",
  2: "坤宮",
  3: "震宮",
  4: "巽宮",
  5: "中宮",
  6: "乾宮",
  7: "兌宮",
  8: "艮宮",
  9: "離宮",
};

// API: Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

function cleanText(str: string): string {
  return str
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function parseQimenHtmlLocally(html: string) {
  // 1. Case Name
  let caseName = "";
  const h2Match = html.match(/<h2>神準AI奇門實戰案例<\/h2>\s*<p>([^<]+)<\/p>/i);
  if (h2Match) {
    caseName = cleanText(h2Match[1]);
  } else {
    const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    if (metaMatch) {
      caseName = cleanText(metaMatch[1]).replace(/\.\.\.$/, '');
    } else {
      const ogMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
      if (ogMatch) {
        caseName = cleanText(ogMatch[1]).replace(/\.\.\.$/, '');
      }
    }
  }

  // 2. Solar & Lunar Time
  let solarTime = "";
  let lunarTime = "";
  const solarMatch = html.match(/公元：([^<]+)/i);
  if (solarMatch) {
    solarTime = cleanText(solarMatch[1]);
  }
  const lunarMatch = html.match(/農曆：([^<]+)/i);
  if (lunarMatch) {
    lunarTime = cleanText(lunarMatch[1]);
  }

  // 3. Grid Parse for Palaces
  const gridLines: string[] = [];
  const tagMatches = html.matchAll(/<(li|p)[^>]*>([\s\S]*?)<\/\1>/gi);
  for (const m of tagMatches) {
    const text = cleanText(m[2]);
    if (text.includes("│")) {
      gridLines.push(text);
    }
  }

  const palaces: Record<string, string> = {
    "巽宮": "",
    "離宮": "",
    "坤宮": "",
    "震宮": "",
    "中宮": "",
    "兌宮": "",
    "艮宮": "",
    "坎宮": "",
    "乾宮": ""
  };

  const symbolsMap: Record<string, string[]> = {
    "巽宮": [],
    "離宮": [],
    "坤宮": [],
    "震宮": [],
    "中宮": [],
    "兌宮": [],
    "艮宮": [],
    "坎宮": [],
    "乾宮": []
  };

  if (gridLines.length >= 9) {
    // Process top row (巽宮, 離宮, 坤宮)
    const row0 = gridLines.slice(0, 3);
    // Process middle row (震宮, 中宮, 兌宮)
    const row1 = gridLines.slice(3, 6);
    // Process bottom row (艮宮, 坎宮, 乾宮)
    const row2 = gridLines.slice(6, 9);

    const parseRow = (rowLines: string[], palLeft: string, palMid: string, palRight: string) => {
      rowLines.forEach(line => {
        const parts = line.split("│").map(s => s.trim().replace(/\s+/g, " "));
        if (parts.length >= 4) {
          if (parts[1]) symbolsMap[palLeft].push(...parts[1].split(" ").filter(Boolean));
          if (parts[2]) symbolsMap[palMid].push(...parts[2].split(" ").filter(Boolean));
          if (parts[3]) symbolsMap[palRight].push(...parts[3].split(" ").filter(Boolean));
        }
      });
    };

    parseRow(row0, "巽宮", "離宮", "坤宮");
    parseRow(row1, "震宮", "中宮", "兌宮");
    parseRow(row2, "艮宮", "坎宮", "乾宮");
  }

  // Deduplicate and clean symbols
  Object.keys(symbolsMap).forEach(k => {
    symbolsMap[k] = Array.from(new Set(
      symbolsMap[k].map(s => s.replace(/[○馬o]/g, '').trim())
    )).filter(s => s && s !== "　");
  });

  const palaceNumToName: Record<number, string> = {
    1: "坎宮",
    2: "坤宮",
    3: "震宮",
    4: "巽宮",
    5: "中宮",
    6: "乾宮",
    7: "兌宮",
    8: "艮宮",
    9: "離宮"
  };

  const palaceJudgements: Record<string, string[]> = {
    "巽宮": [],
    "離宮": [],
    "坤宮": [],
    "震宮": [],
    "中宮": [],
    "兌宮": [],
    "艮宮": [],
    "坎宮": [],
    "乾宮": []
  };

  // Get clean text for all <p> and <li> elements
  const allElements: string[] = [];
  const pLiMatches = html.matchAll(/<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi);
  for (const m of pLiMatches) {
    const cleaned = cleanText(m[2]);
    if (cleaned) {
      allElements.push(cleaned);
    }
  }

  let currentCategory = "";
  let currentPalName: string | null = null;
  for (const el of allElements) {
    if (
      el.includes("十干克應") ||
      el.includes("八門克應") ||
      el.includes("星門克應") ||
      el.includes("八門動靜應") ||
      el.includes("九星時應") ||
      el.includes("奇門遁甲排盤環境參數")
    ) {
      currentCategory = el;
      currentPalName = null;
      continue;
    }

    const palaceHeaderMatch = el.match(/^第\s*([1-9])\s*宮$/);
    if (palaceHeaderMatch) {
      const num = parseInt(palaceHeaderMatch[1], 10);
      currentPalName = palaceNumToName[num];
      continue;
    }

    if (currentPalName && currentCategory.includes("十干克應") && el && !el.includes("<") && !el.includes(">")) {
      if (el.includes("：") || el.includes("加") || el.includes("值時")) {
        palaceJudgements[currentPalName].push(el);
      }
    }
  }

  const allowedSpirits = ["值符", "直符", "螣蛇", "太陰", "六合", "白虎", "玄武", "九地", "九天", "符", "蛇", "陰", "六", "虎", "武", "地", "天"];
  const allowedStars = ["天蓬", "天芮", "天衝", "天沖", "天輔", "天禽", "天心", "天柱", "天任", "天英", "蓬", "芮", "衝", "輔", "禽", "心", "柱", "任", "英", "禽芮"];
  const allowedGates = ["開門", "休門", "生門", "傷門", "杜門", "景門", "死門", "驚門", "開", "休", "生", "傷", "杜", "景", "死", "驚"];

  const gateToElement: Record<string, string> = {
    "休門": "水", "休": "水",
    "生門": "土", "生": "土",
    "死門": "土", "死": "土",
    "傷門": "木", "傷": "木",
    "杜門": "木", "杜": "木",
    "景門": "火", "景": "火",
    "開門": "金", "開": "金",
    "驚門": "金", "驚": "金"
  };

  const palaceToElement: Record<string, string> = {
    "坎宮": "水",
    "坤宮": "土", "艮宮": "土", "中宮": "土",
    "震宮": "木", "巽宮": "木",
    "乾宮": "金", "兌宮": "金",
    "離宮": "火"
  };

  const tombRules: Record<string, string> = {
    "乙": "乾宮",
    "丙": "乾宮",
    "戊": "乾宮",
    "丁": "艮宮",
    "己": "艮宮",
    "庚": "坤宮",
    "辛": "巽宮",
    "壬": "巽宮",
    "癸": "坤宮"
  };

  // Compile final palaces output
  Object.keys(palaces).forEach(pal => {
    if (pal === "中宮") {
      const hasWuBuYu = html.includes("五不遇");
      const statusTags = hasWuBuYu ? ["五不遇時"] : [];
      let formattedText = `**宮位符號**: 無\n`;
      formattedText += `**狀態標記**: ${statusTags.join(", ") || "無"}\n`;
      formattedText += `- 上面斷語：無\n`;
      formattedText += `- 下面斷語：無`;
      palaces[pal] = formattedText.trim();
      return;
    }

    const matchingSpirits = symbolsMap[pal].filter(s => allowedSpirits.includes(s)).sort((a, b) => b.length - a.length);
    const matchingStars = symbolsMap[pal].filter(s => allowedStars.includes(s)).sort((a, b) => b.length - a.length);
    const matchingGates = symbolsMap[pal].filter(s => allowedGates.includes(s)).sort((a, b) => b.length - a.length);

    const spirit = matchingSpirits[0];
    const star = matchingStars[0];
    const gate = matchingGates[0];
    const filteredSymbols: string[] = [];
    if (spirit) filteredSymbols.push(spirit);
    if (star) filteredSymbols.push(star);
    if (gate) filteredSymbols.push(gate);

    const statusTags: string[] = [];
    if (gridLines.length >= 9) {
      let rowStartIndex = 0;
      let colIndex = 1;

      if (pal === "巽宮" || pal === "離宮" || pal === "坤宮") {
        rowStartIndex = 0;
      } else if (pal === "震宮" || pal === "中宮" || pal === "兌宮") {
        rowStartIndex = 3;
      } else if (pal === "艮宮" || pal === "坎宮" || pal === "乾宮") {
        rowStartIndex = 6;
      }

      if (pal === "巽宮" || pal === "震宮" || pal === "艮宮") {
        colIndex = 1;
      } else if (pal === "離宮" || pal === "中宮" || pal === "坎宮") {
        colIndex = 2;
      } else if (pal === "坤宮" || pal === "兌宮" || pal === "乾宮") {
        colIndex = 3;
      }

      const relevantLines = gridLines.slice(rowStartIndex, rowStartIndex + 3);
      const rawGridForPal = relevantLines.map(line => {
        const parts = line.split("│");
        return parts[colIndex] || "";
      }).join(" ");

      if (rawGridForPal.includes("○")) statusTags.push("旬空");
      if (rawGridForPal.includes("馬")) statusTags.push("馬星");
    }

    // Check Gate Clash (門迫)
    if (gate) {
      const gateEl = gateToElement[gate];
      const palEl = palaceToElement[pal];
      if (gateEl && palEl) {
        if (
          (gateEl === "木" && palEl === "土") ||
          (gateEl === "土" && palEl === "水") ||
          (gateEl === "水" && palEl === "火") ||
          (gateEl === "火" && palEl === "金") ||
          (gateEl === "金" && palEl === "木")
        ) {
          statusTags.push(`${gate}有門迫`);
        }
      }
    }

    // Check Tomb (入墓)
    const stemsInPal = symbolsMap[pal].filter(s => ["乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"].includes(s));
    stemsInPal.forEach(stem => {
      if (tombRules[stem] === pal) {
        statusTags.push(`${stem}有入墓`);
      }
    });

    const judgements = Array.from(new Set(palaceJudgements[pal]));
    const firstJudgement = judgements[0] ? judgements[0] : "(暫無對應克應斷語)";
    const secondJudgement = judgements[1] ? judgements[1] : (judgements[0] ? judgements[0] : "(暫無對應克應斷語)");

    let formattedText = `**宮位符號**: ${filteredSymbols.join(", ") || "無"}\n`;
    formattedText += `**狀態標記**: ${statusTags.join(", ") || "無"}\n`;
    formattedText += `- 上面斷語：${firstJudgement}\n`;
    formattedText += `- 下面斷語：${secondJudgement}`;

    palaces[pal] = formattedText.trim();
  });

  return {
    caseName,
    solarTime,
    lunarTime,
    palaces
  };
}

// API: Fetch and parse Qimen case page
app.post("/api/fetch-case", async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "請提供網址" });
    }

    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    if (!url.includes("app.soul-treasure.net")) {
      return res.status(400).json({ error: "網址必須來自 app.soul-treasure.net" });
    }

    console.log(`[Backend] Fetching URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`網頁讀取失敗 (HTTP ${response.status})`);
    }

    const html = await response.text();
    console.log(`[Backend] HTML fetched, length: ${html.length}. Trying local high-speed parser first...`);

    try {
      const localResult = parseQimenHtmlLocally(html);
      if (
        localResult.caseName &&
        localResult.solarTime &&
        localResult.lunarTime &&
        localResult.palaces["巽宮"] &&
        localResult.palaces["坎宮"]
      ) {
        console.log("[Backend] Local parsing succeeded instantly!");
        return res.json(localResult);
      }
      console.log("[Backend] Local parsing was incomplete. Falling back to Gemini...");
    } catch (localErr) {
      console.warn("[Backend] Local parsing failed, falling back to Gemini:", localErr);
    }

    // Initialize Gemini SDK with custom timeout to handle larger responses
    const aiWithTimeout = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        timeout: 120000, // 2 minutes
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `
    Please parse the following HTML page of a Qimen Dunjia (奇門遁甲) case from app.soul-treasure.net and extract the case information as JSON according to the schema.

    Here is the HTML of the page:
    --- START OF HTML ---
    ${html}
    --- END OF HTML ---

    Key guidelines for parsing:
    1. The title/question (案例名稱) is located near the top, often in the meta tags (description or og:description) or inside header tags. Example: "台勝科 (3532) 預測明天買入五千元 未來吉凶如何?". Extract it fully.
    2. The solar起盤時間 is labeled with "公元" or "真時". Extract the full solar time with its局 number, e.g. "2026年7月14日21時42分0秒 陰5局".
    3. The lunar農曆時間 is labeled with "農曆". Extract the full lunar calendar time, e.g. "2026年06月01日22時40分".
    4. The 9 palaces layout (九宮) is represented in a text grid like:
       ┌──────┬──────┬──────┐
       │...   │...   │...   │
       ├──────┼──────┼──────┤
       │...   │...   │...   │
       ├──────┼──────┼──────┤
       │...   │...   │...   │
       └──────┴──────┴──────┘
       The 9 palaces in standard layout:
       - Top row (left to right): 巽宮 (Palace 4), 離宮 (Palace 9), 坤宮 (Palace 2)
       - Middle row (left to right): 震宮 (Palace 3), 中宮 (Palace 5), 兌宮 (Palace 7)
       - Bottom row (left to right): 艮宮 (Palace 8), 坎宮 (Palace 1), 乾宮 (Palace 6)

       For each palace, compile all symbols (八神: like 值符, 螣蛇, 太陰, 六合, 白虎, 玄武, 九地, 九天; 九星: like 天蓬, 天芮, 天衝, 天輔, 天禽, 天心, 天柱, 天任, 天英; 八門: like 開門, 休門, 生門, 傷門, 杜門, 景門, 死門, 驚門; 天干組合: like 丁加辛, 戊加辛, etc.) found inside the grid, any special status indicators (like 旬空, ○, 馬, 門迫, 擊刑, 入墓, etc.) and the corresponding judgements in the "十干克應" list at the bottom of the HTML page.

    5. Look at the "十干克應" list at the bottom of the HTML:
       - "第1宮" corresponds to "坎宮". Find all judgements for "第1宮" (like "癸加壬：為復見騰蛇...") and include them.
       - "第2宮" corresponds to "坤宮". Find all judgements for "第2宮" (like "丁加辛：為朱雀入獄...") and include them.
       - "第3宮" corresponds to "震宮".
       - "第4宮" corresponds to "巽宮".
       - "第5宮" or central matches is for "中宮".
       - "第6宮" corresponds to "乾宮".
       - "第7宮" corresponds to "兌宮".
       - "第8宮" corresponds to "艮宮".
       - "第9宮" corresponds to "離宮".

    Structure each palace's output string beautifully with clean labels and sections:
    - **宮位符號**: [List of symbols found, e.g., 太陰, 天任, 驚門, 丁加辛, 戊加辛, 旬空. NOTE: For 中宮, this MUST always be "無"]
    - **狀態標記**: [List of tags like 門迫, 擊刑, 入墓, 旬空, etc. if present. NOTE: For 中宮, check if the text "五不遇" or "五不遇時" is present in the HTML; if yes, write "五不遇時", otherwise "無"]
    - **克應斷語**:
      - [Clash judgements like "丁加辛：為朱雀入獄,罪人釋囚,官人失位。" and "戊加辛：為青龍折足...". NOTE: For 中宮, always write "無"]

    Ensure absolutely no details or judgements are omitted.
    `;

    const geminiRes = await aiWithTimeout.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caseName: { type: Type.STRING, description: "The title or query/question of the case, e.g. 台勝科 (3532) 預測明天買入五千元 未來吉凶如何?" },
            solarTime: { type: Type.STRING, description: "The solar calendar starting time and局 number, e.g. 2026年7月14日21時42分0秒 陰5局" },
            lunarTime: { type: Type.STRING, description: "The lunar calendar time, e.g. 2026年06月01日22時40分" },
            palaces: {
              type: Type.OBJECT,
              properties: {
                巽宮: { type: Type.STRING },
                離宮: { type: Type.STRING },
                坤宮: { type: Type.STRING },
                震宮: { type: Type.STRING },
                中宮: { type: Type.STRING },
                兌宮: { type: Type.STRING },
                艮宮: { type: Type.STRING },
                坎宮: { type: Type.STRING },
                乾宮: { type: Type.STRING },
              },
              required: ["巽宮", "離宮", "坤宮", "震宮", "中宮", "兌宮", "艮宮", "坎宮", "乾宮"],
            },
          },
          required: ["caseName", "solarTime", "lunarTime", "palaces"],
        }
      }
    });

    const parsedData = JSON.parse(geminiRes.text || "{}");
    res.json(parsedData);
  } catch (err: any) {
    console.error("[Backend Error]", err);
    res.status(500).json({ error: err.message || "解析網頁失敗" });
  }
});

// API: Save to Google Sheets (using the user's accessToken)
app.post("/api/save-to-sheets", async (req, res) => {
  try {
    const { accessToken, rowValues } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "未提供 Access Token，請重新登入" });
    }
    if (!rowValues || !Array.isArray(rowValues)) {
      return res.status(400).json({ error: "未提供有效的存檔資料" });
    }

    console.log("[Backend] Starting Google Sheets save workflow...");

    // Helper: Find or create the spreadsheet
    const findOrCreateSpreadsheetBackend = async (token: string): Promise<string> => {
      const q = encodeURIComponent("name = '我的奇門遁甲案例庫' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
      const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`;
      
      const listRes = await fetch(listUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!listRes.ok) {
        const errText = await listRes.text();
        throw new Error(`查詢雲端硬碟檔案失敗 (HTTP ${listRes.status}): ${errText}`);
      }
      
      const listData: any = await listRes.json();
      if (listData.files && listData.files.length > 0) {
        return listData.files[0].id;
      }

      // If not found, let's create a new spreadsheet
      console.log("[Backend] Spreadsheet not found, creating a new one...");
      const createUrl = `https://www.googleapis.com/drive/v3/files`;
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '我的奇門遁甲案例庫',
          mimeType: 'application/vnd.google-apps.spreadsheet',
        }),
      });
      
      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`建立試算表失敗 (HTTP ${createRes.status}): ${errText}`);
      }
      
      const file: any = await createRes.json();
      const spreadsheetId = file.id;

      // Initialize the spreadsheet with correct tab name ("工作表1") and header columns
      await initializeSpreadsheetBackend(spreadsheetId, token);
      
      return spreadsheetId;
    };

    // Helper: Initialize sheet structure and add the headers
    const initializeSpreadsheetBackend = async (spreadsheetId: string, token: string) => {
      console.log(`[Backend] Initializing spreadsheet ${spreadsheetId}...`);
      const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
      const getRes = await fetch(getUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!getRes.ok) {
        throw new Error(`讀取試算表結構失敗 (HTTP ${getRes.status})`);
      }
      
      const data: any = await getRes.json();
      const sheets = data.sheets || [];
      const hasTargetSheet = sheets.some((s: any) => s.properties.title === '工作表1');
      
      // If "工作表1" does not exist, rename the first sheet
      if (!hasTargetSheet && sheets.length > 0) {
        const firstSheetId = sheets[0].properties.sheetId;
        const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
        
        const renameRes = await fetch(batchUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: firstSheetId,
                    title: '工作表1',
                  },
                  fields: 'title',
                },
              },
            ],
          }),
        });

        if (!renameRes.ok) {
          const errText = await renameRes.text();
          console.warn(`[Backend] Rename sheet to "工作表1" failed: ${errText}`);
        }
      }

      // Write headers to "工作表1!A1:P1"
      const headers = ["網址", "案例名稱", "起盤時間(公元)", "農曆", "巽宮", "坤宮", "震宮", "中宮", "兌宮", "艮宮", "坎宮", "乾宮", "離宮", "Google文件網址", "自訂股市網址", "自訂股市名稱"];
      const encodedRange = encodeURIComponent("工作表1!A1:P1");
      const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;
      
      const writeRes = await fetch(writeUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: '工作表1!A1:P1',
          majorDimension: 'ROWS',
          values: [headers],
        }),
      });

      if (!writeRes.ok) {
        const errText = await writeRes.text();
        throw new Error(`初始化表頭失敗 (HTTP ${writeRes.status}): ${errText}`);
      }
    };

    // Helper: Append row values
    const appendRowToSheetBackend = async (spreadsheetId: string, token: string, values: any[]) => {
      console.log(`[Backend] Appending row to spreadsheet ${spreadsheetId}...`);
      const encodedRange = encodeURIComponent("工作表1!A:P");
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`;
      
      const appendRes = await fetch(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: '工作表1!A:P',
          majorDimension: 'ROWS',
          values: [values],
        }),
      });
      
      if (!appendRes.ok) {
        const errText = await appendRes.text();
        throw new Error(`寫入資料失敗 (HTTP ${appendRes.status}): ${errText}`);
      }
    };

    // Execute sequence
    const spreadsheetId = await findOrCreateSpreadsheetBackend(accessToken);
    await appendRowToSheetBackend(spreadsheetId, accessToken, rowValues);

    console.log(`[Backend] Successfully saved case to spreadsheet: ${spreadsheetId}`);
    res.json({ success: true, spreadsheetId });

  } catch (err: any) {
    console.error("[Backend Save Error]", err);
    const status = err.status || (err.message && err.message.includes("HTTP 401") ? 401 : 500);
    const errorMsg = status === 401 ? "您的 Google 登入憑證已過期，請重新登入！" : (err.message || "存檔至 Google Sheets 失敗");
    res.status(status).json({ error: errorMsg, isAuthError: status === 401 });
  }
});

// API: Get rows from Google Sheets (using the user's accessToken)
app.post("/api/get-sheet-rows", async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "未提供 Access Token，請重新登入" });
    }

    console.log("[Backend] Fetching spreadsheet rows...");

    // Helper: Find spreadsheet ID
    const findSpreadsheetId = async (token: string): Promise<string | null> => {
      const q = encodeURIComponent("name = '我的奇門遁甲案例庫' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
      const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`;
      
      const listRes = await fetch(listUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!listRes.ok) {
        if (listRes.status === 401) {
          const e = new Error("Google 登入憑證已過期，請重新登入！");
          (e as any).status = 401;
          throw e;
        }
        return null;
      }
      
      const listData: any = await listRes.json();
      if (listData.files && listData.files.length > 0) {
        return listData.files[0].id;
      }
      return null;
    };

    const sId = await findSpreadsheetId(accessToken);
    if (!sId) {
      // Spreadsheet does not exist yet
      return res.json({ spreadsheetId: null, rows: [] });
    }

    const encodedRange = encodeURIComponent("工作表1!A:P");
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sId}/values/${encodedRange}`;
    
    const getRes = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!getRes.ok) {
      if (getRes.status === 404) {
        return res.json({ spreadsheetId: sId, rows: [] });
      }
      const errText = await getRes.text();
      throw new Error(`讀取試算表資料失敗 (HTTP ${getRes.status}): ${errText}`);
    }

    const data: any = await getRes.json();
    const rows = data.values || [];
    return res.json({ spreadsheetId: sId, rows });

  } catch (err: any) {
    console.error("[Backend Get Rows Error]", err);
    const status = err.status || (err.message && err.message.includes("HTTP 401") ? 401 : 500);
    const errorMsg = status === 401 ? "您的 Google 登入憑證已過期，請重新登入！" : (err.message || "讀取試算表案例失敗");
    res.status(status).json({ error: errorMsg, isAuthError: status === 401 });
  }
});

// API: Update specific cell for Google Doc URL (using the user's accessToken)
app.post("/api/update-doc-url", async (req, res) => {
  try {
    const { accessToken, spreadsheetId, rowIndex, docUrl } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "未提供 Access Token，請重新登入" });
    }
    if (!spreadsheetId) {
      return res.status(400).json({ error: "請提供試算表 ID" });
    }
    if (rowIndex === undefined || rowIndex === null) {
      return res.status(400).json({ error: "請提供要更新的行號" });
    }

    console.log(`[Backend] Updating Google Doc URL for row ${rowIndex} in spreadsheet ${spreadsheetId}...`);

    // Column N (the 14th column) is used to store Google Doc URL
    const range = `工作表1!N${rowIndex}`;
    const encodedRange = encodeURIComponent(range);
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;

    const writeRes = await fetch(writeUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values: [[docUrl || ""]],
      }),
    });

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      throw new Error(`更新試算表欄位失敗 (HTTP ${writeRes.status}): ${errText}`);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Backend Update Doc URL Error]", err);
    const status = err.status || (err.message && err.message.includes("HTTP 401") ? 401 : 500);
    const errorMsg = status === 401 ? "您的 Google 登入憑證已過期，請重新登入！" : (err.message || "更新文件網址失敗");
    res.status(status).json({ error: errorMsg, isAuthError: status === 401 });
  }
});

// API: Update specific cell for Custom Stock URL and Name (using the user's accessToken)
app.post("/api/update-stock-url", async (req, res) => {
  try {
    const { accessToken, spreadsheetId, rowIndex, stockUrl, stockName } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "未提供 Access Token，請重新登入" });
    }
    if (!spreadsheetId) {
      return res.status(400).json({ error: "請提供試算表 ID" });
    }
    if (rowIndex === undefined || rowIndex === null) {
      return res.status(400).json({ error: "請提供要更新的行號" });
    }

    console.log(`[Backend] Updating Custom Stock URL and Name for row ${rowIndex} in spreadsheet ${spreadsheetId}...`);

    // Column O and P (15th and 16th columns) are used to store Custom Stock URL and Custom Stock Name
    const range = `工作表1!O${rowIndex}:P${rowIndex}`;
    const encodedRange = encodeURIComponent(range);
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;

    const writeRes = await fetch(writeUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values: [[stockUrl || "", stockName || ""]],
      }),
    });

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      throw new Error(`更新試算表欄位失敗 (HTTP ${writeRes.status}): ${errText}`);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Backend Update Stock URL Error]", err);
    const status = err.status || (err.message && err.message.includes("HTTP 401") ? 401 : 500);
    const errorMsg = status === 401 ? "您的 Google 登入憑證已過期，請重新登入！" : (err.message || "更新自訂股市網址與名稱失敗");
    res.status(status).json({ error: errorMsg, isAuthError: status === 401 });
  }
});

// API: Delete a row from Google Sheets
app.post("/api/delete-sheet-row", async (req, res) => {
  try {
    const { accessToken, spreadsheetId, rowIndex } = req.body;
    if (!accessToken || !spreadsheetId || rowIndex === undefined) {
      return res.status(400).json({ error: "參數不完整" });
    }

    console.log(`[Backend] Deleting row ${rowIndex} from spreadsheet ${spreadsheetId}...`);

    // 1. Get the sheetId of "工作表1"
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const getRes = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!getRes.ok) {
      if (getRes.status === 401) {
        const e = new Error("Google 登入憑證已過期，請重新登入！");
        (e as any).status = 401;
        throw e;
      }
      const errText = await getRes.text();
      throw new Error(`讀取試算表資訊失敗 (HTTP ${getRes.status}): ${errText}`);
    }

    const data: any = await getRes.json();
    const sheets = data.sheets || [];
    const targetSheet = sheets.find((s: any) => s.properties.title === '工作表1');
    if (!targetSheet) {
      throw new Error("找不到名為「工作表1」的分頁");
    }
    const sheetId = targetSheet.properties.sheetId;

    // 2. Perform the deleteDimension batchUpdate request
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const deleteRes = await fetch(batchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: rowIndex - 1, // 0-based inclusive
                endIndex: rowIndex // 0-based exclusive (deletes exactly rowIndex)
              }
            }
          }
        ]
      })
    });

    if (!deleteRes.ok) {
      const errText = await deleteRes.text();
      throw new Error(`刪除試算表列失敗 (HTTP ${deleteRes.status}): ${errText}`);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Backend Delete Row Error]", err);
    const status = err.status || (err.message && err.message.includes("HTTP 401") ? 401 : 500);
    const errorMsg = status === 401 ? "您的 Google 登入憑證已過期，請重新登入！" : (err.message || "刪除案例失敗");
    res.status(status).json({ error: errorMsg, isAuthError: status === 401 });
  }
});

// Set up server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
