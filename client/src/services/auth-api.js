const API_URL = import.meta.env.VITE_API_URL;

export const verifyGoogleToken = async (credential, mac) => {
  const response = await fetch(`${API_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Send MAC to server
    body: JSON.stringify({ token: credential, mac }), 
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Server auth failed');
  }
  return await response.json();
};