export const BASE_URL = 'https://prop-backend-worker.sharifgptxacc.workers.dev';

export async function startLogin(telegramId: string, phone: string): Promise<string> {
  const resp = await fetch(`${BASE_URL}/api/avatars/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramId, phone }),
  });
  if (!resp.ok) throw new Error('Failed to start login');
  const data = await resp.json();
  return data.loginId as string;
}

export async function verifyLogin(
  loginId: string,
  code: string,
  password?: string,
): Promise<string> {
  const payload: any = { loginId, code };
  if (password) payload.password = password;

  const resp = await fetch(`${BASE_URL}/api/avatars/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    try {
      const err = await resp.json();
      throw new Error(err.error || 'Failed to verify login');
    } catch {
      throw new Error('Failed to verify login');
    }
  }
  const data = await resp.json();
  return data.avatarId as string;
}

export async function listAvatars(telegramId: string): Promise<string[]> {
  const resp = await fetch(`${BASE_URL}/api/avatars?telegramId=${encodeURIComponent(telegramId)}`);
  if (!resp.ok) throw new Error('Failed to list avatars');
  const data = await resp.json();
  return data.avatarIds as string[];
}

export async function getAvatar(avatarId: string): Promise<{ telegramId: string }> {
  const resp = await fetch(`${BASE_URL}/api/avatar?avatarId=${encodeURIComponent(avatarId)}`);
  if (!resp.ok) throw new Error('Failed to get avatar');
  const data = await resp.json();
  return { telegramId: data.telegramId as string };

}

const COVER_TTL = 168 * 60 * 60 * 1000; // 168 hours
const COVER_PREFIX = 'group-cover-cache-';
const pending: Record<string, Promise<void>> = {};

export function getGroupCoverUrl(groupId: string): string {
  if (typeof window !== 'undefined') {
    const key = `${COVER_PREFIX}${groupId}`;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && Date.now() - cached.ts < COVER_TTL && cached.data) {
        return cached.data as string;
      }
    } catch {
      /* ignore */
    }

    const url = `${BASE_URL}/api/group-cover?groupId=${encodeURIComponent(groupId)}`;

    if (!pending[groupId]) {
      pending[groupId] = fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error('failed');
          return res.blob();
        })
        .then((blob) =>
          new Promise<string>((resolve) => {
            const fr = new FileReader();
            fr.onloadend = () => resolve(fr.result as string);
            fr.readAsDataURL(blob);
          })
        )
        .then((dataUrl) => {
          try {
            localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: dataUrl }));
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          /* ignore */
        })
        .finally(() => {
          delete pending[groupId];
        });
    }

    return url;
  }

  return `${BASE_URL}/api/group-cover?groupId=${encodeURIComponent(groupId)}`;
}
