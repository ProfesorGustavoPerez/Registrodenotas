import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App & Auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Drive access to files created by this app
provider.addScope("https://www.googleapis.com/auth/drive.file");

// In-memory token representation
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Subscribe/listen to changes in login state
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // Since Firebase Token might need renewal or refresh in popup, but we cached it on login,
        // if user is already signed-in but token is lost (e.g. page refresh), they can sign-in again.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("No se pudo obtener el token de acceso de Google.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Error de inicio de sesión con Google:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Logout from Google
export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Fetch current loaded access token
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Save token after restoring session manually
export const setAccessToken = (token: string) => {
  cachedAccessToken = token;
};

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
}

// Find or create the directory "Registro de Notas"
export const getOrCreateFolder = async (token: string, folderName: string = "Registro de Notas"): Promise<string> => {
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  
  const searchResponse = await fetch(searchUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!searchResponse.ok) {
    const errText = await searchResponse.text();
    throw new Error(`Error buscando carpeta: ${searchResponse.statusText} (${errText})`);
  }

  const searchData = await searchResponse.json();
  const files = searchData.files || [];
  
  if (files.length > 0) {
    return files[0].id;
  }

  // Create the folder if it does not exist
  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder"
    })
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    throw new Error(`Error creando carpeta: ${createResponse.statusText} (${errText})`);
  }

  const createData = await createResponse.json();
  return createData.id;
};

// List all backup files in Google Drive matching our app's pattern in "Registro de Notas" folder
export const listDriveBackups = async (token: string): Promise<DriveBackupFile[]> => {
  let folderId = "";
  try {
    folderId = await getOrCreateFolder(token, "Registro de Notas");
  } catch (err) {
    console.warn("No se pudo obtener o crear la carpeta 'Registro de Notas', buscando en todo Drive:", err);
  }

  let query = "mimeType = 'application/json' and name contains 'Registro_Backup' and trashed = false";
  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,modifiedTime)&orderBy=modifiedTime desc`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error listando respaldos: ${response.statusText} (${errText})`);
  }

  const data = await response.json();
  return data.files || [];
};

// Upload a backup file to Google Drive (creates a new file in "Registro de Notas" folder)
export const uploadDriveBackup = async (
  token: string,
  filename: string,
  content: any
): Promise<DriveBackupFile> => {
  let folderId = "";
  try {
    folderId = await getOrCreateFolder(token, "Registro de Notas");
  } catch (err) {
    console.warn("No se pudo obtener o crear la carpeta 'Registro de Notas', guardando en la raíz:", err);
  }

  const boundary = "ciencias_master_pro_drive_boundary";
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: filename,
    mimeType: "application/json"
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const body = `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(content)}\r\n` +
    `--${boundary}--`;

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error subiendo respaldo: ${response.statusText} (${errText})`);
  }

  return response.json();
};

// Overwrite existing backup file in Google Drive
export const updateDriveBackup = async (
  token: string,
  fileId: string,
  content: any
): Promise<void> => {
  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(content)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error actualizando respaldo: ${response.statusText} (${errText})`);
  }
};

// Download backup file contents from Google Drive
export const downloadDriveBackup = async (token: string, fileId: string): Promise<any> => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error descargando respaldo: ${response.statusText} (${errText})`);
  }

  return response.json();
};

// Delete backup file from Google Drive
export const deleteDriveBackup = async (token: string, fileId: string): Promise<void> => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error eliminando de Drive: ${response.statusText} (${errText})`);
  }
};
