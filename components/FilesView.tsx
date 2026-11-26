'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FilePlus2,
  FileText,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Section, SharedFile } from '@/lib/types';
import { FormattedTime } from './FormattedTime';

interface FilesViewProps {
  files: SharedFile[];
  sections: Section[];
  onCreateFile: (payload: {
    name: string;
    folder: string;
    content: string;
  }) => Promise<{ ok: boolean; error?: string; file?: SharedFile }>;
  onUpdateFile: (payload: {
    id: string;
    name: string;
    folder: string;
    content: string;
  }) => Promise<{ ok: boolean; error?: string; file?: SharedFile }>;
  onDeleteFile: (file: SharedFile) => Promise<void>;
}

export const FilesView = memo(function FilesView({
  files,
  sections,
  onCreateFile,
  onUpdateFile,
  onDeleteFile,
}: FilesViewProps) {
  const [selectedId, setSelectedId] = useState<string | 'new'>(files[0]?.id ?? 'new');
  const [folderFilter, setFolderFilter] = useState<string>('ALL');

  const selectedFile = useMemo(
    () => (selectedId === 'new' ? null : files.find((f) => f.id === selectedId) ?? null),
    [files, selectedId]
  );

  const [name, setName] = useState(selectedFile?.name ?? '');
  const [folder, setFolder] = useState(selectedFile?.folder ?? 'General');
  const [content, setContent] = useState(selectedFile?.content ?? '');
  const [loadedRevision, setLoadedRevision] = useState<number>(selectedFile?.revision ?? 0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const visibleFiles = useMemo(() => {
    if (folderFilter === 'ALL') return files;
    return files.filter((f) => f.folder === folderFilter);
  }, [files, folderFilter]);

  const folderOptions = useMemo(() => {
    const set = new Set<string>(['General']);
    for (const s of sections) set.add(s.code);
    for (const f of files) set.add(f.folder);
    return Array.from(set);
  }, [sections, files]);

  // Switch active editor content when selecting a different file
  function selectFile(file: SharedFile) {
    setSelectedId(file.id);
    setName(file.name);
    setFolder(file.folder);
    setContent(file.content);
    setLoadedRevision(file.revision);
    setDirty(false);
    setError(null);
  }

  function startNewFile() {
    setSelectedId('new');
    setName('');
    setFolder(folderFilter !== 'ALL' ? folderFilter : 'General');
    setContent('');
    setLoadedRevision(0);
    setDirty(false);
    setError(null);
  }

  // Sync incoming SSE updates from other user accounts into the open editor
  useEffect(() => {
    if (selectedId === 'new') return;
    if (!selectedFile) {
      if (files[0]) {
        selectFile(files[0]);
      } else {
        startNewFile();
      }
      return;
    }
    if (selectedFile.revision > loadedRevision && !dirty) {
      setName(selectedFile.name);
      setFolder(selectedFile.folder);
      setContent(selectedFile.content);
      setLoadedRevision(selectedFile.revision);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.id, selectedFile?.revision, dirty, files.length]);

  const hasRemoteUpdate = Boolean(selectedFile && selectedFile.revision > loadedRevision);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    if (selectedFile) {
      const res = await onUpdateFile({
        id: selectedFile.id,
        name,
        folder,
        content,
      });
      setSaving(false);
      if (!res.ok) {
        setError(res.error ?? 'Failed to save file.');
        return;
      }
      if (res.file) {
        setName(res.file.name);
        setFolder(res.file.folder);
        setContent(res.file.content);
        setLoadedRevision(res.file.revision);
      }
      setDirty(false);
      return;
    }

    const res = await onCreateFile({ name, folder, content });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Failed to create file.');
      return;
    }
    if (res.file) {
      setSelectedId(res.file.id);
      setName(res.file.name);
      setFolder(res.file.folder);
      setContent(res.file.content);
      setLoadedRevision(res.file.revision);
    }
    setDirty(false);
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const text = await picked.text();
    setSelectedId('new');
    setName(picked.name);
    setFolder(folderFilter !== 'ALL' ? folderFilter : 'General');
    setContent(text);
    setLoadedRevision(0);
    setDirty(true);
    setError(null);
    e.target.value = '';
  }

  function handleDownloadSelected() {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.trim() || 'document.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Shared Warehouse Files</h1>
          <p className="text-xs text-slate-500">
            Create, upload, or edit documents here or via Quick Edit in the sidebar/sections — saved changes sync to all user accounts.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={uploadInputRef}
            type="file"
            accept=".txt,.md,.csv,.json,.log,text/plain"
            onChange={handleUploadFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            Upload File
          </button>
          <button
            type="button"
            onClick={startNewFile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
            New File
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* File Directory */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Files ({visibleFiles.length})
            </span>
            <select
              aria-label="Filter files by folder"
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="h-7 px-2 text-xs bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Folders</option>
              {folderOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {visibleFiles.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-slate-500">
              No shared files yet. Create or upload a file on the right to share across all user accounts.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
              {visibleFiles.map((file) => {
                const isSelected = selectedId === file.id;
                return (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => selectFile(file)}
                      className={`w-full text-left px-3 py-2.5 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/90 border-l-2 border-blue-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          {file.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 shrink-0">
                          v{file.revision}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate">
                          {file.folder} · {file.updatedBy}
                        </span>
                        <span className="font-mono tabular-nums shrink-0">
                          <FormattedTime iso={file.updatedAt} mode="time" />
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* File Editor */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                {selectedFile ? `Editing ${selectedFile.name}` : 'New Shared File'}
              </h2>
              {selectedFile && (
                <span className="text-[11px] font-mono text-slate-500">
                  rev {selectedFile.revision} · updated by {selectedFile.updatedBy}
                </span>
              )}
            </div>

            {selectedFile && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadSelected}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFile(selectedFile)}
                  aria-label={`Delete file ${selectedFile.name}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Delete
                </button>
              </div>
            )}
          </div>

          {hasRemoteUpdate && dirty && selectedFile && (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md flex items-center justify-between gap-2 text-xs text-amber-900">
              <span>
                <strong>{selectedFile.updatedBy}</strong> saved revision {selectedFile.revision} from another view/account.
              </span>
              <button
                type="button"
                onClick={() => selectFile(selectedFile)}
                className="inline-flex items-center gap-1 px-2 py-1 font-medium bg-white border border-amber-300 rounded hover:bg-amber-100 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                Load Latest
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="file-editor-name" className="block text-xs font-medium text-slate-700 mb-1">
                File Name
              </label>
              <input
                id="file-editor-name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
                placeholder="e.g. receiving-checklist.txt"
                className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="file-editor-folder" className="block text-xs font-medium text-slate-700 mb-1">
                Section / Folder
              </label>
              <select
                id="file-editor-folder"
                value={folder}
                onChange={(e) => {
                  setFolder(e.target.value);
                  setDirty(true);
                }}
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
            <label htmlFor="file-editor-content" className="block text-xs font-medium text-slate-700 mb-1">
              Content
            </label>
            <textarea
              id="file-editor-content"
              rows={13}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              placeholder="Enter text, SOPs, inspection logs, or batch notes..."
              className="w-full p-3 text-xs font-mono leading-relaxed bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-2">
              {error}
            </p>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              {dirty ? 'Unsaved local edits' : 'Up to date across all connected user accounts'}
            </span>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              {saving ? 'Saving...' : selectedFile ? 'Save & Sync Changes' : 'Create & Share File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
