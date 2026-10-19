export function AuthHero() {
  return (
    <section className="flex flex-col justify-between bg-[#0f1a2e] p-8 text-white sm:p-12">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[#2b59d9] text-sm font-bold">TS</span>
        <div>
          <div className="font-semibold">TimeSheet Pro</div>
          <div className="text-xs text-white/60">by Hrudai</div>
        </div>
      </div>
      <div className="my-12">
        <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Log hours. Get sign-off. Close the month.</h1>
        <p className="mt-5 max-w-md text-white/70">
          Enter hours, get manager approval, share the sheet with the client. Every step is stamped with who and when.
        </p>
      </div>
      <ol className="space-y-3 text-sm text-white/85">
        {["Employee logs daily hours and submits", "Reporting manager approves or sends back", "Manager-approved PDF is shared with the client"].map((s, i) => (
          <li key={s} className="flex gap-4">
            <span className="font-mono text-[#7d9cf5]">0{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </section>
  );
}
