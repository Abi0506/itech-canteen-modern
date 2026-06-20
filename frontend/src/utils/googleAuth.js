const GOOGLE_SCRIPT_ID = 'google-identity-services';

export function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
}

export function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google sign-in script.')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google sign-in script.'));
    document.head.appendChild(script);
  });
}

export async function getGoogleCredential() {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID.');
  }

  await loadGoogleIdentityScript();

  return new Promise((resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response?.credential) {
          resolve(response.credential);
          return;
        }
        reject(new Error('Google sign-in did not return a credential.'));
      },
    });

    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(new Error('Google sign-in popup was blocked or dismissed.'));
      }
    });
  });
}