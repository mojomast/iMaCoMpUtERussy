/**
 * YouTube Platform Manager for VideoStorage-8
 * Full implementation with OAuth 2.0 and YouTube Data API v3
 */

// YouTube API OAuth Configuration
// TODO: Replace with actual values from Google Cloud Console
const CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
const CLIENT_SECRET = 'your-client-secret';
const YOUTUBE_SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly'
];
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const OAUTH_REDIRECT_URI = window.location.origin;

/**
 * YouTube Platform Manager
 * Handles OAuth authentication and video operations
 */
export class PlatformManager {
    /**
     * Constructor initializes the platform manager
     */
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.oauthClient = null;
        this.rateLimiter = new RateLimiter();
    }

    /**
     * Initialize OAuth client configuration
     * @returns {Promise<void>}
     */
    async initOAuth() {
        try {
            if (typeof google === 'undefined') {
                throw new Error('Google Identity Services library not loaded. Please include the GIS script.');
            }

            this.oauthClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: YOUTUBE_SCOPES.join(' '),
                callback: (tokenResponse) => {
                    if (tokenResponse.error) {
                        throw new Error(`OAuth Error: ${tokenResponse.error}`);
                    }
                    this.storeTokens(tokenResponse);
                }
            });
        } catch (error) {
            throw new Error(`Failed to initialize OAuth: ${error.message}`);
        }
    }

    /**
     * Authenticate with YouTube using OAuth 2.0
     * @returns {Promise<void>}
     */
    async authenticate() {
        try {
            if (!this.oauthClient) {
                await this.initOAuth();
            }

            // Check if we have a valid token
            if (this.isAuthenticated()) {
                return;
            }

            // Request new token
            return new Promise((resolve, reject) => {
                try {
                    this.oauthClient.requestAccessToken({
                        prompt: 'consent'
                    });
                    resolve();
                } catch (error) {
                    reject(new Error(`Authentication failed: ${error.message}`));
                }
            });
        } catch (error) {
            throw new Error(`Authentication error: ${error.message}`);
        }
    }

    /**
     * Check if user is authenticated with valid token
     * @returns {boolean}
     */
    isAuthenticated() {
        if (!this.accessToken || !this.tokenExpiry) {
            return false;
        }
        // Add 5-minute buffer before expiry
        return Date.now() < (this.tokenExpiry - 300000);
    }

    /**
     * Store OAuth tokens securely
     * @param {Object} tokenResponse - Token response from Google
     */
    storeTokens(tokenResponse) {
        this.accessToken = tokenResponse.access_token;
        this.refreshToken = tokenResponse.refresh_token;
        this.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);

        // Store in sessionStorage (more secure than localStorage)
        sessionStorage.setItem('youtube_access_token', this.accessToken);
        sessionStorage.setItem('youtube_refresh_token', this.refreshToken || '');
        sessionStorage.setItem('youtube_token_expiry', this.tokenExpiry.toString());
    }

    /**
     * Load stored tokens from sessionStorage
     */
    loadStoredTokens() {
        this.accessToken = sessionStorage.getItem('youtube_access_token');
        this.refreshToken = sessionStorage.getItem('youtube_refresh_token');
        const expiry = sessionStorage.getItem('youtube_token_expiry');
        this.tokenExpiry = expiry ? parseInt(expiry) : null;
    }

    /**
     * Refresh access token using refresh token
     * @returns {Promise<void>}
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    refresh_token: this.refreshToken,
                    grant_type: 'refresh_token'
                })
            });

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.statusText}`);
            }

            const tokenData = await response.json();
            this.storeTokens(tokenData);
        } catch (error) {
            throw new Error(`Token refresh error: ${error.message}`);
        }
    }

    /**
     * Revoke OAuth access
     * @returns {Promise<void>}
     */
    async revokeAccess() {
        try {
            if (this.accessToken) {
                await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });
            }

            // Clear stored tokens
            this.accessToken = null;
            this.refreshToken = null;
            this.tokenExpiry = null;
            sessionStorage.removeItem('youtube_access_token');
            sessionStorage.removeItem('youtube_refresh_token');
            sessionStorage.removeItem('youtube_token_expiry');
        } catch (error) {
            throw new Error(`Revoke access error: ${error.message}`);
        }
    }

    /**
     * Get authenticated user information
     * @returns {Promise<Object>} User info object
     */
    async getUserInfo() {
        await this.ensureValidToken();

        try {
            const response = await fetch(`${YOUTUBE_API_BASE}/channels?part=snippet&mine=true`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get user info: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const channel = data.items[0];
                return {
                    id: channel.id,
                    title: channel.snippet.title,
                    description: channel.snippet.description,
                    publishedAt: channel.snippet.publishedAt,
                    thumbnailUrl: channel.snippet.thumbnails.default.url
                };
            }
            throw new Error('No channel information found');
        } catch (error) {
            throw new Error(`Get user info error: ${error.message}`);
        }
    }

    /**
     * Ensure we have a valid access token, refresh if necessary
     * @returns {Promise<void>}
     */
    async ensureValidToken() {
        if (!this.isAuthenticated()) {
            this.loadStoredTokens();
            if (!this.isAuthenticated()) {
                await this.authenticate();
                return;
            }
        }

        // If token is close to expiry, try to refresh
        if (this.tokenExpiry && Date.now() > (this.tokenExpiry - 600000)) { // 10 minutes before expiry
            try {
                await this.refreshAccessToken();
            } catch (error) {
                // If refresh fails, re-authenticate
                await this.authenticate();
            }
        }
    }

    /**
     * Make authenticated API request with rate limiting
     * @param {string} url - API endpoint URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>}
     */
    async makeAuthenticatedRequest(url, options = {}) {
        await this.rateLimiter.waitForSlot();
        await this.ensureValidToken();

        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Accept': 'application/json',
                ...options.headers
            }
        };

        const response = await fetch(url, { ...options, ...defaultOptions });

        if (response.status === 401) {
            // Token might be invalid, try refreshing
            try {
                await this.refreshAccessToken();
                defaultOptions.headers.Authorization = `Bearer ${this.accessToken}`;
                return fetch(url, { ...options, ...defaultOptions });
            } catch (refreshError) {
                throw new Error('Authentication failed - please re-authenticate');
            }
        }

        return response;
    }

    /**
     * Upload video to YouTube with resumable upload protocol
     * @param {Blob} videoBlob - Video file to upload
     * @param {string} title - Video title
     * @param {string} description - Video description
     * @param {Function} onProgress - Progress callback function
     * @returns {Promise<string>} Video ID
     */
    async uploadToYouTube(videoBlob, title, description, onProgress = null) {
        await this.ensureValidToken();

        try {
            // Step 1: Initialize resumable upload
            const initResponse = await this.makeAuthenticatedRequest(
                `${YOUTUBE_API_BASE}/videos?uploadType=resumable&part=snippet,status`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-Upload-Content-Length': videoBlob.size.toString(),
                        'X-Upload-Content-Type': videoBlob.type || 'video/mp4'
                    },
                    body: JSON.stringify({
                        snippet: {
                            title: title,
                            description: description,
                            categoryId: '22' // People & Blogs
                        },
                        status: {
                            privacyStatus: 'private'
                        }
                    })
                }
            );

            if (!initResponse.ok) {
                const errorData = await initResponse.json().catch(() => ({}));
                throw new Error(`Upload initialization failed: ${errorData.error?.message || initResponse.statusText}`);
            }

            const uploadUrl = initResponse.headers.get('Location');
            if (!uploadUrl) {
                throw new Error('No upload URL received from YouTube');
            }

            // Step 2: Upload video in chunks
            const chunkSize = 256 * 1024; // 256KB chunks
            const totalChunks = Math.ceil(videoBlob.size / chunkSize);
            let uploadedBytes = 0;

            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, videoBlob.size);
                const chunk = videoBlob.slice(start, end);

                const response = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Length': chunk.size.toString(),
                        'Content-Range': `bytes ${start}-${end - 1}/${videoBlob.size}`
                    },
                    body: chunk
                });

                if (!response.ok && response.status !== 308) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`Upload chunk failed: ${errorData.error?.message || response.statusText}`);
                }

                uploadedBytes = end;

                if (onProgress) {
                    onProgress({
                        loaded: uploadedBytes,
                        total: videoBlob.size,
                        progress: (uploadedBytes / videoBlob.size) * 100
                    });
                }
            }

            // Step 3: Get video ID from final response
            const finalResponse = await fetch(uploadUrl);
            if (!finalResponse.ok) {
                throw new Error('Failed to get upload completion response');
            }

            const videoData = await finalResponse.json();
            return videoData.id;

        } catch (error) {
            throw new Error(`Upload error: ${error.message}`);
        }
    }

    /**
     * Download video from YouTube
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<Blob>} Downloaded video blob
     */
    async downloadFromYouTube(videoId) {
        try {
            // Get video streams info
            const streamsResponse = await fetch(`https://www.youtube.com/get_video_info?video_id=${videoId}`);
            if (!streamsResponse.ok) {
                throw new Error('Failed to get video streams information');
            }

            const streamsData = await streamsResponse.text();
            const streamsParams = new URLSearchParams(streamsData);

            if (streamsParams.get('status') === 'fail') {
                throw new Error(`Video unavailable: ${streamsParams.get('reason')}`);
            }

            // Parse adaptive formats
            const adaptiveFormats = JSON.parse(decodeURIComponent(streamsParams.get('adaptive_fmts') || '[]'));

            // Find best MP4 format
            const mp4Format = adaptiveFormats
                .filter(format => format.type && format.type.includes('video/mp4'))
                .sort((a, b) => parseInt(b.bitrate || 0) - parseInt(a.bitrate || 0))[0];

            if (!mp4Format || !mp4Format.url) {
                throw new Error('No suitable video format found');
            }

            // Download the video
            const videoResponse = await fetch(decodeURIComponent(mp4Format.url));
            if (!videoResponse.ok) {
                throw new Error(`Failed to download video: ${videoResponse.statusText}`);
            }

            return await videoResponse.blob();

        } catch (error) {
            throw new Error(`Download error: ${error.message}`);
        }
    }

    /**
     * Get video metadata from YouTube
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<Object>} Video metadata
     */
    async getVideoMetadata(videoId) {
        await this.ensureValidToken();

        try {
            const response = await this.makeAuthenticatedRequest(
                `${YOUTUBE_API_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoId}`
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to get metadata: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            if (!data.items || data.items.length === 0) {
                throw new Error('Video not found or not accessible');
            }

            const video = data.items[0];
            const snippet = video.snippet;
            const statistics = video.statistics;
            const contentDetails = video.contentDetails;

            return {
                id: video.id,
                title: snippet.title,
                description: snippet.description,
                publishedAt: snippet.publishedAt,
                channelTitle: snippet.channelTitle,
                duration: this.parseDuration(contentDetails.duration),
                viewCount: parseInt(statistics.viewCount || 0),
                likeCount: parseInt(statistics.likeCount || 0),
                dislikeCount: parseInt(statistics.dislikeCount || 0),
                commentCount: parseInt(statistics.commentCount || 0),
                thumbnailUrl: snippet.thumbnails.medium?.url || snippet.thumbnails.default?.url
            };

        } catch (error) {
            throw new Error(`Get metadata error: ${error.message}`);
        }
    }

    /**
     * Search for videos on YouTube
     * @param {string} query - Search query
     * @param {number} maxResults - Maximum number of results (default: 10)
     * @returns {Promise<Array>} Array of video results
     */
    async searchVideos(query, maxResults = 10) {
        await this.ensureValidToken();

        try {
            const response = await this.makeAuthenticatedRequest(
                `${YOUTUBE_API_BASE}/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}&forMine=true`
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Search failed: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return data.items.map(item => ({
                id: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                publishedAt: item.snippet.publishedAt,
                channelTitle: item.snippet.channelTitle,
                thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
            }));

        } catch (error) {
            throw new Error(`Search error: ${error.message}`);
        }
    }

    /**
     * Parse ISO 8601 duration to seconds
     * @param {string} duration - ISO 8601 duration string
     * @returns {number} Duration in seconds
     */
    parseDuration(duration) {
        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        if (!match) return 0;

        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);

        return hours * 3600 + minutes * 60 + seconds;
    }
}

/**
 * Rate Limiter for YouTube API requests
 * YouTube Data API v3 has quota limits
 */
class RateLimiter {
    constructor() {
        this.requests = [];
        this.quotaLimit = 10000; // Daily quota limit
        this.quotaUsed = 0;
        this.quotaResetTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    }

    /**
     * Wait for available quota slot
     * @returns {Promise<void>}
     */
    async waitForSlot() {
        // Reset quota if needed
        if (Date.now() > this.quotaResetTime.getTime()) {
            this.quotaUsed = 0;
            this.quotaResetTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }

        if (this.quotaUsed >= this.quotaLimit) {
            const waitTime = this.quotaResetTime.getTime() - Date.now();
            throw new Error(`YouTube API quota exceeded. Try again in ${Math.ceil(waitTime / 60000)} minutes.`);
        }

        // Simple rate limiting: max 1 request per second
        const now = Date.now();
        const lastRequest = this.requests[this.requests.length - 1];
        if (lastRequest && now - lastRequest < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - (now - lastRequest)));
        }

        this.requests.push(now);
        this.quotaUsed += 1;

        // Keep only last 60 requests for rate limiting
        if (this.requests.length > 60) {
            this.requests.shift();
        }
    }
}

// Initialize platform manager
export const youtubePlatform = new PlatformManager();
