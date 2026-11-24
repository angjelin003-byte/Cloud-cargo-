import Link from 'next/link';
import { ArrowLeft, PackageSearch } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2.5 text-slate-700 mb-3">
          <PackageSearch className="w-5 h-5 shrink-0" />
          <h1 className="text-base font-semibold text-slate-900">Page not found</h1>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          The requested Cloud Cargo route could not be found.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inventory
        </Link>
      </div>
    </div>
  );
}
