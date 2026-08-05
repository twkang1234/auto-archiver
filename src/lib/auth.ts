import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, browserLocalPersistence, setPersistence } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Explicitly set persistence to local storage to ensure it remembers the login across sessions
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Unable to set Firebase Auth persistence:', err);
});

// Configure Google Auth Provider with Workspace scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive');

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;

// Cache the access token in memory and try to restore from localStorage if available
let cachedAccessToken: string | null = null;
let cachedEmail: string | null = null;
try {
  cachedAccessToken = localStorage.getItem('g_access_token');
  cachedEmail = localStorage.getItem('g_last_email');
} catch (e) {
  console.warn('Unable to read from localStorage:', e);
}

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If the user is logged in but we lost the token, clear and fail
        cachedAccessToken = null;
        try {
          localStorage.removeItem('g_access_token');
        } catch (e) {}
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      try {
        localStorage.removeItem('g_access_token');
      } catch (e) {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google (triggered by button click)
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    
    // Set custom parameter to skip account chooser if we have a cached email
    if (cachedEmail) {
      provider.setCustomParameters({ login_hint: cachedEmail });
    } else {
      provider.setCustomParameters({});
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('無法從 Firebase Auth 取得 Google Access Token');
    }
    
    cachedAccessToken = credential.accessToken;
    cachedEmail = result.user.email;
    try {
      localStorage.setItem('g_access_token', cachedAccessToken);
      if (cachedEmail) {
        localStorage.setItem('g_last_email', cachedEmail);
      }
    } catch (e) {
      console.warn('Unable to write to localStorage:', e);
    }
    
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('登入失敗:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve current cached access token
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Sign out
export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  cachedEmail = null;
  try {
    localStorage.removeItem('g_access_token');
    localStorage.removeItem('g_last_email');
  } catch (e) {}
};
