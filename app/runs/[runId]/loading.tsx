export default function RunLoading() {
  return (
    <main className="min-h-[100dvh] bg-zinc-100 p-6">
      <div className="mx-auto max-w-[1800px] animate-pulse">
        <div className="h-20 bg-white" />
        <div className="mt-4 h-12 bg-zinc-900" />
        <div className="mt-4 h-[560px] border border-zinc-200 bg-white" />
      </div>
    </main>
  );
}
