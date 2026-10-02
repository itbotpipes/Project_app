export default function LoadingTaskReport() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12 animate-pulse">
      {/* Top back button skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-44 rounded-xl bg-slate-200" />
      </div>

      {/* Header skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-slate-200" />
            <div className="h-4 w-64 rounded bg-slate-100" />
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4 flex gap-2">
          <div className="h-8 w-80 rounded-xl bg-slate-100" />
          <div className="h-8 w-48 rounded-xl bg-slate-100 ml-auto" />
        </div>
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200 bg-white p-4" />
        ))}
      </div>

      {/* Grid skeletons */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-44 rounded-2xl border border-slate-200 bg-white p-5" />
        <div className="h-44 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2" />
      </div>

      {/* KPI usage skeleton */}
      <div className="h-64 rounded-2xl border border-slate-200 bg-white p-5" />
    </div>
  );
}
