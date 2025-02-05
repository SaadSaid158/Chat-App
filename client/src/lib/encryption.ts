export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );
  const privateKey = await window.crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey
  );

  return {
    publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
    privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKey))),
  };
}

export async function encryptMessage(publicKeyStr: string, message: string) {
  const publicKey = await window.crypto.subtle.importKey(
    "spki",
    Uint8Array.from(atob(publicKeyStr), c => c.charCodeAt(0)),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    new TextEncoder().encode(message)
  );

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

export async function decryptMessage(privateKeyStr: string, encryptedMessage: string) {
  const privateKey = await window.crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(privateKeyStr), c => c.charCodeAt(0)),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    Uint8Array.from(atob(encryptedMessage), c => c.charCodeAt(0))
  );

  return new TextDecoder().decode(decrypted);
}
