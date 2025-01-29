// Add You.com credentials UI to TypingMind settings
function addYouCredentialsSection() {
    const settingsPanel = document.querySelector('.settings-container');
    if (!settingsPanel || document.getElementById('youcom-credentials')) return;

    const credentialsHTML = `
        <div class="settings-section" id="youcom-credentials">
            <h3 class="text-lg font-semibold mb-3">You.com Integration</h3>
            <div class="space-y-4">
                <div class="input-group">
                    <label>You.com Email</label>
                    <input type="email" id="youcom-email" 
                           class="settings-input"
                           placeholder="user@example.com"
                           autocomplete="username">
                </div>
                <div class="input-group">
                    <label>You.com Password</label>
                    <input type="password" id="youcom-password"
                           class="settings-input"
                           placeholder="••••••••"
                           autocomplete="current-password">
                </div>
                <button id="save-youcom-creds" 
                        class="btn-primary"
                        style="background-color: #4285f4;">
                    Save Credentials
                </button>
            </div>
        </div>
    `;

    settingsPanel.insertAdjacentHTML('beforeend', credentialsHTML);
}

// Encrypt credentials using Web Crypto API
async function encryptCredentials(email, password) {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode('tym-secret-salt'),
        'AES-GCM',
        false,
        ['encrypt', 'decrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encoder.encode(JSON.stringify({ email, password }))
    );
    
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}

// Handle credential saving
document.addEventListener('click', async (e) => {
    if (e.target.matches('#save-youcom-creds')) {
        const email = document.getElementById('youcom-email').value;
        const password = document.getElementById('youcom-password').value;
        
        try {
            const encrypted = await encryptCredentials(email, password);
            localStorage.setItem('youcom_creds', JSON.stringify(encrypted));
            showToast('Credentials saved securely!', 'success');
        } catch (error) {
            showToast('Failed to save credentials', 'error');
        }
    }
});

// Add You.com as model option
function injectYouModelOption() {
    const modelSelector = document.querySelector('.model-selector');
    if (!modelSelector || modelSelector.querySelector('#youcom-option')) return;

    const option = document.createElement('div');
    option.className = 'model-option';
    option.id = 'youcom-option';
    option.innerHTML = `
        <div class="flex items-center">
            <div class="w-7 h-7 bg-[#4285f4] rounded-full flex items-center justify-center mr-3">
                <span class="text-white text-lg">Y</span>
            </div>
            <span>You.com Integration</span>
        </div>
    `;
    
    modelSelector.appendChild(option);
}

// Handle You.com authentication
let youSessionToken = null;

async function authenticateWithYou() {
    const encrypted = localStorage.getItem('youcom_creds');
    if (!encrypted) throw new Error('No credentials stored');

    const { iv, data } = JSON.parse(encrypted);
    const decoder = new TextDecoder();
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode('tym-secret-salt'),
        'AES-GCM',
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        cryptoKey,
        new Uint8Array(data)
    );

    const { email, password } = JSON.parse(decoder.decode(decrypted));
    
    try {
        const response = await fetch('https://you.com/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) throw new Error('Authentication failed');
        return response.headers.getSetCookie()[0];
    } catch (error) {
        showToast('Failed to authenticate with You.com', 'error');
        throw error;
    }
}

// Modified message handler
function wrapChatHandler() {
    const originalHandler = window.TypingMindApp.handleMessage;
    
    window.TypingMindApp.handleMessage = async function(message) {
        if (this.selectedModel === 'youcom') {
            if (!youSessionToken) {
                youSessionToken = await authenticateWithYou();
            }
            
            const response = await fetch('https://you.com/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': youSessionToken
                },
                body: JSON.stringify({
                    message,
                    context: this.conversationHistory
                })
            });

            // Process You.com response
            const result = await response.json();
            this.displayResponse(result.text);
        } else {
            originalHandler.call(this, message);
        }
    }
}

// Initialize integration
function initYouIntegration() {
    addYouCredentialsSection();
    injectYouModelOption();
    wrapChatHandler();
}

// Wait for TypingMind to initialize
const observer = new MutationObserver(mutations => {
    if (document.querySelector('.model-selector')) {
        observer.disconnect();
        initYouIntegration();
    }
});


observer.observe(document.body, {
    childList: true,
    subtree: true
});
