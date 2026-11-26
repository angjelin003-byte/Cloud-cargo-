'use client';

import { Menu, Plus } from 'lucide-react';

export type WorkspaceTab = 'inventory' | 'sections' | 'files' | 'movements' | 'operators';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenAddMaterial: () => void;
  onToggleMobileMenu: () => void;
}

const NAV_ITEMS: { id: WorkspaceTab; label: string }[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'sections', label: 'Sections' },
  { id: 'files', label: 'Files' },
  { id: 'movements', label: 'Movements' },
  { id: 'operators', label: 'Operators' },
];

export function TopBar({
  activeTab,
  onSelectTab,
  onOpenAddMaterial,
  onToggleMobileMenu,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single-element Brand Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Open navigation drawer"
          className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <Menu className="w-5 h-5" />
        </button>
        <a
          href="#inventory"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('inventory');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Cloud Cargo
        </a>
      </div>

      {/* Zone 2: Concise single-line navigation links */}
      <nav aria-label="Primary workspace navigation" className="hidden md:flex items-center gap-6">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isActive
                  ? 'text-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onOpenAddMaterial}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Add Material
        </button>
      </div>
    </header>
  );
}
