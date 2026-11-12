// 정적 CSS·JS 파일 하나를 받아 글자로 바꾼다. 페이지를 열지 않고 스크립트도 실행하지 않는다.
// 검사(scan.ts)와 Claude에게 넘길 앞뒤 코드(fixes.ts)가 함께 쓴다.

/** 대부분 UTF-8이지만 오래된 파일은 EUC-KR일 수 있다 */
export function decode(buf: ArrayBuffer, contentType: string): string {
  const declared = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (declared) {
    try {
      return new TextDecoder(declared).decode(buf);
    } catch {
      // 모르는 이름이면 아래에서 추측
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

export async function download(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'chrome-update-audit (static file check)' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return decode(await res.arrayBuffer(), res.headers.get('content-type') ?? '');
    } catch (e) {
      if (attempt >= 1 || /HTTP 4\d\d/.test((e as Error).message)) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
