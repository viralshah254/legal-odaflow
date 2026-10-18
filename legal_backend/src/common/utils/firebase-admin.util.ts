import * as fs from 'fs';
import * as path from 'path';

export interface FirebaseServiceAccountConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function readServiceAccountFile(filePath: string): FirebaseServiceAccountConfig | null {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolved)) {
    return null;
  }

  const json = JSON.parse(fs.readFileSync(resolved, 'utf8')) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  const projectId = json.project_id?.trim();
  const clientEmail = json.client_email?.trim();
  const privateKey = json.private_key?.trim();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

export function resolveFirebaseServiceAccount(
  env: NodeJS.ProcessEnv = process.env,
): FirebaseServiceAccountConfig | null {
  const filePath = env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (filePath) {
    const fromFile = readServiceAccountFile(filePath);
    if (fromFile) {
      return fromFile;
    }
  }

  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

export async function getFirebaseAdminApp(): Promise<import('firebase-admin').app.App | null> {
  const config = resolveFirebaseServiceAccount();
  if (!config) {
    return null;
  }

  const admin = await import('firebase-admin');

  if (!admin.apps.length) {
    return admin.initializeApp({
      credential: admin.credential.cert(config),
    });
  }

  return admin.app();
}
