/** Talks to the Firebase emulators over their REST APIs.
 *
 *  Seeding through REST rather than the client SDK keeps the setup path
 *  independent of the code under test: a bug in jobService can fail a test
 *  without also corrupting the fixture that was supposed to expose it.
 *
 *  Every call here is emulator-only. `assertEmulatorsReachable` is the guard
 *  that keeps it that way — see e2e/global-setup.ts. */

export const E2E_PROJECT_ID = process.env.E2E_FIREBASE_PROJECT ?? 'g3d-pipeline-e2e';
export const AUTH_EMULATOR = `http://127.0.0.1:${process.env.E2E_AUTH_PORT ?? 9099}`;
export const FIRESTORE_EMULATOR = `http://127.0.0.1:${process.env.E2E_FIRESTORE_PORT ?? 8080}`;

const DOCUMENTS = `${FIRESTORE_EMULATOR}/v1/projects/${E2E_PROJECT_ID}/databases/(default)/documents`;

/** The emulator accepts this in place of a real service-account token. */
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

export type FirestoreValue =
  | string
  | number
  | boolean
  | null
  | Date
  | FirestoreValue[]
  | { [key: string]: FirestoreValue };

/** JS value → Firestore REST `Value`. Integers and doubles are distinguished
 *  because the app reads `quantity` with `typeof === 'number'` but the rules
 *  and the Flutter client both expect integers. */
function encode(value: FirestoreValue): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encode) } };
  }
  switch (typeof value) {
    case 'string':
      return { stringValue: value };
    case 'boolean':
      return { booleanValue: value };
    case 'number':
      return Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    default:
      return {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [key, encode(nested)]),
          ),
        },
      };
  }
}

function decode(value: Record<string, unknown>): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return new Date(value.timestampValue as string);
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    const values = (value.arrayValue as { values?: Record<string, unknown>[] }).values ?? [];
    return values.map(decode);
  }
  if ('mapValue' in value) {
    const fields = (value.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([key, nested]) => [key, decode(nested)]));
  }
  return undefined;
}

async function expectOk(response: Response, what: string): Promise<Response> {
  if (!response.ok) {
    throw new Error(`${what} failed: ${response.status} ${await response.text()}`);
  }
  return response;
}

/** Refuses to touch anything unless both emulators answer on localhost. A
 *  misconfigured run aborts here instead of writing to a real project.
 *
 *  Both are polled because the two emulators open their ports at different
 *  moments: Firestore is listening well before Auth accepts requests, so a
 *  single-shot check can pass against a half-started suite. */
export async function assertEmulatorsReachable(timeoutMs = 60_000): Promise<void> {
  const probes: [string, string][] = [
    ['Auth', `${AUTH_EMULATOR}/emulator/v1/projects/${E2E_PROJECT_ID}/config`],
    ['Firestore', `${FIRESTORE_EMULATOR}/`],
  ];
  for (const [name, url] of probes) {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown = 'never attempted';
    for (;;) {
      try {
        const response = await fetch(url, { headers: OWNER });
        if (response.ok || response.status === 404) break;
        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = error;
      }
      if (Date.now() > deadline) {
        throw new Error(
          `${name} emulator is not reachable at ${url}. Start it with ` +
            `"npm run emulators" (or let Playwright start it), then re-run. ` +
            `Last error: ${String(lastError)}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

export async function clearFirestore(): Promise<void> {
  await expectOk(
    await fetch(
      `${FIRESTORE_EMULATOR}/emulator/v1/projects/${E2E_PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE', headers: OWNER },
    ),
    'Clearing Firestore',
  );
}

export async function clearAuthUsers(): Promise<void> {
  await expectOk(
    await fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${E2E_PROJECT_ID}/accounts`, {
      method: 'DELETE',
      headers: OWNER,
    }),
    'Clearing auth users',
  );
}

export interface CreatedUser {
  uid: string;
  email: string;
  password: string;
}

/** Creates the auth account only. The /users profile doc is written
 *  separately so tests can model a signed-up-but-not-approved account. */
export async function createAuthUser(
  email: string,
  password: string,
  displayName: string,
): Promise<CreatedUser> {
  const response = await expectOk(
    await fetch(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=e2e`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
    }),
    `Creating auth user ${email}`,
  );
  const body = (await response.json()) as { localId: string };
  return { uid: body.localId, email, password };
}

export async function setDocument(
  path: string,
  fields: Record<string, FirestoreValue>,
): Promise<void> {
  const segments = path.split('/');
  const documentId = segments.pop()!;
  const collection = segments.join('/');
  await expectOk(
    await fetch(`${DOCUMENTS}/${collection}?documentId=${encodeURIComponent(documentId)}`, {
      method: 'POST',
      headers: OWNER,
      body: JSON.stringify({
        fields: Object.fromEntries(Object.entries(fields).map(([key, v]) => [key, encode(v)])),
      }),
    }),
    `Writing ${path}`,
  );
}

/** Adds a document with a generated id and returns that id. */
export async function addDocument(
  collection: string,
  fields: Record<string, FirestoreValue>,
): Promise<string> {
  const response = await expectOk(
    await fetch(`${DOCUMENTS}/${collection}`, {
      method: 'POST',
      headers: OWNER,
      body: JSON.stringify({
        fields: Object.fromEntries(Object.entries(fields).map(([key, v]) => [key, encode(v)])),
      }),
    }),
    `Adding to ${collection}`,
  );
  const body = (await response.json()) as { name: string };
  return body.name.split('/').pop()!;
}

export async function getDocument(
  path: string,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${DOCUMENTS}/${path}`, { headers: OWNER });
  if (response.status === 404) return null;
  await expectOk(response, `Reading ${path}`);
  const body = (await response.json()) as { fields?: Record<string, Record<string, unknown>> };
  return Object.fromEntries(
    Object.entries(body.fields ?? {}).map(([key, value]) => [key, decode(value)]),
  );
}

export async function deleteDocument(path: string): Promise<void> {
  const response = await fetch(`${DOCUMENTS}/${path}`, { method: 'DELETE', headers: OWNER });
  if (response.status === 404) return;
  await expectOk(response, `Deleting ${path}`);
}

export async function listDocuments(
  collection: string,
): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const response = await fetch(`${DOCUMENTS}/${collection}?pageSize=300`, { headers: OWNER });
  if (response.status === 404) return [];
  await expectOk(response, `Listing ${collection}`);
  const body = (await response.json()) as {
    documents?: { name: string; fields?: Record<string, Record<string, unknown>> }[];
  };
  return (body.documents ?? []).map((document) => ({
    id: document.name.split('/').pop()!,
    data: Object.fromEntries(
      Object.entries(document.fields ?? {}).map(([key, value]) => [key, decode(value)]),
    ),
  }));
}

/** Deletes the documents in `collection` whose `name` matches exactly.
 *
 *  Exact names, never a shared prefix: cleanup hooks run per worker, so a
 *  prefix sweep from one worker would delete records another worker is still
 *  using — which shows up as a record mysteriously vanishing mid-test. */
export async function deleteByName(collection: string, name: string): Promise<void> {
  const documents = await listDocuments(collection);
  await Promise.all(
    documents
      .filter((document) => document.data.name === name)
      .map((document) => deleteDocument(`${collection}/${document.id}`)),
  );
}
