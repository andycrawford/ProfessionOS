export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Profession OS</h1>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">v0.1.0</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Overview cards */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
            Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Services", value: "—", sub: "0 monitored" },
              { label: "Mailboxes", value: "—", sub: "0 connected" },
              { label: "Calendars", value: "—", sub: "0 synced" },
              { label: "Alerts", value: "—", sub: "0 active" },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5"
              >
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">{card.label}</p>
                <p className="text-3xl font-semibold">{card.value}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{card.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent activity */}
          <section className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
              Recent Activity
            </h2>
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-600">
              <p className="text-sm">No activity yet</p>
              <p className="text-xs mt-1">Connect services to see activity here</p>
            </div>
          </section>

          {/* AI Assistant */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
              AI Assistant
            </h2>
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-600">
              <p className="text-sm">Assistant coming soon</p>
              <p className="text-xs mt-1 text-center">Agentic AI for your professional workflow</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs text-zinc-400 dark:text-zinc-600">Profession OS — placeholder dashboard</p>
        </div>
      </footer>
    </div>
  );
}
