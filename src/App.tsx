import { useAuth } from './hooks/useAuth';
import { MessageType } from './extension/messaging';
import { useVault } from './hooks/useVault';
import { useSession } from './hooks/useSession';
import { useOrionEngine } from './hooks/useOrionEngine';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { LoginView } from './components/LoginView';
import { MasterPasswordView } from './components/PinEntryView';
import { config } from './config';
import type { SecretEntry } from './lib/vault';
import './index.css';

function App() {
  const { suiAddress, userEmail, isLoggingIn, handleLogin, handleLogout } = useAuth();
  const { pin, setPin } = useSession(suiAddress);
  const { vault, isLoading, isSyncing, hasLocalPin, error: vaultError, lastSyncId, handleSync, addSecret, deleteSecret, updateSecret } = useVault(suiAddress, pin);
  
  const { 
    isInitializing, isUnlocking, error: engineError, 
    handleInitialize, handleUnlock, handleRecover, clearError 
  } = useOrionEngine(suiAddress);

  // Session Activity & Timeout
  const lockVault = () => {
    setPin(null);
    chrome.runtime.sendMessage({ type: MessageType.CLEAR_SESSION }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Session] Logout sync failed:', chrome.runtime.lastError.message);
      }
    });
  };
  const { timeoutMinutes, resetActivity, updateTimeout } = useSessionTimeout(lockVault, !!pin);

  const onAuthComplete = (newPin: string) => {
    setPin(newPin);
    resetActivity();
  };

  const handleLogoutFlow = () => {
    handleLogout();
    lockVault();
    clearError();
  };

  // 1. LOGIN REQUIRED
  if (!suiAddress) {
    return (
      <LoginView 
        isLoggingIn={isLoggingIn} 
        onLogin={handleLogin} 
        onExpand={() => chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })} 
      />
    );
  }

  // 2. MASTER PASSWORD / UNLOCK
  if (!pin) {
    return (
      <MasterPasswordView 
        hasLocalPin={hasLocalPin} 
        error={engineError || vaultError}
        isLoggingIn={isInitializing || isUnlocking}
        onInitialize={async (p, code) => await handleInitialize(p, code, timeoutMinutes, () => {})}
        onInitializationComplete={(p) => onAuthComplete(p)}
        onUnlock={(p) => handleUnlock(p, timeoutMinutes, onAuthComplete)}
        onRecover={(p, code) => handleRecover(p, code, timeoutMinutes, onAuthComplete)}
        onLogout={handleLogoutFlow}
      />
    );
  }

  // 4. MAIN DASHBOARD
  return (
    <div className="flex flex-col min-h-[580px] bg-paper" {...activityProps(resetActivity)}>
      <Header 
        suiAddress={suiAddress} userEmail={userEmail}
        isSyncing={isSyncing} lastSyncId={lastSyncId}
        onSync={() => handleSync()}
        onLock={lockVault}
        onLogout={handleLogoutFlow}
        onExpand={() => chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })}
        timeoutMinutes={timeoutMinutes} updateTimeout={updateTimeout}
      />
      <div className="h-px bg-black/[0.06] mx-5" />
      <Dashboard 
        vault={vault} onAdd={addSecret}
        isLoading={isLoading}
        onDelete={deleteSecret}
        onUpdate={updateSecret}
        onAutofill={(entry) => handleAutofill(entry)}
      />
      <Footer />
    </div>
  );
}

// Sub-components for cleaner App.tsx

const Footer = () => (
  <footer className="px-5 py-3 border-t border-black/[0.06]">
    <p className="text-[10px] text-center text-muted font-mono">
      {config.app.name} v{config.app.version} · Secure on Sui
    </p>
  </footer>
);

const activityProps = (reset: () => void) => ({
  onClick: reset, onKeyDown: reset, onMouseMove: reset
});

const handleAutofill = (entry: SecretEntry) => {
  chrome.runtime.sendMessage({ 
    type: MessageType.AUTOFILL_REQUEST, 
    payload: entry // Pass entire entry, background will decrypt using session key
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Autofill] Failed to connect to background:', chrome.runtime.lastError.message);
    } else if (response?.error) {
      console.warn('[Autofill] Error:', response.error);
    }
  });
};

export default App;
