'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CloudIcon,
  CodeBracketIcon,
  CommandLineIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import AccessCodeGate from './AccessCodeGate';

interface LandingPageProps {
  accessCodeRequired: boolean;
  oauthStatus: 'idle' | 'loading' | 'success' | 'error';
  oauthMessage: string;
  onConnect: () => void;
}

const sourceUrl = 'https://github.com/ismoil793/mega-miya';
const contactUrl = 'mailto:ismoil.793@gmail.com?subject=Mega-Miya%20hosted%20access&body=Hi%20Ismoil%2C%0A%0AI%27d%20like%20to%20try%20hosted%20Mega-Miya%20for%20my%20company.%0A%0ACompany%3A%0AGitHub%20organization%3A%0A';

const capabilities = [
  { icon: CpuChipIcon, title: 'Context-aware reviews', text: 'Understands changed files, imports, tests, configuration, and surrounding code—not just isolated diff lines.' },
  { icon: ShieldCheckIcon, title: 'Your keys, your code', text: 'Bring your own OpenAI or Anthropic key. Credentials are encrypted and repository context is never persisted.' },
  { icon: CommandLineIcon, title: 'Native GitHub workflow', text: 'Inline findings, apply-ready suggestions, updated summaries, and optional approval when bot threads are resolved.' },
];

export default function LandingPage({ accessCodeRequired, oauthStatus, oauthMessage, onConnect }: LandingPageProps) {
  const [showHostedAccess, setShowHostedAccess] = useState(false);
  const chooseHosted = () => {
    if (!accessCodeRequired) return onConnect();
    setShowHostedAccess(true);
  };
  useEffect(() => {
    if (!showHostedAccess) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setShowHostedAccess(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', close); };
  }, [showHostedAccess]);

  return (
    <div className="landing-shell min-h-screen bg-[#f7faf8] text-[#14251b]">
      <header className="border-b border-[#dce7df] bg-white/90 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Mega-Miya home">
            <Image src="/brand/mega-miya.png" alt="Mega-Miya" width={42} height={42} priority />
            <span className="text-lg font-semibold tracking-tight">Mega-Miya</span>
            <span className="hidden rounded-full border border-[#b9dfc7] bg-[#ebf8f0] px-2 py-0.5 text-xs text-[#167543] sm:inline">Open source</span>
          </a>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden text-sm text-[#587064] transition hover:text-[#14251b] md:block">Features</a>
            <a href="#deploy" className="hidden text-sm text-[#587064] transition hover:text-[#14251b] md:block">Get started</a>
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="hidden text-sm text-[#587064] transition hover:text-[#14251b] sm:block">GitHub</a>
            <button onClick={onConnect} disabled={oauthStatus === 'loading'} className="rounded-lg border border-[#cbd9d0] bg-white px-4 py-2 text-sm font-medium transition hover:border-[#78bd91] hover:bg-[#f0f8f3] disabled:opacity-60">
              {oauthStatus === 'loading' ? 'Connecting…' : 'Sign in'}
            </button>
          </div>
        </nav>
      </header>

      <main id="top">
        {(oauthStatus === 'error' || oauthStatus === 'success') && oauthMessage && (
          <div className={`mx-auto mt-6 max-w-3xl rounded-xl border px-4 py-3 text-sm ${oauthStatus === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-[#b9dfc7] bg-[#ebf8f0] text-[#167543]'}`}>
            {oauthMessage}
          </div>
        )}

        <section className="landing-grid relative overflow-hidden border-b border-[#dce7df]">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div className="relative z-10">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#b9dfc7] bg-[#ebf8f0] px-3 py-1.5 text-sm text-[#167543]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5cdb95]" /> AGPL-3.0 · Built for teams that own their stack
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-0.04em] text-[#102117] sm:text-7xl">
                Code review with <span className="text-[#168447]">context.</span><br />Control by default.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#52685c] sm:text-xl">
                Mega-Miya is an open-source GitHub reviewer that finds high-signal issues, explains them inline, and lets every company use its own LLM credentials.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#168447] px-6 py-3.5 font-semibold text-white transition hover:bg-[#106d3a]">
                  <CodeBracketIcon className="h-5 w-5" /> Self-host Mega-Miya <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </a>
                <button onClick={chooseHosted} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cbd9d0] bg-white px-6 py-3.5 font-semibold transition hover:border-[#78bd91] hover:bg-[#f0f8f3]">
                  Use managed early access
                </button>
              </div>
              <p className="mt-5 text-sm text-[#6b7f74]">Hosted access is private during early rollout. Self-hosting is available to everyone.</p>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:mx-0">
              <div className="absolute -inset-12 rounded-full bg-[#5cdb95]/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#111713] shadow-2xl shadow-black/50">
                <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-[#5cdb95]" />
                  <span className="ml-3 font-mono text-xs text-zinc-500">mega-miya / review</span>
                </div>
                <div className="space-y-5 p-6 font-mono text-sm leading-6 sm:p-8">
                  <div className="text-zinc-500">src/api/webhooks.ts <span className="text-[#5cdb95]">+12</span> <span className="text-red-400">-3</span></div>
                  <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-300">High · race condition</div>
                    <p className="font-sans text-zinc-300">The webhook can be delivered twice before this status is persisted. Claim the delivery ID atomically before starting the review.</p>
                  </div>
                  <div className="space-y-1 text-zinc-500"><div><span className="mr-3 text-zinc-600">41</span><span className="text-red-300">- await startReview(payload)</span></div><div><span className="mr-3 text-zinc-600">41</span><span className="text-[#8df0b7]">+ await claimAndStart(payload)</span></div></div>
                  <div className="flex items-center gap-2 border-t border-white/10 pt-5 font-sans text-sm text-[#8df0b7]"><CheckCircleIcon className="h-5 w-5" /> Context checked across 6 related files</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#168447]">Practical intelligence</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">A reviewer that fits your security model.</h2></div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[#dce7df] bg-[#dce7df] shadow-sm md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, text }) => <article key={title} className="bg-white p-8"><Icon className="h-7 w-7 text-[#168447]" /><h3 className="mt-6 text-lg font-semibold">{title}</h3><p className="mt-3 leading-7 text-[#5e7267]">{text}</p></article>)}
          </div>
        </section>

        <section id="deploy" className="border-y border-[#dce7df] bg-[#edf4ef]">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
            <div className="text-center"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#168447]">Two ways to run</p><h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Choose who operates the stack.</h2></div>
            <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-2">
              <article className="relative flex flex-col rounded-2xl border-2 border-[#168447] bg-gradient-to-b from-[#e4f6ea] to-white p-8 shadow-md">
                <span className="absolute right-5 top-5 rounded-full bg-[#168447] px-3 py-1 text-xs font-semibold text-white">Recommended</span>
                <CodeBracketIcon className="h-8 w-8 text-[#168447]" /><p className="mt-6 text-sm font-semibold text-[#168447]">OPEN SOURCE</p><h3 className="mt-2 text-2xl font-semibold">Self-host everything</h3><p className="mt-4 leading-7 text-[#5e7267]">Deploy the frontend and worker, connect MongoDB, register your GitHub and OAuth Apps, and bring your own LLM key. Best for teams that need full infrastructure ownership.</p>
                <ul className="mt-6 space-y-3 text-sm text-[#334b3e]">{['No platform access code', 'Your infrastructure and database', 'AGPL source available on GitHub'].map(item => <li key={item} className="flex gap-2"><CheckCircleIcon className="h-5 w-5 shrink-0 text-[#168447]" />{item}</li>)}</ul>
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 font-semibold text-[#168447] hover:text-[#0d6133]">Read the source and setup guide <ArrowRightIcon className="h-4 w-4" /></a>
              </article>
              <article className="flex flex-col rounded-2xl border border-[#d3e1d8] bg-white p-8 shadow-sm">
                <CloudIcon className="h-8 w-8 text-[#168447]" /><p className="mt-6 text-sm font-semibold text-[#168447]">MANAGED EARLY ACCESS</p><h3 className="mt-2 text-2xl font-semibold">Use the hosted system</h3><p className="mt-4 leading-7 text-[#496154]">I operate the application, GitHub integration, and database. Your company installs Mega-Miya on selected repositories and supplies its own encrypted LLM credential.</p>
                <ul className="mt-6 space-y-3 text-sm text-[#334b3e]">{['No servers or database to maintain', 'One-time invite code for new accounts', 'Repository access stays installation-scoped'].map(item => <li key={item} className="flex gap-2"><CheckCircleIcon className="h-5 w-5 shrink-0 text-[#168447]" />{item}</li>)}</ul>
                <div className="mt-8 flex flex-wrap gap-3"><button onClick={chooseHosted} className="rounded-lg bg-[#168447] px-4 py-2.5 font-semibold text-white hover:bg-[#106d3a]">I have an access code</button><a href={contactUrl} className="rounded-lg border border-[#afc8b7] bg-white px-4 py-2.5 font-semibold hover:bg-[#f3f8f5]">Contact me</a></div>
              </article>
            </div>

          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 text-sm text-[#687c70] sm:flex-row sm:items-center sm:justify-between sm:px-8"><p>© 2026 Ismoil · AGPL-3.0-or-later</p><div className="flex gap-5"><a href={sourceUrl} target="_blank" rel="noreferrer" className="hover:text-[#14251b]">GitHub</a><a href={contactUrl} className="hover:text-[#14251b]">Contact</a></div></footer>

      {showHostedAccess && accessCodeRequired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102117]/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setShowHostedAccess(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="access-code-title" className="relative w-full max-w-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <button onClick={() => setShowHostedAccess(false)} aria-label="Close access-code dialog" className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"><XMarkIcon className="h-5 w-5" /></button>
            <AccessCodeGate onReturningUser={onConnect} />
          </div>
        </div>
      )}
    </div>
  );
}
