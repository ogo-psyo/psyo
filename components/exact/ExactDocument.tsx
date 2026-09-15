'use client';
/* eslint-disable @next/next/no-img-element -- Private document blob URLs are rendered locally, never sent through an image proxy. */
import { useEffect, useEffectEvent, useState } from 'react';
import { ExactPage } from './ExactShell';
type Document = { id: string; title: string; originalName: string; createdAt: string };
export function ExactDocument({ document, dogName, headers, onBack, onDiscuss, onDelete, deleting, deleteError }: { document: Document; dogName: string; headers: () => Record<string, string>; onBack: () => void; onDiscuss: () => void; onDelete: () => void; deleting: boolean; deleteError?: string }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [file, setFile] = useState<{ url: string; type: string } | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const read = useEffectEvent((signal: AbortSignal) => fetch(`/api/documents/${encodeURIComponent(document.id)}`, { headers: headers(), signal }));
  useEffect(() => {
    const controller = new AbortController(); let objectUrl: string | undefined;
    read(controller.signal).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? 'NOT_FOUND' : 'OPEN_FAILED');
      const blob = await response.blob(); if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(blob.type)) throw new Error('UNSUPPORTED_FILE');
      if (controller.signal.aborted) return; objectUrl = URL.createObjectURL(blob); setFile({ url: objectUrl, type: blob.type });
    }).catch(error => { if (!controller.signal.aborted) setError(error.message === 'NOT_FOUND' ? 'Документ больше недоступен.' : 'Не удалось открыть документ. Попробуй ещё раз.'); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [document.id, revision]);
  return <ExactPage viewKey={`document:${document.id}`} onBack={onBack}>
    <p className="eyebrow">{new Date(document.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {dogName}</p><h1>{document.title}</h1>
    <article className="document-paper">
      {!file && !error && <p role="status">Открываю документ…</p>}
      {error && <><p className="error" role="alert">{error}</p><button type="button" className="secondary" onClick={() => { setError(''); setFile(null); setRevision(value => value + 1); }}>Повторить</button></>}
      {file && (file.type.startsWith('image/') ? <img className="exact-document-image" src={file.url} alt={document.title} /> : <object className="exact-document-pdf" data={file.url} type="application/pdf" aria-label={document.title}><a href={file.url} target="_blank" rel="noreferrer">Открыть PDF</a></object>)}
    </article>
    <div className="row-actions"><button type="button" className="secondary" onClick={onDiscuss}>Обсудить с Псё</button><button type="button" className="secondary" onClick={onBack}>Все документы</button></div>
    {confirmDelete ? <div className="section-gap"><p>Удалить «{document.title}»? Файл нельзя будет восстановить.</p><div className="row-actions"><button type="button" className="secondary" disabled={deleting} onClick={onDelete}>{deleting?'Удаляю…':'Удалить документ'}</button><button type="button" className="secondary" disabled={deleting} onClick={()=>setConfirmDelete(false)}>Оставить</button></div>{deleteError && <p className="error" role="alert">{deleteError}</p>}</div> : <button type="button" className="text-button" onClick={()=>setConfirmDelete(true)}>Удалить документ</button>}
    {file && <a className="text-button" href={file.url} download={document.originalName || document.title}>Скачать файл</a>}
  </ExactPage>;
}
