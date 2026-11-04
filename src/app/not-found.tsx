import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="doc">
      <p className="comment">{'// error: ENOENT'}</p>
      <h1 className="title">404 — 파일을 찾을 수 없습니다</h1>
      <p className="lede">
        아직 정리되지 않은 버전이거나 주소가 잘못되었습니다. <Link href="/">README로 돌아가기</Link>
      </p>
    </div>
  );
}
