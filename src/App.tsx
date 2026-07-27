/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  Compass, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  LogOut, 
  Sparkles, 
  Lock,
  ArrowRight,
  BookOpen,
  User,
  Check,
  X,
  Search,
  Database,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  Edit2,
  Plus,
  TrendingUp,
  Trash2,
  Clock,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Solar } from 'lunar-javascript';
import { initAuth, googleSignIn, logout } from './lib/auth';

interface PalaceData {
  巽宮: string;
  離宮: string;
  坤宮: string;
  震宮: string;
  中宮: string;
  兌宮: string;
  艮宮: string;
  坎宮: string;
  乾宮: string;
}

interface CaseResult {
  caseName: string;
  solarTime: string;
  lunarTime: string;
  palaces: PalaceData;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);

  // Form states
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<CaseResult | null>(null);
  const [duplicateCase, setDuplicateCase] = useState<{ name: string; url: string; solarTime: string; rowIdx: number } | null>(null);

  // Save states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);

  // History in current session
  const [sessionLogs, setSessionLogs] = useState<{ name: string; url: string; time: string }[]>([]);

  // Search and Archive view states
  const [activeTab, setActiveTab] = useState<'parse' | 'search'>('parse');
  const [archivedRows, setArchivedRows] = useState<any[][]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotes, setSearchNotes] = useState<string>(() => {
    try {
      return localStorage.getItem('qimen_search_notes') || '';
    } catch {
      return '';
    }
  });

  // Save search notes to local storage
  useEffect(() => {
    try {
      localStorage.setItem('qimen_search_notes', searchNotes);
    } catch (err) {
      console.warn('Unable to save search notes:', err);
    }
  }, [searchNotes]);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedCaseIndex, setExpandedCaseIndex] = useState<number | null>(null);
  const [editingDocIndex, setEditingDocIndex] = useState<number | null>(null);
  const [editingDocUrl, setEditingDocUrl] = useState<string>('');
  const [isUpdatingDoc, setIsUpdatingDoc] = useState<boolean>(false);
  const [editingStockIndex, setEditingStockIndex] = useState<number | null>(null);
  const [editingStockUrl, setEditingStockUrl] = useState<string>('');
  const [editingStockName, setEditingStockName] = useState<string>('');
  const [isUpdatingStock, setIsUpdatingStock] = useState<boolean>(false);
  const [deletingRowIndex, setDeletingRowIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Observation Memo state
  const [memos, setMemos] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('qimen_observation_memos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [expandedMemoCases, setExpandedMemoCases] = useState<Record<string, boolean>>({});
  const [expandedMemos, setExpandedMemos] = useState<Record<string, boolean>>({});

  const [memoTarget, setMemoTarget] = useState('');
  const [memoPeriod, setMemoPeriod] = useState('2_weeks');
  const [memoBaseDate, setMemoBaseDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
  });

  const PERIODS: { [key: string]: { label: string; days: number } } = {
    '2_weeks': { label: '兩星期', days: 14 },
    '1_month': { label: '一個月', days: 30 },
    '2_months': { label: '兩個月', days: 60 },
    '3_months': { label: '三個月', days: 90 },
    '6_months': { label: '半年', days: 180 },
    '1_year': { label: '一年', days: 365 },
  };

  const addDaysToDate = (dateStr: string, days: number): string => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    date.setDate(date.getDate() + days);
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const calculateTargetDate = (base: string, periodKey: string): string => {
    const periodInfo = PERIODS[periodKey];
    if (!periodInfo) return '';
    return addDaysToDate(base, periodInfo.days);
  };

  const formatDateChinese = (dateStr: string): string => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[1]}月${parts[2]}日`;
  };

  const getRemainingDaysText = (targetDateStr: string) => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${dateVal}`;

    if (todayStr === targetDateStr) {
      return { text: '今天觀察日！🔍', style: 'text-amber-400 font-bold animate-pulse' };
    }

    const todayParts = todayStr.split('-').map(Number);
    const targetParts = targetDateStr.split('-').map(Number);
    const today = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
    const target = new Date(targetParts[0], targetParts[1] - 1, targetParts[2]);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `已過期 ${Math.abs(diffDays)} 天 ⚠️`, style: 'text-rose-400 font-semibold' };
    } else if (diffDays === 1) {
      return { text: '明天 ⏰', style: 'text-amber-400 font-bold' };
    } else {
      return { text: `剩餘 ${diffDays} 天`, style: 'text-slate-300' };
    }
  };

  const getMatchedCasesForMemo = (target: string) => {
    if (archivedRows.length <= 1) return [];
    const dataRows = archivedRows.slice(1);
    
    const cleanTarget = target.trim().toLowerCase();
    
    // 1. If target is a URL or contains app.soul-treasure.net, match exactly with the archived case URL
    if (cleanTarget.startsWith('http://') || cleanTarget.startsWith('https://') || cleanTarget.includes('app.soul-treasure.net')) {
      let normTarget = cleanTarget;
      if (!normTarget.startsWith('http')) {
        normTarget = 'https://' + normTarget;
      }
      return dataRows.filter(row => {
        const savedUrl = (row[0] || '').trim().toLowerCase();
        if (!savedUrl) return false;
        try {
          const url1 = new URL(savedUrl);
          const url2 = new URL(normTarget);
          return url1.pathname === url2.pathname;
        } catch (err) {
          return savedUrl.includes(cleanTarget) || cleanTarget.includes(savedUrl);
        }
      });
    }
    
    // 2. Extract stock code if any (4 to 6 digits)
    const codeMatch = target.match(/\d{4,6}/);
    const stockCode = codeMatch ? codeMatch[0] : '';
    
    // Clean target to find Chinese characters of length >= 2
    const chineseWords = target.match(/[\u4e00-\u9fa5]+/g) || [];
    const mainChineseWords = chineseWords.filter(w => w.length >= 2);
    
    return dataRows.filter(row => {
      const caseName = row[1] || '';
      const savedUrl = (row[0] || '').trim().toLowerCase();
      
      // If we have a stock code, does the case name contain this code?
      if (stockCode && caseName.includes(stockCode)) {
        return true;
      }
      
      // Do any of our key Chinese words appear in the case name?
      if (mainChineseWords.length > 0) {
        return mainChineseWords.some(word => caseName.includes(word));
      }
      
      // Fallback: simple substring match of the whole target
      if (cleanTarget) {
        if (caseName.toLowerCase().includes(cleanTarget)) {
          return true;
        }
        if (savedUrl && (savedUrl.includes(cleanTarget) || cleanTarget.includes(savedUrl))) {
          return true;
        }
      }
      
      return false;
    });
  };

  const handleAddMemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoTarget.trim()) return;

    const periodInfo = PERIODS[memoPeriod];
    if (!periodInfo) return;

    const targetDate = addDaysToDate(memoBaseDate, periodInfo.days);

    const newMemo = {
      id: Math.random().toString(36).substring(2, 9),
      target: memoTarget.trim(),
      baseDate: memoBaseDate,
      period: memoPeriod,
      periodLabel: periodInfo.label,
      targetDate: targetDate,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    setMemos(prev => [newMemo, ...prev]);
    setMemoTarget('');
    setToast({ type: 'success', message: `已成功新增「${memoTarget.trim()}」觀察備忘！` });
  };

  const handleDeleteMemo = (id: string) => {
    const memoToDelete = memos.find(m => m.id === id);
    setMemos(prev => prev.filter(m => m.id !== id));
    if (memoToDelete) {
      setToast({ type: 'success', message: `已刪除「${memoToDelete.target}」備忘。` });
    }
  };

  const handleToggleMemoStatus = (id: string) => {
    setMemos(prev => prev.map(m => m.id === id ? { ...m, isCompleted: !m.isCompleted } : m));
  };

  const handleUpdateMemoNote = (id: string, note: string) => {
    setMemos(prev => prev.map(m => m.id === id ? { ...m, note } : m));
  };

  const handleUpdateMemoCategory = (id: string, category: string) => {
    setMemos(prev => prev.map(m => m.id === id ? { ...m, category } : m));
  };

  useEffect(() => {
    try {
      localStorage.setItem('qimen_observation_memos', JSON.stringify(memos));
    } catch (err) {
      console.error('Error saving memos:', err);
    }
  }, [memos]);

  // Toast notification state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string; link?: string; isAuthError?: boolean } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Initialize Authentication state on load
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }

    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setLoginError(err?.message || String(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setParsedResult(null);
      setFetchError(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const fillExample = () => {
    setUrl('https://app.soul-treasure.net/qimen-case/fh2fkjul');
    setFetchError(null);
    setDuplicateCase(null);
  };

  const handleFetchCase = async (e?: React.FormEvent, forceBypass = false) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    // Set normalized URL back to state
    setUrl(targetUrl);

    if (!targetUrl.includes('app.soul-treasure.net')) {
      setFetchError('請輸入來自 app.soul-treasure.net 的有效奇門案例網址');
      return;
    }

    setFetchError(null);
    setDuplicateCase(null);

    // Check for duplicate URL in existing archive records (unless bypassed)
    if (!forceBypass && archivedRows.length > 1) {
      const dataRows = archivedRows.slice(1);
      const dupIdx = dataRows.findIndex(row => {
        const savedUrl = row[0] || '';
        if (!savedUrl.trim()) return false;
        try {
          const url1 = new URL(savedUrl.trim());
          const url2 = new URL(targetUrl);
          return url1.pathname === url2.pathname && url1.hostname === url2.hostname;
        } catch (err) {
          return savedUrl.trim().toLowerCase() === targetUrl.toLowerCase();
        }
      });

      if (dupIdx !== -1) {
        const dupRow = dataRows[dupIdx];
        setDuplicateCase({
          name: dupRow[1] || '未具名案例',
          url: dupRow[0] || targetUrl,
          solarTime: dupRow[2] || '',
          rowIdx: dupIdx
        });
        return;
      }
    }

    setIsFetching(true);
    setParsedResult(null);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/fetch-case', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '讀取並解析網頁內容時發生錯誤');
      }

      const data = await response.json();
      setParsedResult(data);
    } catch (err: any) {
      setFetchError(err.message || '無法連線至解析伺服器，請重試');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSaveToSheets = async () => {
    if (!parsedResult || !token) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const rowValues = [
        url.trim(),
        parsedResult.caseName,
        parsedResult.solarTime,
        parsedResult.lunarTime,
        parsedResult.palaces["巽宮"] || "",
        parsedResult.palaces["坤宮"] || "",
        parsedResult.palaces["震宮"] || "",
        parsedResult.palaces["中宮"] || "",
        parsedResult.palaces["兌宮"] || "",
        parsedResult.palaces["艮宮"] || "",
        parsedResult.palaces["坎宮"] || "",
        parsedResult.palaces["乾宮"] || "",
        parsedResult.palaces["離宮"] || "",
        "", // Google文件網址
        "", // 自訂股市網址
        ""  // 自訂股市名稱
      ];

      const response = await fetch('/api/save-to-sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: token,
          rowValues
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        const errorMsg = errData.error || '存檔至 Google Sheets 失敗';
        const isAuth = response.status === 401 || errData.isAuthError || errorMsg.includes('401') || errorMsg.toLowerCase().includes('token') || errorMsg.includes('授權');
        const err = new Error(isAuth ? '您的 Google 登入或授權已過期，請重新登入！' : errorMsg);
        if (isAuth) {
          (err as any).isAuthError = true;
        }
        throw err;
      }

      const resData = await response.json();
      const sId = resData.spreadsheetId;
      setSpreadsheetId(sId);

      setSaveStatus('success');
      setShowConfirmModal(false);

      setToast({
        type: 'success',
        message: '🎉 案例已成功存檔至 Google Sheets！',
        link: sId ? `https://docs.google.com/spreadsheets/d/${sId}/edit` : undefined
      });

      // Record in current session logs
      setSessionLogs(prev => [
        {
          name: parsedResult.caseName,
          url: url.trim(),
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);

      // Fetch fresh rows directly from Google Sheets to ensure indices and data are perfectly synced
      await fetchArchivedRows();

      // Clear the url input to allow entering the next case
      setUrl('');

    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || '寫入 Google Sheets 失敗';
      setSaveError(errMsg);
      setSaveStatus('error');
      setToast({
        type: 'error',
        message: `❌ 存檔失敗：${errMsg}`,
        isAuthError: err.isAuthError
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fetchArchivedRows = async () => {
    if (!token) return;
    setIsLoadingRows(true);
    setRowsError(null);
    try {
      const response = await fetch('/api/get-sheet-rows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken: token }),
      });

      if (!response.ok) {
        const errData = await response.json();
        const errorMsg = errData.error || '取得存檔資料失敗';
        if (response.status === 401 || errorMsg.includes('401') || errorMsg.toLowerCase().includes('token') || errorMsg.includes('授權')) {
          handleLogout();
          throw new Error('Google 登入或授權已過期，請重新登入！');
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.spreadsheetId) {
        setSpreadsheetId(data.spreadsheetId);
      }
      
      const rawRows = data.rows || [];
      setArchivedRows(rawRows);
    } catch (err: any) {
      console.error(err);
      setRowsError(err.message || '連線至伺服器讀取存檔時發生錯誤');
    } finally {
      setIsLoadingRows(false);
    }
  };

  const handleSaveDocUrl = async (originalRowIndex: number) => {
    if (!token || !spreadsheetId) return;
    setIsUpdatingDoc(true);
    try {
      const response = await fetch('/api/update-doc-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: token,
          spreadsheetId,
          rowIndex: originalRowIndex + 1, // 1-based index in Google Sheets
          docUrl: editingDocUrl.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        const errorMsg = errData.error || '更新試算表資料失敗';
        const isAuth = response.status === 401 || errData.isAuthError || errorMsg.includes('401') || errorMsg.toLowerCase().includes('token') || errorMsg.includes('授權');
        const err = new Error(isAuth ? '您的 Google 登入或授權已過期，請重新登入！' : errorMsg);
        if (isAuth) {
          (err as any).isAuthError = true;
        }
        throw err;
      }

      // Update local state in-place
      setArchivedRows(prev => {
        const next = [...prev];
        if (next[originalRowIndex]) {
          // Clone the row array to trigger React re-render
          const updatedRow = [...next[originalRowIndex]];
          while (updatedRow.length < 14) {
            updatedRow.push('');
          }
          updatedRow[13] = editingDocUrl.trim();
          next[originalRowIndex] = updatedRow;
        }
        return next;
      });

      setEditingDocIndex(null);
      setToast({
        type: 'success',
        message: '🎉 成功儲存 Google 文件網址！'
      });
    } catch (err: any) {
      console.error(err);
      setToast({
        type: 'error',
        message: `❌ 儲存失敗：${err.message || '無法連線至伺服器'}`,
        isAuthError: err.isAuthError
      });
    } finally {
      setIsUpdatingDoc(false);
    }
  };

  const handleSaveStockUrl = async (originalRowIndex: number) => {
    if (!token || !spreadsheetId) return;
    setIsUpdatingStock(true);
    try {
      const response = await fetch('/api/update-stock-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: token,
          spreadsheetId,
          rowIndex: originalRowIndex + 1, // 1-based index in Google Sheets
          stockUrl: editingStockUrl.trim(),
          stockName: editingStockName.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        const errorMsg = errData.error || '更新自訂股市網址與名稱失敗';
        const isAuth = response.status === 401 || errData.isAuthError || errorMsg.includes('401') || errorMsg.toLowerCase().includes('token') || errorMsg.includes('授權');
        const err = new Error(isAuth ? '您的 Google 登入或授權已過期，請重新登入！' : errorMsg);
        if (isAuth) {
          (err as any).isAuthError = true;
        }
        throw err;
      }

      // Update local state in-place
      setArchivedRows(prev => {
        const next = [...prev];
        if (next[originalRowIndex]) {
          // Clone the row array to trigger React re-render
          const updatedRow = [...next[originalRowIndex]];
          while (updatedRow.length < 16) {
            updatedRow.push('');
          }
          updatedRow[14] = editingStockUrl.trim();
          updatedRow[15] = editingStockName.trim();
          next[originalRowIndex] = updatedRow;
        }
        return next;
      });

      setEditingStockIndex(null);
      setToast({
        type: 'success',
        message: '🎉 成功儲存自訂股市資訊！'
      });
    } catch (err: any) {
      console.error(err);
      setToast({
        type: 'error',
        message: `❌ 儲存失敗：${err.message || '無法連線至伺服器'}`,
        isAuthError: err.isAuthError
      });
    } finally {
      setIsUpdatingStock(false);
    }
  };

  const handleDeleteRow = async (originalRowIndex: number) => {
    if (!token || !spreadsheetId) return;
    setIsDeleting(true);
    try {
      const response = await fetch('/api/delete-sheet-row', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: token,
          spreadsheetId,
          rowIndex: originalRowIndex + 1, // 1-based index in Google Sheets
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        const errorMsg = errData.error || '刪除案例失敗';
        const isAuth = response.status === 401 || errData.isAuthError || errorMsg.includes('401') || errorMsg.toLowerCase().includes('token') || errorMsg.includes('授權');
        const err = new Error(isAuth ? '您的 Google 登入或授權已過期，請重新登入！' : errorMsg);
        if (isAuth) {
          (err as any).isAuthError = true;
        }
        throw err;
      }

      // Remove the row from local state in-place
      setArchivedRows(prev => {
        const next = [...prev];
        next.splice(originalRowIndex, 1);
        return next;
      });

      setDeletingRowIndex(null);
      setToast({
        type: 'success',
        message: '🎉 已成功從 Google Sheets 刪除該案例！'
      });
    } catch (err: any) {
      console.error(err);
      setToast({
        type: 'error',
        message: `❌ 刪除失敗：${err.message || '無法連線至伺服器'}`,
        isAuthError: err.isAuthError
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Automatically fetch sheet rows when user logs in
  useEffect(() => {
    if (token) {
      fetchArchivedRows();
    }
  }, [token]);

  const normalizeQimenText = (text: string): string => {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/值/g, '直')
      .replace(/螣|塍/g, '騰');
  };

  const isQimenElement = (term: string) => {
    const normalizedTerm = normalizeQimenText(term);
    const elements = [
      // 八神
      '值符', '直符', '騰蛇', '螣蛇', '塍蛇', '太陰', '六合', '白虎', '玄武', '九地', '九天',
      // 九星
      '天蓬', '天芮', '天沖', '天輔', '天禽', '天心', '天柱', '天任', '天英',
      // 八門
      '開門', '休門', '生門', '傷門', '杜門', '景門', '死門', '驚門',
      '開', '休', '生', '傷', '杜', '景', '死', '驚',
      // 常用奇門術語
      '五不遇時', '旬空', '馬星', '空亡', '擊刑', '門迫', '入墓'
    ];
    return elements.some(el => {
      const normalizedEl = normalizeQimenText(el);
      return normalizedTerm.includes(normalizedEl) || normalizedEl.includes(normalizedTerm);
    });
  };

  const getStockInfo = (caseName: string) => {
    const codeMatch = caseName.match(/\d{4,6}/);
    if (!codeMatch) return null;
    const stockCode = codeMatch[0];
    const beforeCode = caseName.substring(0, codeMatch.index);
    const nameMatch = beforeCode.match(/([\u4e00-\u9fa5]{2,4})\s*[\(\uff08]?\s*$/);
    const stockName = nameMatch ? nameMatch[1] : '';
    return { stockCode, stockName };
  };

  const getSearchablePalaceText = (content: any): string => {
    if (!content) return '';
    const lines = String(content).split('\n');
    // Take first 2 lines (宫位符号 and 状态标记)
    return lines.slice(0, 2).join('\n');
  };

  const parseDateString = (dateStr: string): number => {
    if (!dateStr) return 0;
    
    // Replace Chinese date characters with standard separators: "2026年7月15日0時33分0秒" -> "2026/7/15 0:33:0"
    let cleaned = dateStr
      .replace(/年|月/g, '/')
      .replace(/日/g, ' ')
      .replace(/時|分/g, ':')
      .replace(/秒/g, '');
    
    let parsed = Date.parse(cleaned);
    if (!isNaN(parsed)) {
      return parsed;
    }
    
    const match = dateStr.match(/(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日(?:\s*(\d+)\s*時)?(?:\s*(\d+)\s*分)?(?:\s*(\d+)\s*秒)?/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      const second = match[6] ? parseInt(match[6], 10) : 0;
      return new Date(year, month, day, hour, minute, second).getTime();
    }

    const standardParsed = Date.parse(dateStr);
    if (!isNaN(standardParsed)) {
      return standardParsed;
    }

    return 0;
  };

  const extractSolarDateTime = (dateStr: string) => {
    if (!dateStr) return null;
    
    const match = dateStr.match(/(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日(?:\s*(\d+)\s*時)?(?:\s*(\d+)\s*分)?(?:\s*(\d+)\s*秒)?/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10),
        hour: match[4] ? parseInt(match[4], 10) : 0,
        minute: match[5] ? parseInt(match[5], 10) : 0,
        second: match[6] ? parseInt(match[6], 10) : 0
      };
    }
    
    const parts = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (parts) {
      return {
        year: parseInt(parts[1], 10),
        month: parseInt(parts[2], 10),
        day: parseInt(parts[3], 10),
        hour: parts[4] ? parseInt(parts[4], 10) : 0,
        minute: parts[5] ? parseInt(parts[5], 10) : 0,
        second: parts[6] ? parseInt(parts[6], 10) : 0
      };
    }
    
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
        minute: d.getMinutes(),
        second: d.getSeconds()
      };
    }
    
    return null;
  };

  const getGanzhiString = (dateStr: string): string => {
    const dt = extractSolarDateTime(dateStr);
    if (!dt) return '';
    try {
      const solar = Solar.fromYmdHms(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second);
      const lunar = solar.getLunar();
      return `干支：${lunar.getYearInGanZhi()}年　${lunar.getMonthInGanZhi()}月　${lunar.getDayInGanZhi()}日　${lunar.getTimeInGanZhi()}時`;
    } catch (err) {
      console.error('Error calculating GanZhi:', err);
      return '';
    }
  };

  const getFilteredRows = () => {
    if (archivedRows.length <= 1) return [];
    const dataRows = archivedRows.slice(1);
    
    let filtered = dataRows;

    if (searchQuery.trim()) {
      const terms = searchQuery
        .toLowerCase()
        .split(/[\s\+\uff0b]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0);

      if (terms.length > 0) {
        // Separate into Qimen terms and non-Qimen terms
        const qimenTerms: string[] = [];
        const nonQimenTerms: string[] = [];

        terms.forEach(term => {
          if (isQimenElement(term)) {
            qimenTerms.push(term);
          } else {
            nonQimenTerms.push(term);
          }
        });

        filtered = dataRows.filter(row => {
          // 1. All non-Qimen terms must match ANYWHERE in the entire row
          const matchesNonQimen = nonQimenTerms.every(term => {
            return row.some(cell => {
              if (!cell) return false;
              return normalizeQimenText(String(cell)).includes(normalizeQimenText(term));
            });
          });

          if (!matchesNonQimen) return false;

          // 2. All Qimen terms (if any) must match TOGETHER in the SAME palace (specific palace columns)
          if (qimenTerms.length > 0) {
            const headerRow = archivedRows[0] || [];
            const PALACE_SEARCH_NAMES = ['巽', '坤', '震', '中', '兌', '艮', '坎', '乾', '離'];
            const palaceIndices: number[] = [];
            PALACE_SEARCH_NAMES.forEach(sn => {
              const foundIdx = headerRow.findIndex(h => String(h).includes(sn));
              if (foundIdx !== -1) {
                palaceIndices.push(foundIdx);
              }
            });
            const targetIndices = palaceIndices.length > 0 ? palaceIndices : [4, 5, 6, 7, 8, 9, 10, 11, 12];

            const hasSamePalaceMatch = targetIndices.some(pIdx => {
              const palace = row[pIdx];
              if (!palace) return false;
              const searchableText = getSearchablePalaceText(palace);
              const normalizedPalace = normalizeQimenText(searchableText);
              return qimenTerms.every(qTerm => {
                return normalizedPalace.includes(normalizeQimenText(qTerm));
              });
            });

            if (!hasSamePalaceMatch) return false;
          }

          return true;
        });
      }
    }

    // Now, sort the filtered rows by date of Solar Time (row[2])
    const sorted = [...filtered].sort((a, b) => {
      const timeA = parseDateString(a[2] || '');
      const timeB = parseDateString(b[2] || '');
      if (sortOrder === 'desc') {
        return timeB - timeA; // Newest first
      } else {
        return timeA - timeB; // Oldest first
      }
    });

    return sorted;
  };

  const getPalaceHighlights = (row: any[], terms: string[]) => {
    // Filter terms to standard Qimen elements to see if we match them in same palace
    const qimenSearchTerms = terms.filter(isQimenElement);
    if (qimenSearchTerms.length === 0) return [];

    const headerRow = archivedRows[0] || [];
    const DEFAULT_PALACE_MAPPING = [
      { index: 4, name: '巽宮 (4)', search: '巽' },
      { index: 12, name: '離宮 (9)', search: '離' },
      { index: 5, name: '坤宮 (2)', search: '坤' },
      { index: 6, name: '震宮 (3)', search: '震' },
      { index: 7, name: '中宮 (5)', search: '中' },
      { index: 8, name: '兌宮 (7)', search: '兌' },
      { index: 9, name: '艮宮 (8)', search: '艮' },
      { index: 10, name: '坎宮 (1)', search: '坎' },
      { index: 11, name: '乾宮 (6)', search: '乾' },
    ];

    const PALACE_MAPPING = DEFAULT_PALACE_MAPPING.map(p => {
      const foundIdx = headerRow.findIndex(h => String(h).includes(p.search));
      return {
        index: foundIdx !== -1 ? foundIdx : p.index,
        name: p.name
      };
    });

    const GODS = ['值符', '直符', '騰蛇', '螣蛇', '塍蛇', '太陰', '六合', '白虎', '玄武', '九地', '九天'];
    const STARS = ['天蓬', '天芮', '天沖', '天輔', '天禽', '天心', '天柱', '天任', '天英', '禽芮'];
    const GATES = ['開門', '休門', '生門', '傷門', '杜門', '景門', '死門', '驚門'];
    const OTHER_TERMS = ['五不遇時', '旬空', '馬星', '空亡', '擊刑', '門迫', '入墓'];

    const matchedPalaces: {
      palaceName: string;
      elements: string[];
      matchedTerms: string[];
      missingCategories: string[];
    }[] = [];

    PALACE_MAPPING.forEach(p => {
      const content = row[p.index];
      if (!content) return;

      const contentStr = String(content);
      const searchableText = getSearchablePalaceText(contentStr);
      const normalizedContent = normalizeQimenText(searchableText);

      // Check if this palace matches ALL searched Qimen terms (necessary condition)
      const isFullMatch = qimenSearchTerms.every(qTerm => {
        return normalizedContent.includes(normalizeQimenText(qTerm));
      });

      if (isFullMatch) {
        // Extract symbols in a clean, standard order: Gods -> Stars -> Gates -> Other Terms
        const foundGods: string[] = [];
        const foundStars: string[] = [];
        const foundGates: string[] = [];
        const foundTerms: string[] = [];

        GODS.forEach(el => {
          if (normalizedContent.includes(normalizeQimenText(el))) {
            const firstLine = searchableText.split('\n')[0] || '';
            if (firstLine.includes(el) && !foundGods.includes(el)) {
              foundGods.push(el);
            } else if (!foundGods.some(f => normalizeQimenText(f) === normalizeQimenText(el))) {
              if (normalizeQimenText(firstLine).includes(normalizeQimenText(el))) {
                foundGods.push(el);
              }
            }
          }
        });

        STARS.forEach(el => {
          if (normalizedContent.includes(normalizeQimenText(el))) {
            const firstLine = searchableText.split('\n')[0] || '';
            if (firstLine.includes(el) && !foundStars.includes(el)) {
              foundStars.push(el);
            } else if (!foundStars.some(f => normalizeQimenText(f) === normalizeQimenText(el))) {
              if (normalizeQimenText(firstLine).includes(normalizeQimenText(el))) {
                foundStars.push(el);
              }
            }
          }
        });

        GATES.forEach(el => {
          if (normalizedContent.includes(normalizeQimenText(el))) {
            const firstLine = searchableText.split('\n')[0] || '';
            if (firstLine.includes(el) && !foundGates.includes(el)) {
              foundGates.push(el);
            } else if (!foundGates.some(f => normalizeQimenText(f) === normalizeQimenText(el))) {
              if (normalizeQimenText(firstLine).includes(normalizeQimenText(el))) {
                foundGates.push(el);
              }
            }
          }
        });

        OTHER_TERMS.forEach(el => {
          if (normalizedContent.includes(normalizeQimenText(el))) {
            if (searchableText.includes(el) && !foundTerms.includes(el)) {
              foundTerms.push(el);
            } else if (!foundTerms.some(f => normalizeQimenText(f) === normalizeQimenText(el))) {
              if (normalizeQimenText(searchableText).includes(normalizeQimenText(el))) {
                foundTerms.push(el);
              }
            }
          }
        });

        // Combine them in standard Qimen layout order: 八神, 九星, 八門, (Other terms)
        const sortedElements = [...foundGods, ...foundStars, ...foundGates, ...foundTerms];

        // Find which terms match in this palace
        const matchedTermsInPalace = qimenSearchTerms.filter(qTerm => {
          return normalizedContent.includes(normalizeQimenText(qTerm));
        });

        // Calculate missing standard categories
        const isCenter = p.name.includes('中宮');
        const missingCategories: string[] = [];
        if (!isCenter) {
          const firstLine = searchableText.split('\n')[0] || '';
          const normalizedFirstLine = normalizeQimenText(firstLine);

          const hasGod = GODS.some(g => normalizedFirstLine.includes(normalizeQimenText(g)));
          const hasStar = STARS.some(s => normalizedFirstLine.includes(normalizeQimenText(s)));
          const hasGate = GATES.some(gt => normalizedFirstLine.includes(normalizeQimenText(gt)));

          if (!hasGod) missingCategories.push('八神');
          if (!hasStar) missingCategories.push('九星');
          if (!hasGate) missingCategories.push('八門');
        }

        matchedPalaces.push({
          palaceName: p.name,
          elements: sortedElements,
          matchedTerms: matchedTermsInPalace,
          missingCategories: missingCategories
        });
      }
    });

    return matchedPalaces;
  };

  const spreadsheetLink = spreadsheetId 
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` 
    : 'https://docs.google.com';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-950 selection:text-indigo-200">
      
      {/* HEADER BAR */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 rounded-lg flex items-center justify-center text-lg font-bold shadow-lg shadow-indigo-500/20 text-white w-10 h-10">
              <span>遁</span>
            </div>
            <div>
              <span className="font-display font-bold text-base sm:text-lg text-white tracking-tight flex items-center">
                奇門遁甲自動存檔助手
                <span className="text-indigo-400 font-mono text-xs ml-2 hidden sm:inline-block bg-indigo-950/50 border border-indigo-800/30 px-1.5 py-0.5 rounded">v1.2.0</span>
              </span>
              <span className="text-xs text-slate-500 font-medium block">
                Qimen Dunjia Auto-Archiver
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs text-slate-400 hidden sm:inline-block">Google Sheets: 已連接</span>
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-6 h-6 rounded-full border border-slate-700" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-300 hidden md:inline-block max-w-[100px] truncate">
                  {user.displayName}
                </span>
                <button 
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-red-400 transition-colors p-0.5 rounded"
                  title="登出"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                <span className="text-xs text-slate-500">尚未登入</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {needsAuth ? (
          /* AUTHENTICATION PORTAL */
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto my-12 bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden"
          >
            <div className="p-8 text-center border-b border-slate-800 bg-gradient-to-b from-slate-900/50 to-slate-900">
              <div className="inline-flex p-4 rounded-3xl bg-indigo-950/50 text-indigo-400 border border-indigo-800/30 mb-4">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="font-display font-bold text-2xl text-white tracking-tight">
                登入您的 Google 帳戶
              </h2>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                本工具需要存取您的 Google Sheets 試算表與雲端硬碟，以便建立「我的奇門遁甲案例庫」並自動存檔案例。
              </p>
            </div>

            <div className="p-8 bg-slate-900/30 space-y-6">
              {isInIframe && (
                <div className="p-4 bg-indigo-950/40 border border-indigo-900/30 rounded-2xl flex items-start space-x-3 text-indigo-300 text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
                  <div>
                    <span className="font-bold">預覽視窗限制提示：</span>
                    由於瀏覽器安全機制與第三方 Cookie 阻擋，在 AI Studio 內嵌預覽視窗中進行 Google 登入可能會遇到「網路連線失敗 (network-request-failed)」錯誤。
                    <span className="block mt-1 text-amber-300 font-semibold">
                      強烈建議點擊下方「在新分頁中開啟」按鈕，在獨立分頁中完成正常授權！
                    </span>
                  </div>
                </div>
              )}

              {loginError && (
                <div className="p-4 bg-rose-950/40 border border-rose-900/30 rounded-2xl space-y-2">
                  <div className="flex items-start space-x-3 text-rose-300 text-xs leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <div>
                      <span className="font-bold">登入失敗：</span>
                      <span className="font-mono text-rose-200">{loginError}</span>
                      {loginError.includes('network-request-failed') && (
                        <p className="mt-1.5 text-slate-300">
                          這通常是因為瀏覽器阻擋了 Iframe 與 Google 授權伺服器之間的通訊。請點擊下方「在新分頁中開啟」按鈕即可完美解決此問題。
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-start space-x-3 text-xs text-slate-400">
                  <div className="mt-0.5 text-indigo-400">✦</div>
                  <p>建立並讀取名為「我的奇門遁甲案例庫」的 Google 試算表</p>
                </div>
                <div className="flex items-start space-x-3 text-xs text-slate-400">
                  <div className="mt-0.5 text-indigo-400">✦</div>
                  <p>精確儲存案例名稱、起盤時間、農曆，以及完整九宮克應斷語</p>
                </div>
                <div className="flex items-start space-x-3 text-xs text-slate-400">
                  <div className="mt-0.5 text-indigo-400">✦</div>
                  <p>
                    純前端安全運行，所有憑證皆在本機端快取。
                    <br />
                    <span className="text-[11px] text-slate-500 mt-1 inline-block">
                      ⚠️ 註：基於 Google 安全機制，授權憑證將於 1 小時後自動過期，屆時需再次點擊登入以換取新憑證。
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center space-x-3 py-3 px-4 border border-indigo-500 rounded-xl shadow-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer font-semibold text-white"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                  )}
                  <span>使用 Google 帳戶登入</span>
                </button>

                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-slate-700 hover:border-slate-600 rounded-xl shadow-md bg-slate-800 hover:bg-slate-700 transition-all font-semibold text-xs text-slate-300"
                >
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                  <span>在新分頁開啟應用程式 (推薦)</span>
                </a>
              </div>
            </div>
          </motion.div>
        ) : (
          /* MAIN APPLICATION DASHBOARD */
          <div className="space-y-8">
            
            {/* TAB SELECTOR */}
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => setActiveTab('parse')}
                className={`flex items-center space-x-2 py-3 px-4 sm:px-6 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'parse'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                } rounded-t-xl`}
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>奇門案例盤面自動讀取</span>
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={`flex items-center space-x-2 py-3 px-4 sm:px-6 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'search'
                    ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                } rounded-t-xl`}
              >
                <Search className="w-4 h-4 text-amber-400" />
                <span>存檔案例檢索與自由搜索</span>
                {archivedRows.length > 1 && (
                  <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                    {archivedRows.length - 1}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'parse' ? (
              <>
                {/* INPUT FORM */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 sm:p-8"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display font-bold text-xl text-white tracking-tight flex items-center space-x-2">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      <span>奇門案例盤面自動讀取</span>
                    </h2>
                    <div className="text-xs text-slate-500 font-mono hidden sm:block">待處理網址</div>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    請輸入來自 app.soul-treasure.net 的起盤案例網址。系統會自動利用後端 AI 解析九宮盤與克應斷語。
                  </p>

                  <form onSubmit={handleFetchCase} className="mt-6">
                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                      <div className="relative flex-1">
                        <input
                          type="url"
                          placeholder="例如: https://app.soul-treasure.net/qimen-case/fh2fkjul"
                          value={url}
                          onChange={(e) => {
                            setUrl(e.target.value);
                            if (duplicateCase) setDuplicateCase(null);
                            if (fetchError) setFetchError(null);
                          }}
                          disabled={isFetching}
                          className="w-full pl-4 pr-24 py-3 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-sm placeholder:text-slate-500 bg-black/40 font-mono"
                          required
                        />
                        <button
                          type="button"
                          onClick={fillExample}
                          disabled={isFetching}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/60 px-2.5 py-1 rounded border border-indigo-800/30 transition-colors disabled:opacity-50"
                        >
                          填入範例
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={isFetching || !url.trim()}
                        className="sm:w-36 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/10 transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        {isFetching ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>解析中...</span>
                          </>
                        ) : (
                          <>
                            <span>開始解析</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {fetchError && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start space-x-3 text-red-300"
                    >
                      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                      <div className="text-sm font-medium">{fetchError}</div>
                    </motion.div>
                  )}

                  {duplicateCase && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 p-6 rounded-2xl bg-amber-950/25 border border-amber-800/40 space-y-4"
                    >
                      <div className="flex items-start space-x-3 text-amber-300">
                        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" />
                        <div className="space-y-1">
                          <h4 className="text-base font-bold text-amber-200">
                            ⚠️ 此案例網址先前已經成功存檔囉！
                          </h4>
                          <p className="text-sm text-amber-400/90">
                            您不小心輸入了重複的網址，無須再次解析或存檔，避免重覆記錄。
                          </p>
                        </div>
                      </div>

                      {/* Case metadata box */}
                      <div className="bg-black/30 rounded-xl p-4 border border-amber-900/20 text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">案例名稱：</span>
                          <span className="text-amber-200 font-semibold">{duplicateCase.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">起盤時間：</span>
                          <span className="text-slate-300 font-mono">{duplicateCase.solarTime}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">原始網址：</span>
                          <span className="text-slate-400 font-mono text-xs truncate max-w-[240px] sm:max-w-md">{duplicateCase.url}</span>
                        </div>
                      </div>

                      {/* Interactive Buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery(duplicateCase.name);
                            setActiveTab('search');
                            setDuplicateCase(null);
                          }}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-md transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>前往檢索此案例</span>
                        </button>

                        <a
                          href={spreadsheetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>直接開啟試算表</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            handleFetchCase(undefined, true);
                          }}
                          className="px-4 py-2 bg-red-950/40 hover:bg-red-900/40 border border-red-900/30 text-red-300 hover:text-red-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          仍然重新解析
                        </button>

                        <button
                          type="button"
                          onClick={() => setDuplicateCase(null)}
                          className="px-4 py-2 bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                {/* RESULTS VIEW */}
                <AnimatePresence mode="wait">
                  {parsedResult && (
                    <motion.div
                      key="parsed-results"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="space-y-6"
                    >
                      {/* CASE GENERAL INFO HEADER */}
                      <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 sm:p-8">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 pb-6 border-b border-slate-800/50">
                          <div>
                            <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/50 border border-indigo-800/30 px-2.5 py-1 rounded-full">
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>案例解析成功</span>
                            </div>
                            <h2 className="mt-2 font-display font-bold text-xl sm:text-2xl text-white">
                              {parsedResult.caseName}
                            </h2>
                          </div>

                          <div className="pt-2 md:pt-0 shrink-0">
                            {saveStatus === 'success' ? (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                                <div className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-emerald-950/50 text-emerald-300 border border-emerald-800/30 rounded-xl text-sm font-semibold">
                                  <Check className="w-4 h-4" />
                                  <span>已成功寫入試算表</span>
                                </div>
                                <a
                                  href={spreadsheetLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                >
                                  <span>開啟 Google 試算表</span>
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowConfirmModal(true)}
                                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/10 transition-all active:scale-95 cursor-pointer"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                                <span>自動存檔至 Google Sheets</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Bento styled metadata row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
                          <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/80">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">案例名稱</label>
                            <p className="text-base text-white font-semibold truncate">{parsedResult.caseName}</p>
                          </div>
                          <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/80">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">起盤時間 (公元)</label>
                            <p className="text-base text-indigo-300 font-semibold">{parsedResult.solarTime}</p>
                          </div>
                          <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/80">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">農曆時間</label>
                            <p className="text-base text-amber-300 font-semibold">{parsedResult.lunarTime}</p>
                          </div>
                        </div>

                        {saveError && (
                          <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start space-x-3 text-red-300 text-sm font-medium">
                            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                            <div>{saveError}</div>
                          </div>
                        )}
                      </div>

                      {/* PALACE GRID VISUALIZATION */}
                      <div>
                        <h3 className="font-display font-bold text-lg text-white tracking-tight mb-4 flex items-center space-x-2">
                          <span>奇門遁甲九宮盤面預覽</span>
                          <span className="text-xs font-semibold text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-full">Bento Style 3x3 佈局</span>
                        </h3>

                        {/* Desktop/Tablet 3x3 Grid Layout */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <PalaceCard name="巽宮 (4)" direction="東南方 (木)" content={parsedResult.palaces["巽宮"]} />
                          <PalaceCard name="離宮 (9)" direction="南方 (火)" content={parsedResult.palaces["離宮"]} />
                          <PalaceCard name="坤宮 (2)" direction="西南方 (土)" content={parsedResult.palaces["坤宮"]} isHighlighted={true} />
                          <PalaceCard name="震宮 (3)" direction="東方 (木)" content={parsedResult.palaces["震宮"]} />
                          <PalaceCard name="中宮 (5)" direction="中央 (土)" content={parsedResult.palaces["中宮"]} isCenter={true} />
                          <PalaceCard name="兌宮 (7)" direction="西方 (金)" content={parsedResult.palaces["兌宮"]} />
                          <PalaceCard name="艮宮 (8)" direction="東北方 (土)" content={parsedResult.palaces["艮宮"]} />
                          <PalaceCard name="坎宮 (1)" direction="北方 (水)" content={parsedResult.palaces["坎宮"]} />
                          <PalaceCard name="乾宮 (6)" direction="西北方 (金)" content={parsedResult.palaces["乾宮"]} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* OBSERVATION MEMO ZONE */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 sm:p-8 mt-6"
                >
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800/50">
                    <div>
                      <h2 className="font-display font-bold text-xl text-white tracking-tight flex items-center space-x-2">
                        <Calendar className="w-5 h-5 text-emerald-400" />
                        <span>💡 奇門 / 股市觀察備忘區</span>
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        記錄需要追蹤的股票或案例，並自動計算未來觀察提醒日。
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleAddMemo} className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Target input */}
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          觀察對象 / 名稱
                        </label>
                        <input
                          type="text"
                          placeholder="例如: 億光 2393 或 坤宮開門案例"
                          value={memoTarget}
                          onChange={(e) => setMemoTarget(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-sm placeholder:text-slate-500 bg-black/40"
                          required
                        />
                      </div>

                      {/* Period select */}
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          追蹤觀察週期 (自動計算天數)
                        </label>
                        <select
                          value={memoPeriod}
                          onChange={(e) => setMemoPeriod(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-sm bg-slate-950/80"
                        >
                          <option value="2_weeks">兩星期 (14 天)</option>
                          <option value="1_month">一個月 (30 天)</option>
                          <option value="2_months">兩個月 (60 天)</option>
                          <option value="3_months">三個月 (90 天)</option>
                          <option value="6_months">半年 (180 天)</option>
                          <option value="1_year">一年 (365 天)</option>
                        </select>
                      </div>

                      {/* Base Date select */}
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          起算基準日 (預設今天)
                        </label>
                        <input
                          type="date"
                          value={memoBaseDate}
                          onChange={(e) => setMemoBaseDate(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-sm bg-slate-950/80 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 bg-slate-950/20 p-4 rounded-xl border border-slate-800/60">
                      <div className="text-xs sm:text-sm text-slate-300 flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          預計提醒日期：
                          <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded ml-1 font-mono">
                            {formatDateChinese(calculateTargetDate(memoBaseDate, memoPeriod))}
                          </span>
                          <span className="text-slate-500 ml-1.5 font-mono">
                            ({calculateTargetDate(memoBaseDate, memoPeriod)})
                          </span>
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={!memoTarget.trim()}
                        className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/10 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>新增至備忘清單</span>
                      </button>
                    </div>
                  </form>

                  {/* MEMO LIST */}
                  {memos.length > 0 ? (
                    <div className="mt-6 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs sm:text-sm text-slate-300">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/50">
                              <th className="px-4 py-3 text-slate-400 font-bold uppercase tracking-wider">觀察目標</th>
                              <th className="px-4 py-3 text-slate-400 font-bold uppercase tracking-wider">起算基準日</th>
                              <th className="px-4 py-3 text-slate-400 font-bold uppercase tracking-wider">週期</th>
                              <th className="px-4 py-3 text-slate-400 font-bold uppercase tracking-wider">預計觀察日</th>
                              <th className="px-4 py-3 text-slate-400 font-bold uppercase tracking-wider">狀態</th>
                              <th className="px-4 py-3 text-slate-400 font-bold uppercase tracking-wider">標籤</th>
                              <th className="px-4 py-3 text-slate-400 font-bold uppercase tracking-wider text-right">管理</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {memos.map((memo) => {
                              const remaining = getRemainingDaysText(memo.targetDate);
                              const matchedCases = getMatchedCasesForMemo(memo.target);
                              return (
                                <React.Fragment key={memo.id}>
                                  <tr className={`hover:bg-slate-900/30 transition-colors ${memo.isCompleted ? 'opacity-60 bg-slate-950/10' : ''}`}>
                                    <td className="px-4 py-3.5 font-semibold">
                                      <div className="flex flex-col items-start w-full min-w-[200px] max-w-[260px]">
                                        <div className="flex items-center flex-wrap gap-1.5 w-full">
                                          <span className={memo.isCompleted ? 'line-through text-slate-500 text-sm font-semibold truncate max-w-[200px]' : 'text-white text-sm font-semibold truncate max-w-[200px]'}>
                                            {memo.target.startsWith('http') && matchedCases[0] ? matchedCases[0][1] : memo.target}
                                          </span>
                                          {memo.target.startsWith('http') && (
                                            <a
                                              href={memo.target}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center text-indigo-400 hover:text-indigo-300 ml-1 bg-indigo-950/40 p-1 border border-indigo-900/30 rounded-md transition-colors cursor-pointer"
                                              title="在新分頁開啟奇門案例"
                                            >
                                              <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                          )}
                                          {memo.category === '重點觀察' && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 animate-pulse shrink-0">
                                              🔥 重點觀察
                                            </span>
                                          )}
                                          {memo.category === '本益比低' && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shrink-0">
                                              📊 本益比低
                                            </span>
                                          )}
                                          {memo.category === '印證' && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/40 shrink-0">
                                              🎯 印證
                                            </span>
                                          )}
                                        </div>
                                        {matchedCases.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => setExpandedMemos(prev => ({ ...prev, [memo.id]: !prev[memo.id] }))}
                                            className={`inline-flex items-center space-x-1.5 mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                              expandedMemos[memo.id]
                                                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40 shadow-sm shadow-indigo-950/50'
                                                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-indigo-500/30 hover:bg-slate-850 hover:text-indigo-300'
                                            }`}
                                          >
                                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>{matchedCases.length} 個關聯案例</span>
                                            {expandedMemos[memo.id] ? (
                                              <ChevronUp className="w-3 h-3" />
                                            ) : (
                                              <ChevronDown className="w-3 h-3" />
                                            )}
                                          </button>
                                        )}
                                        {/* Notes / Remarks Input Field */}
                                        <div className="w-full mt-2 relative group">
                                          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                                            <Edit2 className="w-3 h-3" />
                                          </div>
                                          <input
                                            type="text"
                                            placeholder="輸入隨手備忘筆記..."
                                            value={memo.note || ''}
                                            onChange={(e) => handleUpdateMemoNote(memo.id, e.target.value)}
                                            className="w-full pl-7 pr-2.5 py-1 text-[11px] font-medium border border-slate-800/80 focus:border-indigo-500 rounded-lg bg-black/40 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600"
                                          />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5 font-mono text-slate-400">
                                      {memo.baseDate}
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-300">
                                      <span className="bg-slate-800 border border-slate-700/50 px-2 py-0.5 rounded text-xs font-medium">
                                        {memo.periodLabel}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-amber-300 font-mono">
                                          {formatDateChinese(memo.targetDate)}
                                        </span>
                                        <span className={`text-[11px] font-medium ${remaining.style}`}>
                                          {remaining.text}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <button
                                        onClick={() => handleToggleMemoStatus(memo.id)}
                                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                                          memo.isCompleted
                                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30'
                                            : 'bg-slate-800 text-slate-400 border border-slate-700/50 hover:border-indigo-500/50 hover:text-indigo-300'
                                        }`}
                                      >
                                        {memo.isCompleted ? (
                                          <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>已完成</span>
                                          </>
                                        ) : (
                                          <span>進行中</span>
                                        )}
                                      </button>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <select
                                        value={memo.category || ''}
                                        onChange={(e) => handleUpdateMemoCategory(memo.id, e.target.value)}
                                        className="px-2 py-1.5 border border-slate-800 focus:border-indigo-500 rounded-lg bg-slate-900 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 font-medium cursor-pointer"
                                      >
                                        <option value="">--</option>
                                        <option value="重點觀察">重點觀察</option>
                                        <option value="本益比低">本益比低</option>
                                        <option value="印證">印證</option>
                                      </select>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                      <button
                                        onClick={() => handleDeleteMemo(memo.id)}
                                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                                        title="刪除"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Matched cases section */}
                                  {matchedCases.length > 0 && expandedMemos[memo.id] && (
                                    <tr className="bg-slate-950/30">
                                      <td colSpan={7} className="px-6 py-4 border-t border-slate-900">
                                        <div className="space-y-3">
                                          <div className="flex items-center space-x-2 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>🔗 已自動關聯奇門存檔案例 ({matchedCases.length} 個)</span>
                                          </div>
                                          
                                          <div className="space-y-3">
                                            {matchedCases.map((caseRow, cIdx) => {
                                              const originalUrl = caseRow[0] || '#';
                                              const caseName = caseRow[1] || '未具名案例';
                                              const solarTime = caseRow[2] || '';
                                              const lunarTime = caseRow[3] || '';
                                              const customStockUrl = caseRow[14] || '';
                                              const customStockName = caseRow[15] || '';
                                              const stockInfo = getStockInfo(caseName);
                                              const caseKey = `${memo.id}-${cIdx}`;
                                              const isCaseExpanded = !!expandedMemoCases[caseKey];

                                              // Determine stock details
                                              let displayUrl = '';
                                              let displayName = '';
                                              let isCustom = false;

                                              if (customStockUrl) {
                                                displayUrl = customStockUrl;
                                                isCustom = true;
                                                if (customStockName) {
                                                  displayName = customStockName;
                                                } else if (stockInfo) {
                                                  displayName = stockInfo.stockName ? `${stockInfo.stockName}${stockInfo.stockCode} (自訂)` : `股市 ${stockInfo.stockCode} (自訂)`;
                                                } else {
                                                  displayName = '自訂股市網址';
                                                }
                                              } else if (stockInfo) {
                                                const { stockCode, stockName } = stockInfo;
                                                displayUrl = `https://tw.stock.yahoo.com/quote/${stockCode}.TW/technical-analysis`;
                                                displayName = stockName ? `${stockName}${stockCode}` : `奇摩股市 ${stockCode}`;
                                              }

                                              return (
                                                <div 
                                                  key={cIdx} 
                                                  className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 space-y-3 shadow-md"
                                                >
                                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                    {/* Title & Time */}
                                                    <div className="space-y-1.5 min-w-0">
                                                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                                        <span className="text-[10px] font-bold text-amber-400 bg-amber-950/50 border border-amber-900/30 px-2 py-0.5 rounded shrink-0 font-mono">
                                                          案例 #{archivedRows.indexOf(caseRow)}
                                                        </span>
                                                        <h6 className="text-sm font-bold text-white truncate max-w-sm sm:max-w-md">
                                                          {caseName}
                                                        </h6>
                                                      </div>
                                                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                                                        <span className="flex items-center space-x-1">
                                                          <span className="text-slate-500">西曆:</span>
                                                          <span className="font-mono">{solarTime}</span>
                                                        </span>
                                                        <span className="flex items-center space-x-1">
                                                          <span className="text-slate-500">農曆:</span>
                                                          <span className="text-amber-300">{lunarTime}</span>
                                                        </span>
                                                        {getGanzhiString(solarTime) && (
                                                          <span className="flex items-center space-x-1">
                                                            <span className="text-slate-500">干支:</span>
                                                            <span className="text-emerald-400 font-bold">{getGanzhiString(solarTime).replace('干支：', '')}</span>
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                      {/* Google Doc link if any */}
                                                      {caseRow[13] && (
                                                        <a
                                                          href={caseRow[13]}
                                                          target="_blank"
                                                          rel="noreferrer"
                                                          className="px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-900/30 rounded-xl transition-colors flex items-center space-x-1 shadow-sm"
                                                        >
                                                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                                          <span>開啟文件</span>
                                                        </a>
                                                      )}

                                                      {/* Technical analysis button */}
                                                      {displayUrl && (
                                                        <a
                                                          href={displayUrl}
                                                          target="_blank"
                                                          rel="noreferrer"
                                                          className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center space-x-1 shadow-sm ${
                                                            isCustom 
                                                              ? 'text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-900/30'
                                                              : 'text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-900/30'
                                                          }`}
                                                        >
                                                          <TrendingUp className={`w-3.5 h-3.5 ${isCustom ? 'text-amber-400' : 'text-rose-400'}`} />
                                                          <span>{displayName}</span>
                                                        </a>
                                                      )}

                                                      {/* Open Qimen case */}
                                                      <a
                                                        href={originalUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-2.5 py-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-900/30 rounded-xl transition-colors flex items-center space-x-1"
                                                      >
                                                        <span>開啟案例</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                      </a>

                                                      {/* Expand Palace Preview */}
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setExpandedMemoCases(prev => ({
                                                            ...prev,
                                                            [caseKey]: !isCaseExpanded
                                                          }));
                                                        }}
                                                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-850 hover:bg-slate-750 border border-slate-700 rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
                                                      >
                                                        <span>{isCaseExpanded ? '收合盤面' : '展開盤面'}</span>
                                                        {isCaseExpanded ? (
                                                          <ChevronUp className="w-3.5 h-3.5" />
                                                        ) : (
                                                          <ChevronDown className="w-3.5 h-3.5" />
                                                        )}
                                                      </button>
                                                    </div>
                                                  </div>

                                                  {/* Expanded 3x3 Bento Qimen Chart */}
                                                  <AnimatePresence>
                                                    {isCaseExpanded && (
                                                      <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="border-t border-slate-800/40 pt-4 mt-3 overflow-hidden"
                                                      >
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                          <PalaceCard name="巽宮 (4)" direction="東南方 (木)" content={caseRow[4] || ''} />
                                                          <PalaceCard name="離宮 (9)" direction="南方 (火)" content={caseRow[12] || ''} />
                                                          <PalaceCard name="坤宮 (2)" direction="西南方 (土)" content={caseRow[5] || ''} isHighlighted={true} />
                                                          <PalaceCard name="震宮 (3)" direction="東方 (木)" content={caseRow[6] || ''} />
                                                          <PalaceCard name="中宮 (5)" direction="中央 (土)" content={caseRow[7] || ''} isCenter={true} />
                                                          <PalaceCard name="兌宮 (7)" direction="西方 (金)" content={caseRow[8] || ''} />
                                                          <PalaceCard name="艮宮 (8)" direction="東北方 (土)" content={caseRow[9] || ''} />
                                                          <PalaceCard name="坎宮 (1)" direction="北方 (水)" content={caseRow[10] || ''} />
                                                          <PalaceCard name="乾宮 (6)" direction="西北方 (金)" content={caseRow[11] || ''} />
                                                        </div>
                                                      </motion.div>
                                                    )}
                                                  </AnimatePresence>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 flex flex-col items-center justify-center py-8 px-4 border border-dashed border-slate-800 rounded-xl bg-slate-950/10 text-center text-slate-500">
                      <Clock className="w-8 h-8 mb-2 text-slate-600" />
                      <p className="text-sm">目前尚無追蹤中的觀察備忘案件。</p>
                      <p className="text-xs mt-1 text-slate-600">填寫上方表格，隨時為股票或特定奇門案例排定追蹤時程！</p>
                    </div>
                  )}
                </motion.div>



                {/* SESSION ACTIVITY LOGS (HISTORY) */}
                {sessionLogs.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6"
                  >
                    <h3 className="font-display font-bold text-base text-slate-300 flex items-center space-x-2">
                      <FileSpreadsheet className="w-5 h-5 text-slate-500" />
                      <span>本次工作階段已存檔案例 ({sessionLogs.length})</span>
                    </h3>
                    <div className="mt-4 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
                      {sessionLogs.map((log, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-slate-950/20 hover:bg-slate-950/50 transition-colors">
                          <div className="flex flex-col space-y-1 pr-4 min-w-0">
                            <span className="text-sm font-semibold text-slate-200 truncate">{log.name}</span>
                            <a href={log.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-400 hover:underline flex items-center space-x-1 truncate">
                              <span className="truncate">{log.url}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                          <div className="text-xs font-semibold text-slate-500 shrink-0">
                            {log.time} ✦ 已存檔
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </>
            ) : (
              /* SEARCH DASHBOARD VIEW */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/50">
                    <div>
                      <h2 className="font-display font-bold text-xl text-white tracking-tight flex items-center space-x-2">
                        <Database className="w-5 h-5 text-amber-400" />
                        <span>雲端案例資料庫自由檢索</span>
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        自動讀取自 Google Sheets 中的完整記錄。支援「AND」多關鍵字複合搜尋（例如輸入 <strong>九天 + 天沖 + 生門</strong>）。
                      </p>
                    </div>
                    <button
                      onClick={fetchArchivedRows}
                      disabled={isLoadingRows}
                      className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors self-start sm:self-center"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRows ? 'animate-spin' : ''}`} />
                      <span>同步雲端資料</span>
                    </button>
                  </div>

                  {/* SEARCH BAR INPUT */}
                  <div className="mt-6">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="請輸入關鍵字，多個關鍵字可用 + 號或空格相連，例如：九天 + 天沖 + 生門"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-200 text-sm placeholder:text-slate-500 bg-black/40"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-xs text-slate-500 flex items-center">熱門檢索範例：</span>
                      <button
                        onClick={() => setSearchQuery('九天 + 天沖 + 生門')}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded-full transition-colors"
                      >
                        九天 + 天沖 + 生門
                      </button>
                      <button
                        onClick={() => setSearchQuery('白虎 + 天芮 + 死門')}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded-full transition-colors"
                      >
                        白虎 + 天芮 + 死門
                      </button>
                      <button
                        onClick={() => setSearchQuery('六合 + 開門')}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded-full transition-colors"
                      >
                        六合 + 開門
                      </button>
                      <button
                        onClick={() => setSearchQuery('直符 + 生門')}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded-full transition-colors"
                      >
                        直符 + 生門
                      </button>
                    </div>
                    <div className="mt-4">
                      <textarea
                        value={searchNotes}
                        onChange={(e) => setSearchNotes(e.target.value)}
                        placeholder="在此添加您的重要資訊、筆記或自定義檢索公式..."
                        className="w-full h-24 p-3 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-300 text-sm placeholder:text-slate-600 bg-slate-900/50 resize-y"
                      />
                    </div>
                  </div>
                </div>

                {/* SEARCH RESULTS LIST */}
                {isLoadingRows ? (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-4" />
                    <p className="text-sm text-slate-400">正在讀取 Google Sheets 試算表資料，請稍候...</p>
                  </div>
                ) : rowsError ? (
                  <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-6 text-red-300 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold">{rowsError}</p>
                    <button
                      onClick={fetchArchivedRows}
                      className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800/40 rounded-xl text-xs font-bold text-white transition-colors"
                    >
                      <span>重新嘗試載入</span>
                    </button>
                  </div>
                ) : archivedRows.length === 0 ? (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                    <Database className="w-8 h-8 mx-auto mb-3 text-slate-700" />
                    <p className="text-sm">尚未在 Google Sheets 中找到任何存檔案例。</p>
                    <p className="text-xs mt-1 text-slate-600">請先在「奇門案例盤面自動讀取」分頁建立並存檔您的第一個案例！</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <span className="text-xs text-slate-500 font-semibold">
                          檢索結果：找到 {getFilteredRows().length} 個符合條件的案例 (共 {archivedRows.length - 1} 個存檔)
                        </span>
                        
                        {/* SORTING CONTROLS */}
                        <div className="flex items-center space-x-1 bg-slate-950/80 border border-slate-800 rounded-xl p-0.5 self-start sm:self-auto shadow-inner">
                          <button
                            onClick={() => setSortOrder('desc')}
                            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1 ${
                              sortOrder === 'desc'
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                            title="最晚記錄（最近）排在最前"
                          >
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>最近時間 (新 ➔ 舊)</span>
                          </button>
                          <button
                            onClick={() => setSortOrder('asc')}
                            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1 ${
                              sortOrder === 'asc'
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                            title="最早記錄（最久）排在最前"
                          >
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>最久時間 (舊 ➔ 新)</span>
                          </button>
                        </div>
                      </div>
                      {spreadsheetId && (
                        <a
                          href={spreadsheetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 self-start sm:self-auto"
                        >
                          <span>查看完整試算表</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="space-y-3">
                      {getFilteredRows().length === 0 ? (
                        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-10 text-center text-slate-500">
                          <p className="text-sm font-semibold">無相符案例</p>
                          <p className="text-xs mt-1 text-slate-600">找不到包含「{searchQuery}」的奇門盤，請嘗試縮減關鍵字或調整字元。</p>
                        </div>
                      ) : (
                        getFilteredRows().map((row, idx) => {
                          const isExpanded = expandedCaseIndex === idx;
                          const originalUrl = row[0] || '#';
                          const caseName = row[1] || '未具名案例';
                          const solarTime = row[2] || '';
                          const lunarTime = row[3] || '';
                          const originalRowIndex = archivedRows.indexOf(row);

                          const terms = searchQuery
                            .toLowerCase()
                            .split(/[\s\+\uff0b]+/)
                            .map(t => t.trim())
                            .filter(t => t.length > 0);
                          const highlights = getPalaceHighlights(row, terms);

                          return (
                            <div
                              key={idx}
                              className="bg-slate-900 border border-slate-800/80 hover:border-slate-750 rounded-2xl overflow-hidden transition-all shadow-md"
                            >
                              {/* ROW HEADER (Main Item Card) */}
                              <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1.5 min-w-0 flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-bold text-amber-400 bg-amber-950/50 border border-amber-900/30 px-2 py-0.5 rounded">
                                      案例 #{idx + 1}
                                    </span>
                                    <h4 className="text-base font-bold text-white truncate max-w-md">
                                      {caseName}
                                    </h4>
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                                    <span className="flex items-center space-x-1">
                                      <span className="text-slate-500">西曆:</span>
                                      <span className="font-mono">{solarTime}</span>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                      <span className="text-slate-500">農曆:</span>
                                      <span className="text-amber-300">{lunarTime}</span>
                                    </span>
                                    {getGanzhiString(solarTime) && (
                                      <span className="flex items-center space-x-1">
                                        <span className="text-slate-500">干支:</span>
                                        <span className="text-emerald-400 font-bold">{getGanzhiString(solarTime).replace('干支：', '')}</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* MATCHED PALACES ELEMENTS PREVIEW */}
                                  {highlights.length > 0 && (
                                    <div className="mt-3.5 pt-2.5 border-t border-slate-800/40 flex flex-col gap-2">
                                      {highlights.map((h, hIdx) => (
                                        <div 
                                          key={hIdx} 
                                          className="flex flex-wrap items-center gap-2"
                                        >
                                          <span className="text-amber-500/95 font-bold text-[11px] bg-amber-950/40 border border-amber-500/25 px-2 py-0.5 rounded-lg flex items-center shrink-0">
                                            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                                            {h.palaceName}
                                          </span>
                                          <div className="flex flex-wrap items-center gap-1">
                                            {h.elements.map((el, elIdx) => {
                                              const isMatched = h.matchedTerms.some(term => 
                                                normalizeQimenText(el).includes(normalizeQimenText(term)) || 
                                                normalizeQimenText(term).includes(normalizeQimenText(el))
                                              );
                                              return (
                                                <React.Fragment key={elIdx}>
                                                  {elIdx > 0 && <span className="text-slate-600 font-medium text-xs px-0.5">,</span>}
                                                  <span 
                                                    className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-all ${
                                                      isMatched 
                                                        ? 'text-amber-300 font-bold bg-amber-950/85 border border-amber-500/30 shadow-sm shadow-amber-950' 
                                                        : 'text-slate-400 bg-slate-900/60 border border-slate-850'
                                                    }`}
                                                  >
                                                    {el}
                                                  </span>
                                                </React.Fragment>
                                              );
                                            })}
                                            {h.missingCategories && h.missingCategories.length > 0 && (
                                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-900/30 ml-2 animate-pulse">
                                                缺失: {h.missingCategories.join('、')}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 shrink-0">
                                  {(() => {
                                    const originalRowIndex = archivedRows.indexOf(row);
                                    const docUrl = row[13] || '';
                                    return (
                                      <React.Fragment>
                                        {/* Google Doc URL feature */}
                                        {editingDocIndex === originalRowIndex ? (
                                          <div className="flex items-center space-x-1.5 bg-slate-950/45 border border-slate-800 rounded-xl px-2.5 py-1 shadow-inner">
                                            <input
                                              type="url"
                                              value={editingDocUrl}
                                              onChange={(e) => setEditingDocUrl(e.target.value)}
                                              placeholder="輸入 Google 文件網址..."
                                              className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-44 md:w-56"
                                              disabled={isUpdatingDoc}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  handleSaveDocUrl(originalRowIndex);
                                                } else if (e.key === 'Escape') {
                                                  setEditingDocIndex(null);
                                                }
                                              }}
                                            />
                                            <button
                                              onClick={() => handleSaveDocUrl(originalRowIndex)}
                                              disabled={isUpdatingDoc}
                                              className="text-emerald-400 hover:text-emerald-300 p-0.5 transition-colors disabled:opacity-40"
                                              title="儲存"
                                            >
                                              {isUpdatingDoc ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              ) : (
                                                <Check className="w-3.5 h-3.5" />
                                              )}
                                            </button>
                                            <button
                                              onClick={() => setEditingDocIndex(null)}
                                              disabled={isUpdatingDoc}
                                              className="text-slate-400 hover:text-slate-300 p-0.5 transition-colors disabled:opacity-40"
                                              title="取消"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : docUrl ? (
                                          <div className="flex items-center space-x-1.5 shrink-0">
                                            <a
                                              href={docUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-900/30 rounded-xl transition-colors flex items-center space-x-1 shadow-sm"
                                            >
                                              <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                              <span>開啟文件</span>
                                            </a>
                                            <button
                                              onClick={() => {
                                                setEditingDocIndex(originalRowIndex);
                                                setEditingDocUrl(docUrl);
                                              }}
                                              className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800/40 border border-slate-800/40 rounded-xl transition-colors"
                                              title="編輯文件網址"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              setEditingDocIndex(originalRowIndex);
                                              setEditingDocUrl('');
                                            }}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-slate-800/40 rounded-xl transition-colors flex items-center space-x-1 shrink-0"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>連結文件</span>
                                          </button>
                                        )}
                                      </React.Fragment>
                                    );
                                  })()}
                                  {(() => {
                                    const originalRowIndex = archivedRows.indexOf(row);
                                    const customStockUrl = row[14] || '';
                                    const customStockName = row[15] || '';
                                    const stockInfo = getStockInfo(caseName);
                                    
                                    // If we are currently editing the stock URL/Name for this row
                                    if (editingStockIndex === originalRowIndex) {
                                      return (
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 bg-slate-950/45 border border-slate-800 rounded-xl p-1.5 shadow-inner">
                                          <input
                                            type="text"
                                            value={editingStockName}
                                            onChange={(e) => setEditingStockName(e.target.value)}
                                            placeholder="自訂標題 (如: 台橡2103)"
                                            className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-32 px-1 border-b sm:border-b-0 sm:border-r border-slate-800 pb-1 sm:pb-0"
                                            disabled={isUpdatingStock}
                                          />
                                          <input
                                            type="url"
                                            value={editingStockUrl}
                                            onChange={(e) => setEditingStockUrl(e.target.value)}
                                            placeholder="輸入自訂股市網址..."
                                            className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-44 md:w-56 px-1"
                                            disabled={isUpdatingStock}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                handleSaveStockUrl(originalRowIndex);
                                              } else if (e.key === 'Escape') {
                                                setEditingStockIndex(null);
                                              }
                                            }}
                                          />
                                          <div className="flex items-center space-x-1 pl-1">
                                            <button
                                              onClick={() => handleSaveStockUrl(originalRowIndex)}
                                              disabled={isUpdatingStock}
                                              className="text-emerald-400 hover:text-emerald-300 p-0.5 transition-colors disabled:opacity-40"
                                              title="儲存"
                                            >
                                              {isUpdatingStock ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              ) : (
                                                <Check className="w-3.5 h-3.5" />
                                              )}
                                            </button>
                                            <button
                                              onClick={() => setEditingStockIndex(null)}
                                              disabled={isUpdatingStock}
                                              className="text-slate-400 hover:text-slate-300 p-0.5 transition-colors disabled:opacity-40"
                                              title="取消"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    }

                                    // Determine display properties and final link url
                                    let displayUrl = '';
                                    let displayName = '';
                                    let isCustom = false;

                                    if (customStockUrl) {
                                      displayUrl = customStockUrl;
                                      isCustom = true;
                                      if (customStockName) {
                                        displayName = customStockName;
                                      } else if (stockInfo) {
                                        displayName = stockInfo.stockName ? `${stockInfo.stockName}${stockInfo.stockCode} (自訂)` : `股市 ${stockInfo.stockCode} (自訂)`;
                                      } else {
                                        displayName = '自訂股市網址';
                                      }
                                    } else if (stockInfo) {
                                      const { stockCode, stockName } = stockInfo;
                                      displayUrl = `https://tw.stock.yahoo.com/quote/${stockCode}.TW/technical-analysis`;
                                      displayName = stockName ? `${stockName}${stockCode}` : `奇摩股市 ${stockCode}`;
                                    }

                                    // Render appropriate element based on whether a link exists
                                    if (displayUrl) {
                                      return (
                                        <div className="flex items-center space-x-1.5 shrink-0">
                                          <a
                                            href={displayUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center space-x-1 shadow-sm ${
                                              isCustom 
                                                ? 'text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-900/30'
                                                : 'text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-900/30'
                                            }`}
                                          >
                                            <TrendingUp className={`w-3.5 h-3.5 ${isCustom ? 'text-amber-400' : 'text-rose-400'}`} />
                                            <span>{displayName}</span>
                                          </a>
                                          <button
                                            onClick={() => {
                                              setEditingStockIndex(originalRowIndex);
                                              setEditingStockUrl(customStockUrl || displayUrl);
                                              setEditingStockName(customStockName || displayName);
                                            }}
                                            className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800/40 border border-slate-800/40 rounded-xl transition-colors"
                                            title="編輯自訂股市網址"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      );
                                    }

                                    // If no stock code detected and no custom url set, show "連結股市" button
                                    return (
                                      <button
                                        onClick={() => {
                                          setEditingStockIndex(originalRowIndex);
                                          if (stockInfo) {
                                            const { stockCode, stockName } = stockInfo;
                                            const defaultName = stockName ? `${stockName}${stockCode}` : `股市 ${stockCode}`;
                                            const defaultUrl = `https://tw.stock.yahoo.com/quote/${stockCode}.TW/technical-analysis`;
                                            setEditingStockUrl(defaultUrl);
                                            setEditingStockName(defaultName);
                                          } else {
                                            setEditingStockUrl('');
                                            setEditingStockName('');
                                          }
                                        }}
                                        className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-slate-800/40 rounded-xl transition-colors flex items-center space-x-1 shrink-0"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>連結股市</span>
                                      </button>
                                    );
                                  })()}
                                  <a
                                    href={originalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3.5 py-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-900/30 rounded-xl transition-colors flex items-center space-x-1"
                                  >
                                    <span>開啟案例</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                  <button
                                    onClick={() => setExpandedCaseIndex(isExpanded ? null : idx)}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl transition-all flex items-center space-x-1"
                                  >
                                    <span>{isExpanded ? '收合盤面' : '展開盤面'}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  {/* DELETE CASE FEATURE WITH INLINE CONFIRMATION */}
                                  {deletingRowIndex === originalRowIndex ? (
                                    <div className="flex items-center space-x-2 bg-red-950/45 border border-red-900/45 rounded-xl px-3 py-1 text-xs shrink-0">
                                      <span className="text-red-400 font-bold flex items-center shrink-0">
                                        <AlertCircle className="w-3.5 h-3.5 mr-1 text-red-400" />
                                        確認刪除？
                                      </span>
                                      <div className="flex items-center space-x-1.5 shrink-0">
                                        <button
                                          onClick={() => handleDeleteRow(originalRowIndex)}
                                          disabled={isDeleting}
                                          className="px-2 py-0.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors cursor-pointer text-[10px]"
                                        >
                                          {isDeleting ? '刪除中...' : '確定'}
                                        </button>
                                        <button
                                          onClick={() => setDeletingRowIndex(null)}
                                          disabled={isDeleting}
                                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold rounded-lg transition-colors cursor-pointer text-[10px]"
                                        >
                                          取消
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeletingRowIndex(originalRowIndex)}
                                      className="p-2 text-rose-500 hover:text-white hover:bg-rose-950/60 border border-rose-900/20 hover:border-rose-800/40 rounded-xl transition-colors shrink-0 cursor-pointer"
                                      title="刪除此案例"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* ROW EXPANSION: 3x3 Bento Qimen Chart */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="border-t border-slate-800/60 bg-slate-950/40 p-5 sm:p-6 overflow-hidden"
                                  >
                                    <h5 className="text-xs font-bold text-slate-400 mb-4 tracking-wider uppercase">
                                      ✨ 奇門遁甲九宮佈局預覽
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <PalaceCard name="巽宮 (4)" direction="東南方 (木)" content={row[4] || ''} />
                                      <PalaceCard name="離宮 (9)" direction="南方 (火)" content={row[12] || ''} />
                                      <PalaceCard name="坤宮 (2)" direction="西南方 (土)" content={row[5] || ''} isHighlighted={true} />
                                      <PalaceCard name="震宮 (3)" direction="東方 (木)" content={row[6] || ''} />
                                      <PalaceCard name="中宮 (5)" direction="中央 (土)" content={row[7] || ''} isCenter={true} />
                                      <PalaceCard name="兌宮 (7)" direction="西方 (金)" content={row[8] || ''} />
                                      <PalaceCard name="艮宮 (8)" direction="東北方 (土)" content={row[9] || ''} />
                                      <PalaceCard name="坎宮 (1)" direction="北方 (水)" content={row[10] || ''} />
                                      <PalaceCard name="乾宮 (6)" direction="西北方 (金)" content={row[11] || ''} />
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </div>
        )}

      </main>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {showConfirmModal && parsedResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            
            {/* BACKDROP */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSaving && setShowConfirmModal(false)}
              className="fixed inset-0 transition-opacity bg-slate-950/80 backdrop-blur-sm"
            />

            {/* MODAL CONTAINER */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-slate-900 rounded-2xl text-left overflow-hidden shadow-2xl border border-slate-800 z-10"
            >
                <div className="p-6">
                  <div className="flex items-center space-x-3 text-amber-300 bg-amber-950/50 px-4 py-3 rounded-xl border border-amber-800/30">
                    <FileSpreadsheet className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-bold">自動存檔與資料寫入確認</span>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-base font-bold text-slate-200">
                      您確定要將此奇門案例新增至 Google Sheets 試算表嗎？
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                      系統將於您的雲端硬碟自動查詢或建立「我的奇門遁甲案例庫」試算表，並在「工作表1」中追加一列記錄以下資料：
                    </p>

                    <div className="mt-4 bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between text-xs pb-1.5 border-b border-slate-800">
                        <span className="font-semibold text-slate-500">欄位</span>
                        <span className="font-semibold text-slate-500">預覽值</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span className="font-semibold text-slate-400">網址:</span>
                        <span className="col-span-2 text-indigo-300 font-semibold truncate text-right font-mono">{url}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span className="font-semibold text-slate-400">案例名稱:</span>
                        <span className="col-span-2 text-slate-200 font-semibold truncate text-right">{parsedResult.caseName}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span className="font-semibold text-slate-400">起盤時間(公元):</span>
                        <span className="col-span-2 text-indigo-300 font-semibold truncate text-right font-mono">{parsedResult.solarTime}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span className="font-semibold text-slate-400">農曆:</span>
                        <span className="col-span-2 text-amber-300 font-semibold truncate text-right">{parsedResult.lunarTime}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span className="font-semibold text-slate-400">九宮克應資訊:</span>
                        <span className="col-span-2 text-slate-400 font-semibold truncate text-right">已拆解並對應 9 個欄位儲存</span>
                      </div>
                    </div>

                    {saveError && (
                      <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start space-x-2 text-red-300 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>{saveError}</div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 justify-end">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setShowConfirmModal(false)}
                      className="w-full sm:w-auto px-5 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSaveToSheets}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4.5 h-4.5 animate-spin" />
                          <span>寫入中...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4.5 h-4.5" />
                          <span>確認並追加寫入</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-[calc(100vw-3rem)] bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl p-4 overflow-hidden"
          >
            <div className="flex items-start space-x-3.5">
              <div className={`p-2 rounded-xl shrink-0 ${
                toast.type === 'success' 
                  ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/30' 
                  : 'bg-red-950/50 text-red-400 border border-red-800/30'
              }`}>
                {toast.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white tracking-tight">{toast.message}</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {toast.type === 'success' 
                    ? '已將此案例的九宮盤與克應斷語完整追加寫入試算表。' 
                    : toast.isAuthError
                      ? '因為您太久未操作，Google 登入憑證已過期，請點擊下方按鈕重新登入驗證。'
                      : '存檔至試算表時發生異常，請確認授權權限並重試。'
                  }
                </p>
                {toast.isAuthError && (
                  <button
                    onClick={async () => {
                      setToast(null);
                      await handleLogin();
                    }}
                    className="inline-flex items-center space-x-1.5 mt-3 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-indigo-600/10 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-pulse" />
                    <span>點我重新登入驗證</span>
                  </button>
                )}
                {toast.link && (
                  <a
                    href={toast.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 mt-3 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <span>開啟 Google 試算表</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <button
                onClick={() => setToast(null)}
                className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 p-1 rounded-lg hover:bg-slate-800/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Auto-dismiss countdown visual */}
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 5, ease: 'linear' }}
              className={`absolute bottom-0 left-0 h-1 ${
                toast.type === 'success' ? 'bg-emerald-500/50' : 'bg-red-500/50'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="mt-20 border-t border-slate-800 py-6 bg-slate-900/40 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>STATUS: {parsedResult ? 'DATA_PARSED_SUCCESSFULLY' : 'READY_TO_PARSE'}</div>
          <div className="flex gap-6">
            <span>DEST: 我的奇門遁甲案例庫 / 工作表1</span>
            <span>2026</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

/* PALACE CARD COMPONENT */
interface PalaceCardProps {
  name: string;
  direction: string;
  content: string;
  isCenter?: boolean;
  isHighlighted?: boolean;
}

function PalaceCard({ name, direction, content, isCenter = false, isHighlighted = false }: PalaceCardProps) {
  // Format the text representation inside each palace beautifully
  const formattedContent = content || '';
  
  if (isCenter) {
    const hasWuBuYu = formattedContent.includes("五不遇時");
    return (
      <div className="rounded-2xl border p-5 bg-slate-800/20 border-slate-800/80 transition-all flex flex-col justify-between min-h-[220px]">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/50">
            <span className="font-display font-bold text-sm text-amber-500">{name}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{direction}</span>
          </div>

          <div className="mt-6 flex flex-col items-center justify-center py-6 bg-slate-950/40 rounded-xl border border-slate-800/30">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              狀態標記
            </div>
            {hasWuBuYu ? (
              <div className="text-lg font-black text-red-500 bg-red-950/30 border border-red-900/40 px-4 py-2 rounded-xl shadow-inner animate-pulse">
                五不遇時
              </div>
            ) : (
              <div className="text-sm font-semibold text-slate-500">
                無 (非五不遇時)
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Try to parse components
  const lines = formattedContent.split('\n').map(line => line.trim()).filter(Boolean);

  // Find which elements are present on the first line (宫位符号)
  const missingCategories: string[] = [];
  const GODS = ['值符', '直符', '騰蛇', '螣蛇', '塍蛇', '太陰', '六合', '白虎', '玄武', '九地', '九天'];
  const STARS = ['天蓬', '天芮', '天沖', '天輔', '天禽', '天心', '天柱', '天任', '天英', '禽芮'];
  const GATES = ['開門', '休門', '生門', '傷門', '杜門', '景門', '死門', '驚門', '開', '休', '生', '傷', '杜', '景', '死', '驚'];

  if (formattedContent) {
    const firstLine = lines.find(l => l.includes('宮位符號')) || lines[0] || '';
    const cleanFirstLine = firstLine.replace(/^\*\*宮位符號\s*:\s*/, '').replace(/^\*\*宮位符號\s*:\s*/, '');
    const normalizedFirstLine = cleanFirstLine.toLowerCase().replace(/值/g, '直').replace(/螣|塍/g, '騰');

    const hasGod = GODS.some(g => normalizedFirstLine.includes(g.toLowerCase().replace(/值/g, '直').replace(/螣|塍/g, '騰')));
    const hasStar = STARS.some(s => normalizedFirstLine.includes(s.toLowerCase().replace(/值/g, '直').replace(/螣|塍/g, '騰')));
    const hasGate = GATES.some(gt => normalizedFirstLine.includes(gt.toLowerCase().replace(/值/g, '直').replace(/螣|塍/g, '騰')));

    if (!hasGod) missingCategories.push('八神');
    if (!hasStar) missingCategories.push('九星');
    if (!hasGate) missingCategories.push('八門');
  }

  // Parse out individual symbols for the vertical 3-row block
  let palaceSymbols: string[] = [];
  let god = '';
  let star = '';
  let gate = '';

  const symbolLine = lines.find(line => line.includes('宮位符號'));
  if (symbolLine) {
    const cleanSymbolsText = symbolLine
      .replace(/^\-\s*\*\*/, '')
      .replace(/^\*\*/, '')
      .replace(/宮位符號\s*:\s*/, '')
      .replace(/宮位符號\s*：\s*/, '')
      .replace(/宮位符號\s*/, '')
      .replace(/^[:：]\s*/, '')
      .trim();
    
    palaceSymbols = cleanSymbolsText.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);

    // Categorize symbols
    palaceSymbols.forEach(symbol => {
      const normalized = symbol.toLowerCase().replace(/值/g, '直').replace(/螣|塍/g, '騰');
      if (GODS.some(g => g.toLowerCase().replace(/值/g, '直').replace(/螣|塍/g, '騰') === normalized)) {
        god = symbol;
      } else if (STARS.some(s => s.toLowerCase().replace(/值/g, '直').replace(/螣|塍/g, '騰') === normalized)) {
        star = symbol;
      } else if (GATES.some(gt => gt.toLowerCase().replace(/值/g, '直').replace(/螣|塍/g, '騰') === normalized)) {
        gate = symbol;
      }
    });

    // Fallback if elements are not in the standard list
    if (!god && !star && !gate && palaceSymbols.length > 0 && palaceSymbols[0] !== '無') {
      god = palaceSymbols[0] || '';
      star = palaceSymbols[1] || '';
      gate = palaceSymbols[2] || '';
    }
  }

  return (
    <div className={`rounded-2xl border p-5 transition-all flex flex-col justify-between min-h-[220px] ${
      isCenter 
        ? 'bg-slate-800/30 border-slate-800/80' 
        : isHighlighted
          ? 'bg-slate-900/80 border-amber-500/30 shadow-md ring-1 ring-amber-500/30'
          : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 transition-colors shadow-sm'
    }`}>
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/50">
          <span className={`font-display font-bold text-sm ${isHighlighted ? 'text-amber-400' : 'text-indigo-400'}`}>{name}</span>
          <div className="flex items-center space-x-1.5">
            {missingCategories.length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-950/55 text-red-400 border border-red-900/35">
                缺: {missingCategories.join('、')}
              </span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isCenter 
                ? 'bg-slate-800 text-slate-400' 
                : isHighlighted
                  ? 'bg-amber-950/50 text-amber-300 border border-amber-800/30'
                  : 'bg-indigo-950/50 text-indigo-300 border border-indigo-800/30'
            }`}>{direction}</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {/* Vertical Qimen Palace Symbols stack for non-center palaces */}
          {!isCenter && palaceSymbols.length > 0 && palaceSymbols[0] !== '無' && (
            <div className="bg-slate-950/50 rounded-xl border border-slate-800/30 p-4 my-2.5 flex flex-col items-center justify-center space-y-3 shadow-inner">
              {god && (
                <div className="text-sm font-extrabold text-slate-100 tracking-wider">
                  {god}
                </div>
              )}
              {star && (
                <div className="text-sm font-extrabold text-sky-400 tracking-wider">
                  {star}
                </div>
              )}
              {gate && (
                <div className="text-sm font-extrabold text-rose-500 tracking-wider">
                  {gate}
                </div>
              )}
            </div>
          )}

          {lines.map((line, idx) => {
            if (line.includes('宮位符號')) {
              // Skip the original horizontal宮位符號 line
              return null;
            }

            if (line.includes('狀態標記')) {
              let statusText = line
                .replace(/^[\-\•\*]\s*/, '')
                .replace(/\*\*狀態標記\*\*[:：]?/, '')
                .replace(/\*\*狀態標記\s*[:：]?/, '')
                .replace(/狀態標記\s*[:：]?/, '')
                .replace(/^\*+/, '')
                .replace(/\*+$/, '')
                .replace(/^[:：\s]+/, '')
                .trim();
              
              if (!statusText || statusText === '無') {
                return null;
              }

              const tokens = statusText.split(/[,，\s、]+/).map(t => t.trim()).filter(Boolean);
              if (tokens.length === 0) return null;

              return (
                <div key={idx} className="flex flex-wrap gap-2 mt-1 mb-2">
                  {tokens.map((token, sIdx) => (
                    <span 
                      key={sIdx} 
                      className="text-sm font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-lg shadow-sm inline-block tracking-wider"
                    >
                      {token}
                    </span>
                  ))}
                </div>
              );
            }

            if (line.includes('克應斷語')) {
              // Header type line
              const cleanText = line.replace(/^\-\s*\*\*/, '').replace(/\*\*:/, '');
              return (
                <div key={idx} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-2 first:mt-0">
                  {cleanText}
                </div>
              );
            } else if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
              // Detail list line
              const cleanText = line.replace(/^[\-\•\*]\s*/, '');
              const parts = cleanText.split('：');
              if (parts.length > 1) {
                const label = parts[0].trim();
                const isRedundantLabel = label === '上面斷語' || label === '下面斷語';
                return (
                  <div key={idx} className="text-xs text-slate-300 pl-2 leading-relaxed">
                    {!isRedundantLabel && (
                      <span className="font-bold text-indigo-300 bg-slate-800 px-1.5 py-0.5 rounded mr-1.5 border border-slate-700/50">{parts[0]}</span>
                    )}
                    <span>{parts.slice(1).join('：')}</span>
                  </div>
                );
              }
              return (
                <p key={idx} className="text-xs text-slate-400 pl-2 leading-relaxed">
                  {cleanText}
                </p>
              );
            } else {
              // Regular paragraph line
              return (
                <p key={idx} className="text-xs text-slate-300 leading-relaxed pl-1">
                  {line}
                </p>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}
