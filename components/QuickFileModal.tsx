'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileText, RefreshCw, Save, Upload, X } from 'lucide-react';
import type { Section, SharedFile } from '@/lib/types';
import { FormattedTime } from './FormattedTime';

interface QuickFileModalProps {
  file: SharedFile | null;
  sections: Section[];
  defaultFolder?: string;
  onClose: () => void;
  onSaveFile: (payload: {
    id?: string;
    name: string;
    folder: string;
    content: string;
  }) => Promise<{ ok: boolean; error?: string; file?: SharedFile }>;
}

export function QuickFileModal({
  file,
  sections,
  defaultFolder,
  onClose,
  onSaveFile,
}: QuickFileModalProps) {
  const [draftName, setDraftName] = useState(file?.name ?? '');
  const [draftFolder, setDraftFolder] = useState(file?.folder ?? defaultFolder ?? 'General');
  const [draftContent, setDraftContent] = useState(file?.content ?? '');
  const [baseRevision, setBaseRevision] = useState(file?.revision ?? 0);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = file && !dirty ? file.name : draftName;
  const folder = file && !dirty ? file.folder : draftFolder;
  const content = file && !dirty ? file.content : draftContent;
  const hasRemoteUpdate = Boolean(file && dirty && file.revision > baseRevision);

  function updateDraft(patch: { name?: string; folder?: string; content?: string }) {
    if (!dirty) {
      setBaseRevision(file?.revision ?? 0);
      setDraftName(patch.name ?? name);
      setDraftFolder(patch.folder ?? folder);
      setDraftContent(patch.content ?? content);
      setDirty(true);
      return;
    }
    if (patch.name !== undefined) setDraftName(patch.name);
    if (patch.folder !== undefined) setDraftFolder(patch.folder);
    if (patch.content !== undefined) setDraftContent(patch.content);
  }

  function loadLatestFromRemote() {
    if (!file) return;
    setDraftName(file.name);
    setDraftFolder(file.folder);
    setDraftContent(file.content);
    setBaseRevision(file.revision);
    setDirty(false);
    setError(null);
  }

  async function handleUploadText(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const text = await selected.text();
    updateDraft({
      name: !name.trim() ? selected.name : name,
      content: text,
    });
    e.target.value = '';
  }

  function handleDownloadFile() {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.trim() || 'shared-file.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await onSaveFile({
      id: file?.id,
      name,
      folder,
      content,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Failed to save file.');
      return;
    }
    if (res.file) {
      setBaseRevision(res.file.revision);
    }
    setDirty(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-file-modal-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
            <h2 id="quick-file-modal-title" className="text-sm font-semibold text-slate-900 truncate">
              {file ? `Quick Edit · ${file.name}` : 'Create Shared File'}
            </h2>
            {file && (
              <span className="font-mono text-[11px] text-slate-500 shrink-0">
                rev {file.revision}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close file editor"
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {hasRemoteUpdate && file && (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md flex items-center justify-between gap-2 text-xs text-amber-900">
              <span>
                Updated by <strong>{file.updatedBy}</strong> (rev {file.revision}) while you were editing.
              </span>
              <button
                type="button"
                onClick={loadLatestFromRemote}
                className="inline-flex items-center gap-1 px-2 py-1 font-medium bg-white border border-amber-300 rounded hover:bg-amber-100 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                Load Latest
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-file-name" className="block text-xs font-medium text-slate-700 mb-1">
                File Name
              </label>
              <input
                id="quick-file-name"
                type="text"
                required
                value={name}
                onChange={(e) => updateDraft({ name: e.target.value })}
                placeholder="e.g. shift-notes.txt"
                className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="quick-file-folder" className="block text-xs font-medium text-slate-700 mb-1">
                Section / Folder
              </label>
              <select
                id="quick-file-folder"
                value={folder}
                onChange={(e) => updateDraft({ folder: e.target.value })}
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="General">General (All Warehouse)</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="quick-file-content" className="text-xs font-medium text-slate-700">
                File Content
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={uploadRef}
                  type="file"
                  accept=".txt,.md,.csv,.json,.log,text/plain"
                  onChange={handleUploadText}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => uploadRef.current?.click()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  Load from disk
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
            </div>
            <textarea
              id="quick-file-content"
              rows={10}
              value={content}
              onChange={(e) => updateDraft({ content: e.target.value })}
              placeholder="Write instructions, stock count notes, handover logs, or paste text..."
              className="w-full p-3 text-xs font-mono leading-relaxed bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          {file && (
            <div className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>
                Last saved by <strong className="text-slate-700">{file.updatedBy}</strong>
              </span>
              <span className="font-mono tabular-nums">
                <FormattedTime iso={file.updatedAt} mode="datetime" />
              </span>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-2">
              {error}
            </p>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              {dirty ? 'Unsaved changes · Saves sync to all user accounts' : 'Synced across all user accounts'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                {submitting ? 'Saving...' : 'Save & Sync'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
