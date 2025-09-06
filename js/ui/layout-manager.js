// Layout Manager for Modular UI Panels
// Handles drag-and-drop reordering, resizing, and toggling of panels

export class LayoutManager {
  constructor() {
    this.panels = [];
    this.layoutContainer = null;
    this.sidebar = null;
    this.savedLayout = JSON.parse(localStorage.getItem('uiLayout') || '[]');
    this.isDragging = false;
    this.dragPanel = null;
    this.dragOverPanel = null;
  }

  // Initialize the layout system
  init(containerSelector, sidebarSelector) {
    this.layoutContainer = document.querySelector(containerSelector);
    this.sidebar = document.querySelector(sidebarSelector);
    
    if (!this.layoutContainer) {
      console.error('Layout container not found');
      return;
    }

    // Identify all panels including the new assembly panel
    this.panels = Array.from(this.layoutContainer.querySelectorAll('.panel')).map(panel => ({
      element: panel,
      id: panel.id,
      visible: this.isPanelVisible(panel),
      title: panel.querySelector('.panel-header span')?.textContent || panel.id,
      position: this.getPanelPosition(panel)
    }));

    // Ensure assembly panel is included even if not yet in DOM
    let assemblyPanelCheck = this.panels.find(p => p.id === 'assembly-panel');
    if (!assemblyPanelCheck) {
      // Create assembly panel if it doesn't exist
      const assemblyElement = document.createElement('div');
      assemblyElement.id = 'assembly-panel';
      assemblyElement.className = 'panel';
      assemblyElement.style.cssText = 'position: absolute; top: 10%; left: 10%; width: 600px; height: 500px; display: none;';
      this.layoutContainer.appendChild(assemblyElement);
      
      this.panels.push({
        element: assemblyElement,
        id: 'assembly-panel',
        visible: false,
        title: 'Assembly Editor',
        position: { top: 0.1, left: 0.1 }
      });
      
      console.log('Created assembly panel dynamically');
    }

    // Ensure states panel is included even if not yet in DOM
    let statesPanelCheck = this.panels.find(p => p.id === 'states-panel');
    if (!statesPanelCheck) {
      // Create states panel
      const statesElement = document.createElement('div');
      statesElement.id = 'states-panel';
      statesElement.className = 'panel';
      statesElement.style.cssText = 'position: absolute; top: 20%; right: 10%; width: 400px; height: 400px; display: none; background: #1a1a1a; border: 2px solid #00ff00;';
      
      // Create states panel content
      statesElement.innerHTML = `
        <div class="panel-header" style="background: #333; color: #00ff00; padding: 10px; display: flex; justify-content: space-between; align-items: center;">
          <span>RAM States Manager</span>
          <div class="drag-handle" style="cursor: grab; padding: 2px 4px; background: rgba(0,255,0,0.1); border: 1px solid #00ff00; font-size: 12px;">⋮⋮</div>
        </div>
        <div class="panel-content" style="padding: 10px; height: calc(100% - 60px); overflow-y: auto;">
          <div id="states-list" style="margin-bottom: 15px;">
            <div style="color: #666; font-style: italic; text-align: center;">No states available</div>
          </div>
          <div class="states-controls" style="display: flex; gap: 5px; margin-bottom: 10px;">
            <input type="text" id="new-state-name" placeholder="State name" style="flex: 1; padding: 5px; background: #333; color: #00ff00; border: 1px solid #00ff00;">
            <button id="create-state-btn" style="padding: 5px 10px; background: #00ff00; color: #000; border: none; cursor: pointer;">Create</button>
          </div>
          <div class="state-actions" style="display: flex; gap: 5px;">
            <button id="switch-state-btn" style="flex: 1; padding: 5px; background: #0080ff; color: white; border: none; cursor: pointer;" disabled>Switch</button>
            <button id="delete-state-btn" style="flex: 1; padding: 5px; background: #ff0000; color: white; border: none; cursor: pointer;" disabled>Delete</button>
          </div>
          <div id="current-state-info" style="margin-top: 10px; padding: 5px; background: rgba(0,255,0,0.1); border: 1px solid #00ff00; font-size: 12px;">
            Current: <span id="current-state-name">default</span>
          </div>
        </div>
      `;
      
      this.layoutContainer.appendChild(statesElement);
      
      // Add states panel to panels array
      this.panels.push({
        element: statesElement,
        id: 'states-panel',
        visible: false,
        title: 'RAM States Manager',
        position: { top: 0.2, left: 0.7 }
      });
      
      // Initialize states panel functionality
      this.initializeStatesPanel();
      
      console.log('Created states panel dynamically');
    }

    // Log detected panels including new MCP ones
    console.log('Detected panels:', this.panels.map(p => p.id));
    const mcpPanel = this.panels.find(p => p.id === 'mcp-input-panel');
    if (mcpPanel) {
      console.log('✅ MCP Natural Language Input panel registered');
    }

    // Load saved layout if available
    if (this.savedLayout.length > 0) {
      this.loadLayout(this.savedLayout);
    }

    // Set up drag and drop
    this.setupDragAndDrop();

    // Set up resizing
    this.setupResizing();

    // Create sidebar if needed
    if (this.sidebar) {
      this.createSidebar();
    }

    // Add custom controls to specific panels
    const mcpPanel = this.panels.find(p => p.id === 'mcp-input-panel');
    if (mcpPanel) {
      this.addPanelControl('mcp-input-panel', 'voice-toggle');
    }

    // Initialize assembly panel if it exists
    const assemblyPanel = this.panels.find(p => p.id === 'assembly-panel');
    if (assemblyPanel && assemblyPanel.element) {
      // Import and initialize assembly panel
      import('./assembly-panel.js').then(module => {
        if (module.initializeAssemblyPanel) {
          module.initializeAssemblyPanel();
          console.log('✅ Assembly panel initialized via layout manager');
        }
      }).catch(err => {
        console.warn('Failed to initialize assembly panel:', err);
      });
    }

    // Add custom controls to specific panels using existing mcpPanel reference
    if (mcpPanel) {
      this.addPanelControl('mcp-input-panel', 'voice-toggle');
    }

    // Ensure all panels have proper classes
    this.panels.forEach(panelInfo => {
      this.makePanelDraggable(panelInfo.element);
      this.makePanelResizable(panelInfo.element);
    });

    console.log('LayoutManager initialized with', this.panels.length, 'panels');
  }

  // Check if panel should be visible based on saved state
  isPanelVisible(panel) {
    const savedPanel = this.savedLayout.find(p => p.id === panel.id);
    if (savedPanel) {
      return savedPanel.visible !== false;
    }
    return !panel.classList.contains('collapsed') && !panel.classList.contains('hidden');
  }

  // Get current position of panel in layout
  getPanelPosition(panel) {
    const rect = panel.getBoundingClientRect();
    const containerRect = this.layoutContainer.getBoundingClientRect();
    return {
      top: (rect.top - containerRect.top) / containerRect.height,
      left: (rect.left - containerRect.left) / containerRect.width
    };
  }

  // Setup drag and drop functionality
  setupDragAndDrop() {
    // Add drag handle to each panel header
    this.panels.forEach(panelInfo => {
      const header = panelInfo.element.querySelector('.panel-header');
      if (header) {
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.style.cssText = `
          cursor: grab;
          user-select: none;
          padding: 2px 4px;
          background: rgba(0,255,0,0.1);
          border: 1px solid #00ff00;
          font-size: 12px;
          margin-left: auto;
          margin-right: 5px;
          display: inline-block;
          width: 20px;
          text-align: center;
        `;
        header.appendChild(dragHandle);
        
        // Make header draggable
        header.draggable = true;
        header.addEventListener('dragstart', (e) => this.handleDragStart(e, panelInfo));
        header.addEventListener('dragend', (e) => this.handleDragEnd(e));
        
        // Add drop zones to panels
        panelInfo.element.addEventListener('dragover', (e) => this.handleDragOver(e));
        panelInfo.element.addEventListener('drop', (e) => this.handleDrop(e, panelInfo));
        panelInfo.element.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        panelInfo.element.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      }
    });

    // Add drop zone to layout container
    this.layoutContainer.addEventListener('dragover', (e) => e.preventDefault());
    this.layoutContainer.addEventListener('drop', (e) => this.handleContainerDrop(e));
  }

  // Make panel draggable
  makePanelDraggable(panel) {
    panel.draggable = true;
  }

  // Setup resizing for panels
  setupResizing() {
    this.panels.forEach(panelInfo => {
      // Add resize handle to bottom-right corner
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.innerHTML = '↘';
      resizeHandle.style.cssText = `
        position: absolute;
        bottom: 0;
        right: 0;
        width: 15px;
        height: 15px;
        cursor: se-resize;
        background: rgba(0,255,0,0.2);
        border: 1px solid #00ff00;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        user-select: none;
        z-index: 10;
      `;
      
      panelInfo.element.style.position = 'relative';
      panelInfo.element.style.resize = 'both';
      panelInfo.element.style.overflow = 'auto';
      panelInfo.element.appendChild(resizeHandle);
      
      // Listen for resize events
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          this.saveLayout();
        }
      });
      
      resizeObserver.observe(panelInfo.element);
    });
  }

  // Make panel resizable
  makePanelResizable(panel) {
    panel.style.resize = 'both';
    panel.style.overflow = 'auto';
    panel.style.minWidth = '200px';
    panel.style.minHeight = '150px';
  }

  // Handle drag start
  handleDragStart(e, panelInfo) {
    this.isDragging = true;
    this.dragPanel = panelInfo;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', panelInfo.id);
    
    // Visual feedback
    panelInfo.element.style.opacity = '0.5';
    panelInfo.element.style.transform = 'rotate(5deg)';
    console.log('Started dragging panel:', panelInfo.id);
  }

  // Handle drag end
  handleDragEnd(e) {
    this.isDragging = false;
    this.dragPanel = null;
    this.dragOverPanel = null;
    
    // Reset visual feedback
    this.panels.forEach(panelInfo => {
      panelInfo.element.style.opacity = '1';
      panelInfo.element.style.transform = 'none';
    });
    
    // Clear drop zone highlights
    document.querySelectorAll('.panel.drop-zone').forEach(el => {
      el.classList.remove('drop-zone');
    });
    
    console.log('Finished dragging');
  }

  // Handle drag over
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const panel = e.currentTarget;
    if (panel !== this.dragPanel?.element) {
      panel.classList.add('drop-zone');
      panel.style.border = '2px dashed #00ff00';
    }
  }

  // Handle drag enter
  handleDragEnter(e) {
    if (this.isDragging && e.currentTarget !== this.dragPanel?.element) {
      e.currentTarget.classList.add('drop-zone');
    }
  }

  // Handle drag leave
  handleDragLeave(e) {
    if (this.isDragging) {
      e.currentTarget.classList.remove('drop-zone');
      e.currentTarget.style.border = '';
    }
  }

  // Handle drop on panel
  handleDrop(e, targetPanelInfo) {
    e.preventDefault();
    this.handleDragEnd(e);
    
    if (this.dragPanel && targetPanelInfo.id !== this.dragPanel.id) {
      this.reorderPanels(this.dragPanel, targetPanelInfo);
      this.saveLayout();
      console.log(`Moved ${this.dragPanel.id} to position near ${targetPanelInfo.id}`);
    }
  }

  // Handle drop on container
  handleContainerDrop(e) {
    e.preventDefault();
    this.handleDragEnd(e);
    console.log('Dropped on container');
  }

  // Reorder panels in DOM
  reorderPanels(sourcePanel, targetPanel) {
    const source = sourcePanel.element;
    const target = targetPanel.element;
    
    // Insert source after target
    this.layoutContainer.insertBefore(source, target.nextSibling);
    
    // Update positions in internal state
    const sourceIndex = this.panels.indexOf(sourcePanel);
    const targetIndex = this.panels.indexOf(targetPanel);
    [this.panels[sourceIndex], this.panels[targetIndex]] = 
      [this.panels[targetIndex], this.panels[sourceIndex]];
  }

  // Create sidebar for panel controls
  createSidebar() {
    const sidebarContent = `
      <div class="sidebar-header">
        <h3>Panel Controls</h3>
      </div>
      <div class="panel-list">
        ${this.panels.map(panelInfo => `
          <div class="panel-control">
            <label>
              <input type="checkbox" ${panelInfo.visible ? 'checked' : ''}
                     data-panel-id="${panelInfo.id}"
                     class="panel-toggle">
              ${panelInfo.title}
            </label>
            <button class="reset-panel" data-panel-id="${panelInfo.id}">Reset</button>
            ${panelInfo.id === 'assembly-panel' ? '<button class="load-sample-btn" data-panel-id="assembly-panel">Load Sample</button>' : ''}
          </div>
        `).join('')}
      </div>
      <div class="layout-actions">
        <button id="save-layout">Save Layout</button>
        <button id="reset-layout">Reset All</button>
      </div>
    `;
    
    this.sidebar.innerHTML = sidebarContent;
    
    // Add event listeners
    this.sidebar.querySelectorAll('.panel-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const panelId = e.target.dataset.panelId;
        const panelInfo = this.panels.find(p => p.id === panelId);
        if (panelInfo) {
          this.togglePanel(panelInfo, e.target.checked);
          this.saveLayout();
        }
      });
    });
    
    this.sidebar.querySelectorAll('.reset-panel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const panelId = e.target.dataset.panelId;
        this.resetPanel(panelId);
      });
    });

    // Add load sample button handler for assembly panel
    this.sidebar.querySelectorAll('.load-sample-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const panelId = e.target.dataset.panelId;
        if (panelId === 'assembly-panel' && window.assemblyPanel && window.assemblyPanel.loadSampleProgram) {
          window.assemblyPanel.loadSampleProgram();
          console.log('Loaded sample via sidebar control');
        }
      });
    });

    // Add states panel controls
    const statesControl = this.sidebar.querySelector('#states-control');
    if (statesControl) {
      statesControl.addEventListener('click', () => {
        const statesPanelInfo = this.panels.find(p => p.id === 'states-panel');
        if (statesPanelInfo) {
          this.togglePanel(statesPanelInfo, !statesPanelInfo.visible);
          this.saveLayout();
        }
      });
    }
    
    const saveBtn = this.sidebar.querySelector('#save-layout');
    const resetBtn = this.sidebar.querySelector('#reset-layout');
    
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveLayout());
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetAllPanels());
  }

  /**
   * Add custom control to a specific panel
   * @param {string} panelId - ID of the panel to add control to
   * @param {string} controlType - Type of control ('voice-toggle', etc.)
   */
  addPanelControl(panelId, controlType = 'voice-toggle') {
    const panelInfo = this.panels.find(p => p.id === panelId);
    if (!panelInfo || !panelInfo.element) {
      console.warn(`Panel ${panelId} not found for control addition`);
      return;
    }

    const panel = panelInfo.element;
    let controlElement;

    if (controlType === 'voice-toggle') {
      // Create voice toggle button
      controlElement = document.createElement('button');
      controlElement.id = 'voice-toggle-mcp';
      controlElement.className = 'voice-toggle-btn';
      controlElement.innerHTML = '🎤 Voice Control';
      controlElement.style.cssText = `
        background: rgba(0, 255, 0, 0.1);
        border: 1px solid #00ff00;
        color: #00ff00;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-family: monospace;
        margin: 5px;
        width: calc(100% - 10px);
      `;
      controlElement.title = 'Toggle voice control for MCP commands';

      // Add event listener
      controlElement.addEventListener('click', () => {
        if (window.voiceControl && typeof window.voiceControl.toggleVoiceControl === 'function') {
          window.voiceControl.toggleVoiceControl();
          // Update button text based on state
          const isActive = window.voiceControl.isActive;
          controlElement.innerHTML = isActive ? '🔇 Stop Voice' : '🎤 Voice Control';
          controlElement.style.background = isActive ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)';
        } else {
          console.warn('Voice control system not available');
          alert('Voice control not initialized. Please refresh the page.');
        }
      });

      // Append to panel footer or create if not exists
      let footer = panel.querySelector('.panel-footer');
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'panel-footer';
        footer.style.cssText = 'padding: 10px; border-top: 1px solid #333; text-align: center;';
        panel.appendChild(footer);
      }
      footer.appendChild(controlElement);
      console.log(`✅ Added voice toggle to MCP panel`);
    }

    // Add more control types as needed
  }

  // Toggle panel visibility
  togglePanel(panelInfo, visible) {
    if (visible) {
      panelInfo.element.style.display = '';
      panelInfo.element.classList.remove('collapsed', 'hidden');
      panelInfo.visible = true;
    } else {
      panelInfo.element.style.display = 'none';
      panelInfo.element.classList.add('hidden');
      panelInfo.visible = false;
    }
    console.log(`Toggled ${panelInfo.id} to ${visible ? 'visible' : 'hidden'}`);
  }

  // Reset panel to default state
  resetPanel(panelId) {
    const panelInfo = this.panels.find(p => p.id === panelId);
    if (panelInfo) {
      panelInfo.element.style.display = '';
      panelInfo.element.classList.remove('collapsed', 'hidden');
      panelInfo.element.style.width = '';
      panelInfo.element.style.height = '';
      panelInfo.element.style.position = 'relative';
      panelInfo.visible = true;
      
      // Update sidebar checkbox
      const checkbox = this.sidebar.querySelector(`[data-panel-id="${panelId}"]`);
      if (checkbox) checkbox.checked = true;
      
      this.saveLayout();
      console.log(`Reset panel ${panelId}`);
    }
  }

  // Reset all panels to default
  resetAllPanels() {
    this.panels.forEach(panelInfo => this.resetPanel(panelInfo.id));
    localStorage.removeItem('uiLayout');
    console.log('Reset all panels to default');
  }

  // Save current layout to localStorage
  saveLayout() {
    const layoutData = this.panels.map(panelInfo => ({
      id: panelInfo.id,
      visible: panelInfo.visible,
      position: this.getPanelPosition(panelInfo.element),
      size: {
        width: panelInfo.element.offsetWidth,
        height: panelInfo.element.offsetHeight
      }
    }));
    
    localStorage.setItem('uiLayout', JSON.stringify(layoutData));
    console.log('Layout saved');
  }

  // Load saved layout
  loadLayout(layoutData) {
    layoutData.forEach(savedPanel => {
      const panelInfo = this.panels.find(p => p.id === savedPanel.id);
      if (panelInfo) {
        // Set visibility
        this.togglePanel(panelInfo, savedPanel.visible);
        
        // Set position and size if available
        if (savedPanel.position && savedPanel.size) {
          const containerRect = this.layoutContainer.getBoundingClientRect();
          panelInfo.element.style.position = 'absolute';
          panelInfo.element.style.left = `${savedPanel.position.left * 100}%`;
          panelInfo.element.style.top = `${savedPanel.position.top * 100}%`;
          panelInfo.element.style.width = `${savedPanel.size.width}px`;
          panelInfo.element.style.height = `${savedPanel.size.height}px`;
        }
      }
    });
    
    console.log('Layout loaded from storage');
  }

  // Get current layout as JSON for export
  getLayoutJSON() {
    return JSON.stringify({
      panels: this.panels.map(p => ({
        id: p.id,
        title: p.title,
        visible: p.visible
      })),
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  // Import layout from JSON
  importLayout(jsonString) {
    try {
      const layoutData = JSON.parse(jsonString);
      this.loadLayout(layoutData.panels || layoutData);
      console.log('Layout imported successfully');
    } catch (error) {
      console.error('Failed to import layout:', error);
    }
  }
}

// Global instance for easy access
window.LayoutManager = LayoutManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const layoutContainer = document.querySelector('#main-layout');
    const sidebarContainer = document.querySelector('#panel-sidebar');
    if (layoutContainer) {
      const manager = new LayoutManager();
      manager.init('#main-layout', '#panel-sidebar');
      window.layoutManager = manager;
    }
  });
}