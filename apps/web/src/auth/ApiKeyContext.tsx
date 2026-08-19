import { createContext, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'hookengine.apiKey';

interface ApiKeyContextValue {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextValue | null>(null);

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const setApiKey = (key: string): void => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKeyState(key);
  };

  const clearApiKey = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKeyState(null);
  };

  return (
    <ApiKeyContext.Provider value={{ apiKey, setApiKey, clearApiKey }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKey(): ApiKeyContextValue {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
}

/** For use inside <ApiKeyGate>-protected screens, where a key is guaranteed to be set. */
export function useRequiredApiKey(): string {
  const { apiKey } = useApiKey();
  if (!apiKey) {
    throw new Error('useRequiredApiKey used outside an authenticated context');
  }
  return apiKey;
}
