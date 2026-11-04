'use client';

import Link from 'next/link';
import { useState } from 'react';
import { tokenize } from '@/lib/code';
import type { Lang } from '@/lib/schema';

export type QuizQuestion = { slug: string; title: string; code: string; lang: Lang; answer: number; options: number[] };

/** F16: "몇 버전부터?" — 코드 조각이 어느 버전부터 동작하는지 맞히기 */
export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [picked, setPicked] = useState<Record<string, number>>({});
  const answered = Object.keys(picked).length;
  const correct = questions.filter((q) => picked[q.slug] === q.answer).length;

  return (
    <section className="panel">
      <div className="panel-head">
        <span>$ quiz --since</span>
        <span className="right">
          {answered === questions.length ? `결과 ${correct}/${questions.length}` : `${answered}/${questions.length} 답함`}
        </span>
      </div>
      <div className="panel-body">
        {questions.map((q, i) => {
          const p = picked[q.slug];
          return (
            <div key={q.slug} className="quiz-q">
              <div className="mono muted" style={{ fontSize: 12 }}>
                Q{i + 1}. 이 코드는 Chrome 몇 버전부터 동작할까요?
              </div>
              <pre className="mono" style={{ margin: '8px 0 0', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                {tokenize(q.code, q.lang).map((t, k) =>
                  t.c ? (
                    <span key={k} className={`hl-${t.c}`}>
                      {t.t}
                    </span>
                  ) : (
                    t.t
                  ),
                )}
              </pre>
              <div className="quiz-opts">
                {q.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`quiz-opt ${p !== undefined && o === q.answer ? 'right' : ''} ${p === o && o !== q.answer ? 'wrong' : ''}`}
                    disabled={p !== undefined}
                    onClick={() => setPicked((s) => ({ ...s, [q.slug]: o }))}
                  >
                    {o}
                  </button>
                ))}
              </div>
              {p !== undefined && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  {p === q.answer ? '✓ 정답!' : `✗ 정답은 ${q.answer}`} ·{' '}
                  <Link href={`/features/${q.slug}`}>{q.title.replace(/`/g, '')} 자세히</Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
