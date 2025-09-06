# Setup & Deployment Guide

Complete setup instructions for iMaCoMpUtERussy development and deployment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
  - [Python Method](#python-method)
  - [Node.js Method](#nodejs-method)
  - [Python Virtual Environment](#python-virtual-environment)
- [Google Cloud Console Setup](#google-cloud-console-setup)
  - [Create Project](#create-project)
  - [Enable YouTube API](#enable-youtube-api)
  - [Create OAuth Credentials](#create-oauth-credentials)
  - [Configure API Restrictions](#configure-api-restrictions)
- [Browser Compatibility](#browser-compatibility)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting Setup](#troubleshooting-setup)

## Prerequisites

### System Requirements

- **Operating System**: Windows 10+, macOS 10.14+, Linux (Ubuntu 18.04+)
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: 1GB free space for development
- **Browser**: See [Browser Compatibility](#browser-compatibility) section

### Required Software

1. **Git** (version control)
   ```bash
   # Check if installed
   git --version

   # If not installed, download from https://git-scm.com/
   ```

2. **Modern browser with ES6 support**
   - Chrome 88+ (recommended)
   - Firefox 85+
   - Safari 14+
   - Edge 88+

### Optional Dependencies

- **Python 3.8+** (for local server)
- **Node.js 16+** (for development tools)
- **Google Cloud SDK** (for deployment)

## Local Development Setup

Choose one of the following methods based on your development preferences.

### Python Method (Simplest)

For users who want the quickest setup:

#### Step 1: Verify Python Installation

```bash
# Open command prompt/terminal and run:
python --version
# or
python3 --version

# If not installed, download from: https://python.org/downloads/
```

#### Step 2: Clone Repository

```bash
# Clone the iMaCoMpUtERussy repository
git clone https://github.com/your-username/iMaCoMpUtERussy.git
cd iMaCoMpUtERussy
```

#### Step 3: Start Development Server

```bash
# Start local web server
python -m http.server 8000
# or if python3 command is available:
python3 -m http.server 8000
```

#### Step 4: Open in Browser

```bash
# Open your web browser and navigate to:
# http://localhost:8000
```

**Expected Output:**
```
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

### Node.js Method (Advanced)

For developers who want more control and features:

#### Step 1: Install Node.js

```bash
# Download from: https://nodejs.org/
# Or use package manager:

# Windows (Chocolatey)
choco install nodejs

# macOS (Homebrew)
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Step 2: Verify Installation

```bash
# Check versions
node --version
npm --version
```

#### Step 3: Clone and Setup

```bash
# Clone repository
git clone https://github.com/your-username/iMaCoMpUtERussy.git
cd iMaCoMpUtERussy

# Install dependencies
npm install

# Start development server
npm start
# or
npm run dev
```

#### Available NPM Scripts

```json
{
  "scripts": {
    "start": "http-server . -p 8000 -c-1",
    "dev": "http-server . -p 8000 -c-1 --cors",
    "test": "run tests in parallel",
    "test:cpu": "run CPU-specific tests",
    "test:memory": "run memory tests",
    "test:assembler": "run assembler tests"
  }
}
```

### Python Virtual Environment (Recommended)

For production-like development environment:

#### Step 1: Create Virtual Environment

```bash
# Navigate to project directory
cd iMaCoMpUtERussy

# Create virtual environment
python -m venv .venv

# Activate environment
# On Windows:
.venv\Scripts\activate

# On macOS/Linux:
source .venv/bin/activate
```

#### Step 2: Install Dependencies

```bash
# Install any requirements (if requirements.txt exists)
pip install -r requirements.txt

# Or upgrade pip
pip install --upgrade pip
```

#### Step 3: Start Server

```bash
# With virtual environment activated:
python -m http.server 8000
```

#### Step 4: Deactivate When Done

```bash
# When finished developing:
deactivate
```

## Google Cloud Console Setup

Required for YouTube integration and video uploads/downloads.

### Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Navigate: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create New Project**
   ```
   Project Name: iMaCoMpUtERussy
   Organization: (your organization or "No organization")
   Location: (default)
   ```

3. **Note Project ID**
   ```
   Project ID: iMaCoMpUtERussy-xxxxx (auto-generated)
   ```

### Step 2: Enable YouTube Data API

1. **Navigate to APIs & Services**
   - Go to: https://console.cloud.google.com/apis/dashboard

2. **Enable YouTube Data API v3**
   - Click "Enable APIs and Services"
   - Search for: "YouTube Data API v3"
   - Click "Enable"

3. **Verify Quota Limits**
   - Go to: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
   - Default quota: 10,000 units per day
   - This allows ~333 uploads or downloads per day

### Step 3: Create OAuth Credentials

1. **Create OAuth 2.0 Client**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"

2. **Configure OAuth Consent Screen**
   ```
   User Type: External
   App name: iMaCoMpUtERussy
   User support email: your-email@example.com
   Developer contact information: your-email@example.com
   ```

3. **Add Scopes**
   ```
   https://www.googleapis.com/auth/youtube.upload
   https://www.googleapis.com/auth/youtube.readonly
   ```

4. **Create Client ID**
   ```
   Application type: Web application
   Name: iMaCoMpUtERussy Web Client
   Authorized redirect URIs: http://localhost:8000
   ```

5. **Save Client ID and Secret**
   ```
   Client ID: your-client-id.apps.googleusercontent.com
   Client Secret: your-client-secret
   ```
![Google Cloud OAuth setup screenshots](images/google-cloud-oauth-setup-screenshots.png)

### Step 4: Configure API Restrictions

1. **Restrict API Key Usage**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Edit your OAuth 2.0 Client
   - Add restrictions if needed

2. **Set Up Billing (Optional but Recommended)**
   - YouTube API has a free tier (10,000 quota units/day)
   - Paid tier starts at $0.18 per 1,000 units over free quota

## Browser Compatibility

### WebCodecs API Support

| Browser | Version | WebCodecs Support | Fallback Method | Status |
|---------|---------|-------------------|-----------------|--------|
| Chrome | 94+ | ✅ Full | JSON | ✅ Best |
| Edge | 94+ | ✅ Full | JSON | ✅ Good |
| Firefox | 93+ | ⚠️ Partial | JSON | ⚠️ Limited |
| Safari | 15+ | ⚠️ Partial | JSON | ⚠️ Limited |
| Mobile Chrome | 94+ | ✅ Full | JSON | ✅ Good |

### Required Features

```javascript
// Check WebCodecs support
const webcodecsSupported = typeof VideoEncoder !== 'undefined' &&
                          typeof VideoDecoder !== 'undefined';

// Check File System Access API
const fileApiSupported = 'showOpenFilePicker' in window;

// Check Canvas API
const canvasSupported = !!document.createElement('canvas').getContext;
```

### Feature Detection

```javascript
// Add to your application
function checkBrowserSupport() {
    const features = {
        webcodecs: typeof VideoEncoder !== 'undefined',
        fileapi: 'showOpenFilePicker' in window ||
                ('File' in window && 'FileReader' in window),
        canvas: !!document.createElement('canvas').getContext,
        webgl: !!document.createElement('canvas').getContext('webgl')
    };

    console.table(features);

    if (!features.webcodecs) {
        console.warn('WebCodecs not supported - video encoding will use fallback');
    }

    return features;
}
```

## CI/CD Integration

### GitHub Actions Setup

1. **Create Workflow File**
   ```yaml
   # .github/workflows/ci.yml
   name: iMaCoMpUtERussy CI

   on: [push, pull_request]

   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
         - run: npm install
         - run: npm test
   ```

2. **Add Package.json Scripts**
   ```json
   {
     "scripts": {
       "test": "run-p test:cpu test:memory test:assembler",
       "test:cpu": "node tests/cpu.basic.test.js",
       "test:memory": "node tests/memory.basic.test.js",
       "test:assembler": "node tests/assembler.basic.test.js",
       "lint": "eslint js/**/*.js",
       "build": "echo 'ES modules - no build step needed'"
     }
   }
   ```

### Pre-commit Hooks

1. **Install Husky**
   ```bash
   npm install --save-dev husky
   npx husky install
   ```

2. **Add Pre-commit Hook**
   ```bash
   npx husky add .husky/pre-commit "npm run lint && npm test"
   ```

3. **Add Pre-push Hook**
   ```bash
   npx husky add .husky/pre-push "npm run test:integration"
   ```

### Deployment Options

#### GitHub Pages (Static Hosting)

1. **Enable GitHub Pages**
   - Go to: Repository Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `main` or `gh-pages`

2. **Deploy Script**
   ```bash
   # Deploy to gh-pages branch
   npm run build
   npx gh-pages -d .
   ```

#### Firebase Hosting (Recommended for Production)

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Initialize Project**
   ```bash
   firebase login
   firebase init hosting
   ```

3. **Configure firebase.json**
   ```json
   {
     "hosting": {
       "public": ".",
       "ignore": [
         "firebase.json",
         "**/.*",
         "**/node_modules/**"
       ],
       "rewrites": [
         {
           "source": "**",
           "destination": "/index.html"
         }
       ]
     }
   }
   ```

4. **Deploy**
   ```bash
   firebase deploy --only hosting
   ```

## Troubleshooting Setup

### Common Setup Issues

#### Python Server Not Starting

```bash
# Error: "python: command not found"
# Solution: Install Python from python.org

# Error: "OSError: [Errno 48] Address already in use"
# Solution: Kill process using port 8000
lsof -ti:8000 | xargs kill -9
# Or use different port:
python -m http.server 8080
```

#### Node.js Installation Issues

```bash
# Permission errors during npm install
# Solution: Use sudo (Linux/macOS) or run as administrator (Windows)
sudo npm install

# Or fix permissions:
sudo chown -R $(whoami) ~/.npm
```

#### Browser Console Errors

```javascript
// Uncaught ReferenceError: import statements are not supported
// Solution: Use modern browser (Chrome 88+, Firefox 85+)
// Or add type="module" to script tags

// CORS errors when loading local files
// Solution: Use --cors flag with Node.js server
http-server . -p 8000 --cors

// WebCodecs not supported
// Solution: Use fallback JSON method (automatic)
// Or upgrade browser to latest version
```

### Google Cloud Issues

#### OAuth Redirect URI Mismatch

```
Error: redirect_uri_mismatch

Solution:
1. Go to Google Cloud Console
2. APIs & Services → Credentials
3. Edit OAuth 2.0 Client
4. Add authorized redirect URI: http://localhost:8000
5. Save and retry
```

#### YouTube API Quota Exceeded

```
Error: quotaExceeded

Solutions:
1. Wait for daily quota reset (Pacific Time)
2. Request higher quota limit in Google Cloud Console
3. Enable billing for paid quota increase
4. Implement exponential backoff in your code
```

### Network and Security

#### Mixed Content Warnings

```
Mixed Content: The page at 'https://...' was loaded over HTTPS,
but requested an insecure XMLHttpRequest endpoint.

Solution:
1. Use HTTPS in production
2. For development, allow mixed content in browser settings
3. Or use localhost instead of IP addresses
```

#### Firewall Blocking Ports

```bash
# Check if port is open
# Windows:
netstat -an | find "8000"

# Linux:
netstat -tlnp | grep :8000

# Allow port through firewall
# Windows: Windows Defender Firewall → Advanced Settings
# Linux/UFW: sudo ufw allow 8000
# Linux/firewalld: sudo firewall-cmd --add-port=8000/tcp
```

### Performance Issues

#### Large File Processing

```javascript
// If browser crashes on large videos:
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const CHUNK_SIZE = 256 * 1024; // 256KB chunks

// Add file size validation before processing
if (file.size > MAX_FILE_SIZE) {
    alert('File too large. Maximum size: 100MB');
    return;
}
```

#### Memory Leaks in Long Sessions

```javascript
// Clean up resources
function cleanup() {
    // Revoke object URLs
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (canvasUrl) URL.revokeObjectURL(canvasUrl);

    // Clear large arrays
    if (frames) frames.length = 0;

    // Force garbage collection if available
    if (window.gc) window.gc();
}
```

---

Next: [Developer API](DEVELOPER_API.md) | [Video Embedding Guide](VIDEO_EMBEDDING_GUIDE.md) | [Troubleshooting](TROUBLESHOOTING.md)