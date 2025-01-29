// Firebase Configuration
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-bucket.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Modified UI Button with Google Integration
const cloudSyncBtn = document.createElement('button');
cloudSyncBtn.className = "google-auth-btn flex items-center bg-white text-gray-700 px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all";
cloudSyncBtn.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" class="mr-2">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
  Sign in with Google
`;

// Updated Modal Interface
function openSyncModal() {
  const existingModal = document.querySelector('div[data-element-id="sync-modal-gcs"]');
  if (existingModal) return;

  const modalPopup = document.createElement('div');
  modalPopup.className = "gcs-sync-modal fixed inset-0 bg-black/50 flex items-center justify-center z-[999]";
  modalPopup.innerHTML = `
    <div class="bg-white dark:bg-zinc-800 rounded-lg p-6 w-96 relative">
      <h3 class="text-xl font-bold mb-4 dark:text-white">Google Cloud Sync</h3>
      
      <div id="auth-status" class="mb-4">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center" id="user-avatar"></div>
          <span class="text-sm font-medium dark:text-gray-200" id="user-email"></span>
        </div>
      </div>

      <div class="space-y-4">
        <button id="google-signin-btn" class="w-full google-auth-btn">
          Sign in with Google
        </button>

        <div class="backup-controls hidden">
          <div class="border-t pt-4 mt-4">
            <button id="manual-backup-btn" class="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
              Create Immediate Backup
            </button>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button id="restore-btn" class="bg-green-600 text-white py-2 rounded-md hover:bg-green-700">
                Restore Data
              </button>
              <button id="manage-backups-btn" class="bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700">
                Manage Backups
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalPopup);
  initializeAuthHandlers();
}

// Authentication State Management
function initializeAuthHandlers() {
  const auth = firebase.auth();
  
  auth.onAuthStateChanged(user => {
    const authStatus = document.getElementById('auth-status');
    const backupControls = document.querySelector('.backup-controls');
    const signinBtn = document.getElementById('google-signin-btn');

    if (user) {
      document.getElementById('user-email').textContent = user.email;
      document.getElementById('user-avatar').innerHTML = `
        <img src="${user.photoURL}" class="w-8 h-8 rounded-full" alt="User avatar">
      `;
      backupControls.classList.remove('hidden');
      signinBtn.classList.add('hidden');
    } else {
      backupControls.classList.add('hidden');
      signinBtn.classList.remove('hidden');
    }
  });

  document.getElementById('google-signin-btn').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/cloud-platform');
    firebase.auth().signInWithPopup(provider);
  });
}

// Secure Backup Operations
async function performBackup() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('User not authenticated');

  const backupData = await encryptData(localStorage);
  const timestamp = new Date().toISOString().replace(/[:.]/g,'-');
  
  try {
    const storageRef = firebase.storage().ref();
    const backupRef = storageRef.child(`backups/${user.uid}/${timestamp}.enc`);
    await backupRef.put(backupData);
    await backupRef.updateMetadata({ customMetadata: { encrypted: 'true' }});
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
}

// Data Encryption Layer
async function encryptData(data) {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode('user-specific-secret'),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(16), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );

  return new Blob([iv, new Uint8Array(encrypted)], { type: 'application/octet-stream' });
}
