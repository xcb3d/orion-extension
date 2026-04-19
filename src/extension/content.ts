// content.ts - Orion Field Detection Engine
import { MessageType } from './messaging';
console.log('Orion Content Script Injected');

class FieldManager {
  static findLoginFields() {
    const userField = document.querySelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]') as HTMLInputElement;
    const passField = document.querySelector('input[type="password"]') as HTMLInputElement;
    return { userField, passField };
  }

  static fill(username: string, password: string): boolean {
    const { userField, passField } = this.findLoginFields();

    if (userField && passField) {
      userField.value = username;
      passField.value = password;
      
      // Trigger input events for modern frameworks (React, Vue, etc.)
      const event = new Event('input', { bubbles: true });
      userField.dispatchEvent(event);
      passField.dispatchEvent(event);
      
      return true;
    }
    return false;
  }
}

// Inline Autofill Logic — Minimalist Signature Bar (Emerald & Bold)
class InlineAutofillUI {

  private static getAvatarColor(name: string): string {
    const colors = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F59E0B', '#14B8A6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  private static shieldSvg(color = '#10B981', size = 14) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
  }

  static checkSvg(color = 'white', size = 14) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  }

  private static getThemeColors() {
    // Universal Signature Glass Theme (Premium & High Contrast)
    return {
      barBg: 'rgba(10, 10, 10, 0.82) !important',
      barBorder: 'rgba(16, 185, 129, 0.25) !important',
      barText: '#FFFFFF !important',
      barHoverBorder: 'rgba(16, 185, 129, 0.5) !important',
      barShadow: '0 8px 32px rgba(0,0,0,0.3)',
      barHoverShadow: '0 8px 32px rgba(16,185,129,0.2)',
      shieldColor: '#10B981',
      chevronColor: '#10B981',
      dropdownBg: 'rgba(10, 10, 10, 0.9) !important',
      dropdownText: '#FFFFFF !important',
      dropdownSubtext: 'rgba(255,255,255,0.6) !important',
      dropdownHeaderBg: 'rgba(255,255,255,0.03) !important',
      itemHoverBg: 'rgba(16, 185, 129, 0.15) !important',
    };
  }

  private static injectBar(passField: HTMLInputElement, credentials: any[]) {
    const tc = this.getThemeColors();

    // 1. Create Host Element
    const host = document.createElement('div');
    host.style.cssText = `position: relative; width: ${passField.offsetWidth}px !important; margin-bottom: 8px !important; z-index: 10000 !important;`;
    
    // 2. Attach Shadow Root
    const shadow = host.attachShadow({ mode: 'open' });

    // 3. Inject Styles into Shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      .orion-bar {
        display: flex !important; align-items: center !important; justify-content: flex-start !important; gap: 8px !important;
        width: 100% !important; height: 38px !important; margin-top: 6px !important;
        padding: 0 12px !important; box-sizing: border-box !important; overflow: hidden !important;
        background: ${tc.barBg}; border: 1px solid ${tc.barBorder};
        border-radius: 10px !important; cursor: pointer !important;
        box-shadow: ${tc.barShadow} !important;
        font-family: 'Inter', -apple-system, sans-serif !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        backdrop-filter: blur(12px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(12px) saturate(180%) !important;
      }
      .orion-bar:hover {
        border-color: ${tc.barHoverBorder} !important;
        box-shadow: ${tc.barHoverShadow} !important;
        transform: translateY(-1px);
      }
      .orion-dropdown {
        position: absolute !important; left: 0 !important; top: 100% !important; margin-top: 6px !important;
        width: 100% !important; min-width: 260px !important; background: ${tc.dropdownBg};
        border: 1px solid rgba(0,0,0,0.08) !important;
        border-radius: 14px !important;
        box-shadow: 0 12px 40px rgba(0,0,0,0.3) !important;
        z-index: 10001 !important; overflow: hidden !important;
        font-family: 'Inter', -apple-system, sans-serif !important;
        opacity: 0; transform: scale(0.97) translateY(-4px); transform-origin: top center !important;
        transition: opacity 0.15s ease, transform 0.15s ease !important;
        pointer-events: none;
      }
      .orion-dropdown.open {
        opacity: 1 !important; transform: scale(1) translateY(0) !important; pointer-events: auto !important;
      }
      .orion-item {
        padding: 12px 14px !important; cursor: pointer !important; display: flex !important; align-items: center !important; gap: 12px !important;
        transition: background 0.12s ease !important; background: transparent !important;
        width: 100% !important; box-sizing: border-box !important;
      }
      .orion-item:hover { background: ${tc.itemHoverBg} !important; }
      .orion-item:hover .arrow { opacity: 1 !important; }
      .arrow { opacity: 0; transition: opacity 0.12s !important; color: #10B981 !important; font-size: 16px !important; }
    `;
    shadow.appendChild(style);

    const bar = document.createElement('div');
    bar.className = 'orion-bar';
    const label = credentials.length === 1 ? credentials[0].name : `${credentials.length} accounts available`;
    bar.innerHTML = `
      <div data-orion-shield style="display:flex !important;align-items:center !important;justify-content:center !important;flex-shrink:0 !important;margin:0 !important;padding:0 !important;background:transparent !important;visibility:visible !important;opacity:1 !important;">
        ${this.shieldSvg(tc.shieldColor, 15)}
      </div>
      <span data-orion-brand style="font-size:10px !important;font-weight:800 !important;color:#10B981 !important;letter-spacing:1px !important;text-transform:uppercase !important;margin:0 0 0 4px !important;padding:0 !important;flex-shrink:0 !important;visibility:visible !important;opacity:1 !important;display:block !important;">ORION</span>
      <div data-orion-sep style="width:1px !important;height:12px !important;background:rgba(255,255,255,0.2) !important;margin:0 8px !important;padding:0 !important;flex-shrink:0 !important;visibility:visible !important;opacity:1 !important;"></div>
      <span data-orion-label style="flex:1 !important;font-size:12.5px !important;font-weight:600 !important;color:${tc.barText};white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;letter-spacing:-0.01em !important;margin:0 !important;padding:0 !important;visibility:visible !important;opacity:1 !important;display:block !important;text-align:left !important;">${label}</span>
      <span data-orion-chevron style="font-size:12px !important;color:${tc.chevronColor} !important;font-weight:700 !important;flex-shrink:0 !important;margin:0 0 0 4px !important;padding:0 !important;visibility:visible !important;opacity:1 !important;display:block !important;">›</span>
    `;

    bar.onmouseover = () => {
      bar.style.setProperty('border-color', tc.barHoverBorder as string, 'important');
      bar.style.setProperty('box-shadow', tc.barHoverShadow, 'important');
      bar.style.transform = 'translateY(-1px)';
    };
    bar.onmouseout = () => {
      bar.style.setProperty('border-color', tc.barBorder as string, 'important');
      bar.style.setProperty('box-shadow', tc.barShadow, 'important');
      bar.style.transform = 'translateY(0)';
    };

    // === DROPDOWN ===
    const dropdown = document.createElement('div');
    dropdown.className = 'orion-dropdown';

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 10px 14px !important; display: flex !important; align-items: center !important; gap: 8px !important;
      background: ${tc.dropdownHeaderBg}; border-bottom: 1px solid rgba(0,0,0,0.05) !important;
    `;
    header.innerHTML = `${this.shieldSvg('#10B981', 14)}<span style="font-size:10px !important;font-weight:700 !important;color:#10B981 !important;letter-spacing:1.5px !important;text-transform:uppercase !important;display:block !important;">ORION</span>`;
    dropdown.appendChild(header);

    // Items
    credentials.forEach(cred => {
      const item = document.createElement('div');
      const initial = (cred.name || '?')[0].toUpperCase();
      const avatarBg = this.getAvatarColor(cred.name);

      item.style.cssText = `
        padding: 12px 14px !important; cursor: pointer !important; display: flex !important; align-items: center !important; gap: 12px !important;
        transition: background 0.12s ease !important; background: transparent !important;
        width: 100% !important; box-sizing: border-box !important;
      `;
      item.innerHTML = `
        <div style="width:32px !important;height:32px !important;border-radius:10px !important;background:${avatarBg} !important;display:flex !important;align-items:center !important;justify-content:center !important;color:white !important;font-size:14px !important;font-weight:700 !important;flex-shrink:0 !important;box-shadow:0 2px 6px ${avatarBg}44 !important;">${initial}</div>
        <div style="flex:1 !important;min-width:150px !important;">
          <div style="font-size:13.5px !important;font-weight:600 !important;color:${tc.dropdownText};white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;display:block !important;line-height:1.4 !important;margin:0 !important;">${cred.name}</div>
          <div style="font-size:11.5px !important;color:${tc.dropdownSubtext};font-family:monospace !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;display:block !important;line-height:1.2 !important;margin:0 !important;">${cred.username}</div>
        </div>
        <div class="orion-arrow" style="opacity:0 !important;transition:opacity 0.12s !important;color:#10B981 !important;font-size:16px !important;flex-shrink:0 !important;">→</div>
      `;

      item.onmouseover = () => {
        item.style.setProperty('background', tc.itemHoverBg, 'important');
        (item.querySelector('.orion-arrow') as HTMLElement).style.setProperty('opacity', '1', 'important');
      };
      item.onmouseout = () => {
        item.style.setProperty('background', 'transparent', 'important');
        (item.querySelector('.orion-arrow') as HTMLElement).style.setProperty('opacity', '0', 'important');
      };

      item.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        dropdown.style.opacity = '0'; dropdown.style.transform = 'scale(0.97) translateY(-4px)'; dropdown.style.pointerEvents = 'none';

        chrome.runtime.sendMessage({ type: MessageType.INLINE_FILL_REQUEST, payload: { id: cred.id } }, (response) => {
          if (response?.username && response?.password) {
            FieldManager.fill(response.username, response.password);
            
            // Success Effect
            bar.style.setProperty('background', '#10B981', 'important'); 
            bar.style.setProperty('border-color', '#10B981', 'important');
            
            const shieldSvg = bar.querySelector('[data-orion-shield] svg path') as HTMLElement;
            const brandEl = bar.querySelector('[data-orion-brand]') as HTMLElement;
            const labelEl = bar.querySelector('[data-orion-label]') as HTMLElement;
            const chevronEl = bar.querySelector('[data-orion-chevron]') as HTMLElement;
            const sepEl = bar.querySelector('[data-orion-sep]') as HTMLElement;

            if (shieldSvg) shieldSvg.style.setProperty('stroke', '#FFFFFF', 'important');
            if (brandEl) brandEl.style.setProperty('color', '#FFFFFF', 'important');
            if (chevronEl) chevronEl.style.setProperty('color', '#FFFFFF', 'important');
            if (sepEl) sepEl.style.setProperty('background', 'rgba(255,255,255,0.4)', 'important');
            
            if (labelEl) { 
              labelEl.style.setProperty('color', '#FFFFFF', 'important'); 
              labelEl.textContent = '✓ Filled Successfully'; 
            }

            setTimeout(() => {
              // Revert to Signature Glass Theme
              bar.style.setProperty('background', 'rgba(10, 10, 10, 0.82)', 'important'); 
              bar.style.setProperty('border-color', 'rgba(16, 185, 129, 0.25)', 'important');
              
              if (shieldSvg) shieldSvg.style.setProperty('stroke', '#10B981', 'important');
              if (brandEl) brandEl.style.setProperty('color', '#10B981', 'important');
              if (chevronEl) chevronEl.style.setProperty('color', '#10B981', 'important');
              if (sepEl) sepEl.style.setProperty('background', 'rgba(255,255,255,0.2)', 'important');

              if (labelEl) { 
                labelEl.style.setProperty('color', '#FFFFFF', 'important'); 
                labelEl.textContent = label; 
              }
            }, 1000);
          }
        });
      };
      dropdown.appendChild(item);
    });

    shadow.appendChild(bar);
    shadow.appendChild(dropdown);
    passField.insertAdjacentElement('afterend', host);

    let isOpen = false;
    bar.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      isOpen = !isOpen;
      if (isOpen) {
        dropdown.classList.add('open');
      } else {
        dropdown.classList.remove('open');
      }
    };

    document.addEventListener('click', (e) => {
      if (!host.contains(e.target as Node)) {
        isOpen = false; dropdown.classList.remove('open');
      }
    });
  }

  static init(retries = 10) {
    const { passField } = FieldManager.findLoginFields();
    if (!passField) {
      if (retries > 0) setTimeout(() => this.init(retries - 1), 500);
      return;
    }

    if (passField.dataset.orionInjected === 'true') return;
    passField.dataset.orionInjected = 'true';

    const domain = window.location.hostname;
    chrome.runtime.sendMessage({ type: MessageType.GET_DOMAINS_CREDENTIALS, payload: { domain } }, (response) => {
      if (response?.credentials && response.credentials.length > 0) {
        this.injectBar(passField, response.credentials);
      }
      // Vault Locked or No accounts -> Silent (as requested)
    });
  }
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => InlineAutofillUI.init());
} else {
  InlineAutofillUI.init();
}

// Legacy listener for popup-triggered autofill fallback
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MessageType.FILL_FIELDS) {
    const { username, password } = message.payload;
    const success = FieldManager.fill(username, password);
    sendResponse({ success });
  }
});
