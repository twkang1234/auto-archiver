/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Search for the spreadsheet "我的奇門遁甲案例庫" in Drive
export async function findOrCreateSpreadsheet(accessToken: string): Promise<string> {
  const q = encodeURIComponent("name = '我的奇門遁甲案例庫' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`;
  
  const res = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`查詢雲端硬碟檔案失敗: ${res.status} ${errText}`);
  }
  
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // If not found, let's create a new spreadsheet
  const createUrl = `https://www.googleapis.com/drive/v3/files`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: '我的奇門遁甲案例庫',
      mimeType: 'application/vnd.google-apps.spreadsheet',
    }),
  });
  
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`建立試算表失敗: ${createRes.status} ${errText}`);
  }
  
  const file = await createRes.json();
  const spreadsheetId = file.id;

  // Initialize the spreadsheet with correct tab name ("工作表1") and header columns
  await initializeSpreadsheet(spreadsheetId, accessToken);
  
  return spreadsheetId;
}

// Initialize sheet structure and add the headers
async function initializeSpreadsheet(spreadsheetId: string, accessToken: string) {
  // Get existing sheets
  const getUrl = `https://www.googleapis.com/sheets/v4/spreadsheets/${spreadsheetId}`;
  const res = await fetch(getUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!res.ok) {
    throw new Error(`讀取試算表結構失敗: ${res.statusText}`);
  }
  
  const data = await res.json();
  const sheets = data.sheets || [];
  
  const hasTargetSheet = sheets.some((s: any) => s.properties.title === '工作表1');
  
  // If "工作表1" does not exist, rename the first sheet
  if (!hasTargetSheet && sheets.length > 0) {
    const firstSheetId = sheets[0].properties.sheetId;
    const batchUrl = `https://www.googleapis.com/sheets/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    
    await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
  }

  // Write headers to "工作表1!A1:M1"
  const headers = ["網址", "案例名稱", "起盤時間(公元)", "農曆", "巽宮", "坤宮", "震宮", "中宮", "兌宮", "艮宮", "坎宮", "乾宮", "離宮"];
  const writeUrl = `https://www.googleapis.com/sheets/v4/spreadsheets/${spreadsheetId}/values/工作表1!A1:M1?valueInputOption=USER_ENTERED`;
  
  const writeRes = await fetch(writeUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: '工作表1!A1:M1',
      majorDimension: 'ROWS',
      values: [headers],
    }),
  });

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    throw new Error(`初始化表頭失敗: ${writeRes.status} ${errText}`);
  }
}

// Append a row of data
export async function appendRowToSheet(
  spreadsheetId: string,
  accessToken: string,
  rowValues: any[]
) {
  const appendUrl = `https://www.googleapis.com/sheets/v4/spreadsheets/${spreadsheetId}/values/工作表1!A:M:append?valueInputOption=USER_ENTERED`;
  
  const res = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: '工作表1!A:M',
      majorDimension: 'ROWS',
      values: [rowValues],
    }),
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`寫入資料失敗: ${res.status} ${errText}`);
  }
}
