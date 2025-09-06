/**
 * Settings Panel for UI Customization
 * Handles theme switching, font settings, and persistence
 */
export class SettingsPanel {
  constructor(panelId = 'settings-panel') {
    this.panelId = panelId;
    this.elements = {};
    this.currentTheme = localStorage.getItem('uiTheme') || 'dark';
    this.currentFontFamily = localStorage.getItem('uiFontFamily') || 'Courier New, monospace';
    this.currentFontSize = localStorage.getItem('uiFontSize') || '12px';
    this.currentFontColor = localStorage.getItem('uiFontColor') || '#00ff00';
  }

  /**
   * Initialize the settings panel
   */
  initialize() {
    console.log('⚙️ Initializing Settings Panel...');
    
    try {
      this.createPanelStructure();
      this.setupEventListeners();
      this.applyCurrentSettings();
      this.showStatus('Settings loaded', 'success');
      
      console.log('✅ Settings Panel initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Settings Panel initialization failed:', error);
      this.showStatus('Failed to initialize settings: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Create the panel HTML structure
   */
  createPanelStructure() {
    const panel = document.getElementById(this.panelId);
    if (!panel) {
      throw new Error(`Settings panel element '${this.panelId}' not found`);
    }

    // Clear existing content
    panel.innerHTML = '';

    // Panel header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<span>UI Settings</span>';
    panel.appendChild(header);

    // Theme settings section
    const themeSection = document.createElement('div');
    themeSection.className = 'settings-section';
    themeSection.innerHTML = `
      <h4>Theme</h4>
      <div class="theme-controls">
        <label><input type="radio" name="theme" value="dark" ${this.currentTheme === 'dark' ? 'checked' : ''}> Dark (Retro)</label>
        <label><input type="radio" name="theme" value="light" ${this.currentTheme === 'light' ? 'checked' : ''}> Light</label>
      </div>
    `;
    panel.appendChild(themeSection);

    // Font settings section
    const fontSection = document.createElement('div');
    fontSection.className = 'settings-section';
    fontSection.innerHTML = `
      <h4>Font Settings</h4>
      <div class="font-controls">
        <label>Family:
          <select id="${this.panelId}-font-family">
            <option value="Courier New, monospace" ${this.currentFontFamily === 'Courier New, monospace' ? 'selected' : ''}>Monospace (Retro)</option>
            <option value="Arial, sans-serif" ${this.currentFontFamily === 'Arial, sans-serif' ? 'selected' : ''}>Arial</option>
            <option value="'Times New Roman', serif" ${this.currentFontFamily === "'Times New Roman', serif" ? 'selected' : ''}>Times</option>
          </select>
        </label>
        <label>Size:
          <select id="${this.panelId}-font-size">
            <option value="10px" ${this.currentFontSize === '10px' ? 'selected' : ''}>10px</option>
            <option value="12px" ${this.currentFontSize === '12px' ? 'selected' : ''}>12px</option>
            <option value="14px" ${this.currentFontSize === '14px' ? 'selected' : ''}>14px</option>
            <option value="16px" ${this.currentFontSize === '16px' ? 'selected' : ''}>16px</option>
          </select>
        </label>
        <label>Color:
          <input type="color" id="${this.panelId}-font-color" value="${this.currentFontColor.replace('#', '')}">
        </label>
      </div>
    `;
    panel.appendChild(fontSection);

    // Actions section
    const actionsSection = document.createElement('div');
    actionsSection.className = 'settings-actions';
    actionsSection.innerHTML = `
      <button id="${this.panelId}-apply">Apply Changes</button>
      <button id="${this.panelId}-reset">Reset to Default</button>
      <button id="${this.panelId}-save">Save Settings</button>
    `;
    panel.appendChild(actionsSection);

    // Status section
    const statusSection = document.createElement('div');
    statusSection.className = 'settings-status';
    statusSection.id = `${this.panelId}-status`;
    statusSection.innerHTML = '<div class="status-message">Ready</div>';
    panel.appendChild(statusSection);

    // Store element references
    this.elements = {
      panel: panel,
      themeRadios: themeSection.querySelectorAll('input[name="theme"]'),
      fontFamily: document.getElementById(`${this.panelId}-font-family`),
      fontSize: document.getElementById(`${this.panelId}-font-size`),
      fontColor: document.getElementById(`${this.panelId}-font-color`),
      applyBtn: document.getElementById(`${this.panelId}-apply`),
      resetBtn: document.getElementById(`${this.panelId}-reset`),
      saveBtn: document.getElementById(`${this.panelId}-save`),
      status: statusSection
    };

    // Add CSS for the settings panel
    this.addStyles();
  }

  /**
   * Add CSS styles for the settings panel
   */
  addStyles() {
    if (document.getElementById('settings-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'settings-panel-styles';
    style.textContent = `
      .settings-section {
        margin-bottom: 20px;
        padding: 15px;
        border: 1px solid #00ff00;
        background: rgba(0, 255, 0, 0.05);
        border-radius: 4px;
      }
      
      .settings-section h4 {
        margin: 0 0 10px 0;
        color: #00ff00;
        font-size: 14px;
        border-bottom: 1px solid #00ff00;
        padding-bottom: 5px;
      }
      
      .theme-controls, .font-controls {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .theme-controls label, .font-controls label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #00ff00;
        font-family: 'Courier New', monospace;
        font-size: 12px;
      }
      
      .theme-controls input[type="radio"],
      .font-controls select,
      .font-controls input[type="color"] {
        background: #000;
        color: #00ff00;
        border: 1px solid #00ff00;
        padding: 4px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        border-radius: 2px;
      }
      
      .font-controls input[type="color"] {
        width: 40px;
        height: 30px;
        padding: 0;
        cursor: pointer;
      }
      
      .settings-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #00ff00;
      }
      
      .settings-actions button {
        flex: 1;
        padding: 8px 12px;
        background: rgba(0, 255, 0, 0.1);
        border: 1px solid #00ff00;
        color: #00ff00;
        cursor: pointer;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        border-radius: 3px;
        transition: all 0.2s ease;
      }
      
      .settings-actions button:hover {
        background: rgba(0, 255, 0, 0.2);
      }
      
      .settings-actions button#${this.panelId}-reset {
        background: rgba(255, 0, 0, 0.1);
        border-color: #ff0000;
        color: #ff0000;
      }
      
      .settings-actions button#${this.panelId}-reset:hover {
        background: rgba(255, 0, 0, 0.2);
      }
      
      .settings-status {
        margin-top: 15px;
        padding: 10px;
        border: 1px solid #333;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        min-height: 20px;
      }
      
      .settings-status .status-message {
        color: #00ff00;
      }
      
      .settings-status .status-error {
        color: #ff0000;
      }
      
      .settings-status .status-success {
        color: #00ff00;
        font-weight: bold;
      }
      
      /* Responsive settings panel */
      @media (max-width: 768px) {
        .settings-actions {
          flex-direction: column;
          gap: 8px;
        }
        
        .theme-controls, .font-controls {
          gap: 8px;
        }
        
        .theme-controls label, .font-controls label {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup event listeners for settings controls
   */
  setupEventListeners() {
    // Theme radio buttons
    this.elements.themeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.currentTheme = e.target.value;
        this.applyTheme();
        this.showStatus(`Theme changed to ${this.currentTheme}`, 'info');
      });
    });

    // Font family change
    this.elements.fontFamily.addEventListener('change', (e) => {
      this.currentFontFamily = e.target.value;
      this.applyFontSettings();
      this.showStatus('Font family updated', 'info');
    });

    // Font size change
    this.elements.fontSize.addEventListener('change', (e) => {
      this.currentFontSize = e.target.value;
      this.applyFontSettings();
      this.showStatus('Font size updated', 'info');
    });

    // Font color change
    this.elements.fontColor.addEventListener('change', (e) => {
      this.currentFontColor = '#' + e.target.value;
      this.applyFontSettings();
      this.showStatus('Font color updated', 'info');
    });

    // Apply button
    this.elements.applyBtn.addEventListener('click', () => {
      this.saveSettings();
      this.applyAllSettings();
      this.showStatus('Settings applied successfully', 'success');
    });

    // Reset button
    this.elements.resetBtn.addEventListener('click', () => {
      this.resetToDefaults();
      this.showStatus('Settings reset to defaults', 'success');
    });

    // Save button
    this.elements.saveBtn.addEventListener('click', () => {
      this.saveSettings();
      this.showStatus('Settings saved to localStorage', 'success');
    });
  }

  /**
   * Apply current theme settings
   */
  applyTheme() {
    const root = document.documentElement;
    const body = document.body;
    
    if (this.currentTheme === 'dark') {
      root.style.setProperty('--bg-primary', '#000000');
      root.style.setProperty('--bg-secondary', '#111111');
      root.style.setProperty('--text-primary', '#00ff00');
      root.style.setProperty('--text-secondary', '#00cc00');
      root.style.setProperty('--border-primary', '#00ff00');
      root.style.setProperty('--border-secondary', '#006600');
      body.classList.remove('light-theme');
      body.classList.add('dark-theme');
    } else {
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f0f0f0');
      root.style.setProperty('--text-primary', '#000000');
      root.style.setProperty('--text-secondary', '#333333');
      root.style.setProperty('--border-primary', '#000000');
      root.style.setProperty('--border-secondary', '#666666');
      body.classList.remove('dark-theme');
      body.classList.add('light-theme');
    }
  }

  /**
   * Apply current font settings
   */
  applyFontSettings() {
    const root = document.documentElement;
    root.style.setProperty('--font-family', this.currentFontFamily);
    root.style.setProperty('--font-size', this.currentFontSize);
    root.style.setProperty('--font-color', this.currentFontColor);
  }

  /**
   * Apply all current settings
   */
  applyAllSettings() {
    this.applyTheme();
    this.applyFontSettings();
  }

  /**
   * Apply settings from localStorage on load
   */
  applyCurrentSettings() {
    this.applyAllSettings();
  }

  /**
   * Save current settings to localStorage
   */
  saveSettings() {
    localStorage.setItem('uiTheme', this.currentTheme);
    localStorage.setItem('uiFontFamily', this.currentFontFamily);
    localStorage.setItem('uiFontSize', this.currentFontSize);
    localStorage.setItem('uiFontColor', this.currentFontColor);
    
    // Trigger custom event for other components
    window.dispatchEvent(new CustomEvent('settingsUpdated', {
      detail: {
        theme: this.currentTheme,
        fontFamily: this.currentFontFamily,
        fontSize: this.currentFontSize,
        fontColor: this.currentFontColor
      }
    }));
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults() {
    this.currentTheme = 'dark';
    this.currentFontFamily = 'Courier New, monospace';
    this.currentFontSize = '12px';
    this.currentFontColor = '#00ff00';
    
    // Update UI elements
    this.elements.themeRadios.forEach(radio => {
      radio.checked = radio.value === 'dark';
    });
    this.elements.fontFamily.value = 'Courier New, monospace';
    this.elements.fontSize.value = '12px';
    this.elements.fontColor.value = '00ff00';
    
    this.applyAllSettings();
    this.saveSettings();
  }

  /**
   * Show status message in the settings panel
   */
  showStatus(message, type = 'info') {
    const statusDiv = this.elements.status.querySelector('.status-message') || 
                     this.elements.status.appendChild(document.createElement('div'));
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;
    
    // Auto-clear non-error messages after 3 seconds
    if (type !== 'error') {
      setTimeout(() => {
        if (statusDiv.textContent === message) {
          statusDiv.textContent = 'Ready';
          statusDiv.className = 'status-message';
        }
      }, 3000);
    }
  }
}

/**
 * Initialize the settings panel
 */
export function initializeSettingsPanel() {
  const panelElement = document.getElementById('settings-panel');
  if (!panelElement) {
    console.warn('Settings panel element not found - creating dynamically');
    
    // Create panel element if it doesn't exist
    const mainLayout = document.getElementById('main-layout');
    if (mainLayout) {
      const panel = document.createElement('div');
      panel.id = 'settings-panel';
      panel.className = 'panel';
      panel.style.cssText = 'position: relative; width: 400px; height: 500px; display: none;';
      mainLayout.appendChild(panel);
    } else {
      console.error('Main layout not found - cannot create settings panel');
      return null;
    }
  }

  const settingsPanel = new SettingsPanel();
  settingsPanel.initialize();
  window.settingsPanel = settingsPanel; // Global access
  
  return settingsPanel;
}

// Listen for settings updates globally
if (typeof window !== 'undefined') {
  window.addEventListener('settingsUpdated', (e) => {
    console.log('Global settings updated:', e.detail);
    // Trigger CSS variable updates for all elements
    const root = document.documentElement;
    root.style.setProperty('--ui-theme', e.detail.theme);
    root.style.setProperty('--ui-font-family', e.detail.fontFamily);
    root.style.setProperty('--ui-font-size', e.detail.fontSize);
    root.style.setProperty('--ui-font-color', e.detail.fontColor);
    
    // Update body class for theme
    document.body.className = e.detail.theme + '-theme';
  });
}