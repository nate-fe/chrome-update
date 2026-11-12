// 네이트온 팀룸 인커밍 웹훅으로 메시지를 보낸다 (form 형식 POST, 메시지는 content 필드)
// 네이트 점검 알림(audit/notify.ts)과 새 버전 PR 알림(pipeline/notify-pr.ts)이 함께 쓴다.

export async function sendTeamroom(text: string): Promise<void> {
  const url = process.env.TEAMROOM_WEBHOOK_URL;
  if (!url) throw new Error('TEAMROOM_WEBHOOK_URL이 없습니다');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: new URLSearchParams({ content: text }),
  });
  if (!res.ok) throw new Error(`팀룸 전송 실패: ${res.status} ${(await res.text()).slice(0, 200)}`);
  console.log('팀룸으로 보냄');
}
