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
    <div className="landing-shell min-h-screen bg-[#fbfaf7] text-[#080b18]">
      <header className="border-b border-[#e1dde6] bg-[#fbfaf7]/90 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Mega-Miya home">
            <Image src="/brand/mega-miya.png" alt="Mega-Miya" width={42} height={42} priority />
            <span className="text-lg font-semibold tracking-tight">Mega-Miya</span>
            <span className="hidden rounded-full border border-[#d9d1e3] bg-[#f3eff7] px-2 py-0.5 text-xs text-[#5e4a70] sm:inline">Open source</span>
          </a>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden text-sm text-[#66616e] transition hover:text-[#080b18] md:block">Features</a>
            <a href="#deploy" className="hidden text-sm text-[#66616e] transition hover:text-[#080b18] md:block">Get started</a>
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="hidden text-sm text-[#66616e] transition hover:text-[#080b18] sm:block">GitHub</a>
            <button onClick={onConnect} disabled={oauthStatus === 'loading'} className="rounded-lg border border-[#d8d4de] bg-white px-4 py-2 text-sm font-medium transition hover:border-[#9b87ad] hover:bg-[#f5f2f8] disabled:opacity-60">
              {oauthStatus === 'loading' ? 'Connecting…' : 'Sign in'}
            </button>
          </div>
        </nav>
      </header>

      <main id="top">
        {(oauthStatus === 'error' || oauthStatus === 'success') && oauthMessage && (
          <div className={`mx-auto mt-6 max-w-3xl rounded-xl border px-4 py-3 text-sm ${oauthStatus === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-[#d9d1e3] bg-[#f3eff7] text-[#5e4a70]'}`}>
            {oauthMessage}
          </div>
        )}

        <section className="landing-grid relative overflow-hidden border-b border-[#e1dde6]">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div className="relative z-10">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d9d1e3] bg-[#f3eff7] px-3 py-1.5 text-sm text-[#5e4a70]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#756184]" /> AGPL-3.0 · Built for teams that own their stack
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-0.04em] text-[#080b18] sm:text-7xl">
                Code review with <span className="text-[#5b466d]">context.</span><br />Control by default.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#5b5967] sm:text-xl">
                Mega-Miya is an open-source GitHub reviewer that finds high-signal issues, explains them inline, and lets every company use its own LLM credentials.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#080b18] px-6 py-3.5 font-semibold text-white transition hover:bg-[#292334]">
                  <CodeBracketIcon className="h-5 w-5" /> Self-host Mega-Miya <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </a>
                <button onClick={chooseHosted} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8d4de] bg-white px-6 py-3.5 font-semibold transition hover:border-[#9b87ad] hover:bg-[#f5f2f8]">
                  Use managed early access
                </button>
              </div>
              <p className="mt-5 text-sm text-[#77727d]">Hosted access is private during early rollout. Self-hosting is available to everyone.</p>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:mx-0">
              <div className="absolute -inset-12 rounded-full bg-[#756184]/15 blur-3xl" />
              <div className="relative overflow-hidden rounded-2xl border border-[#d5d9de] bg-white text-[#1f2328] shadow-2xl shadow-[#1b1328]/20">
                <div className="relative flex h-11 items-center border-b border-[#302c3c] bg-[#181621] px-4">
                  <div className="flex gap-2" aria-hidden="true"><span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" /></div>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[11px] text-[#91899e] sm:text-xs"><span className="text-[#d9d3e2]">mega-miya</span><span className="mx-2 text-[#544e60]">/</span>review</div>
                </div>
                <div className="flex items-center gap-3 border-b border-[#d8dee4] px-4 py-3 text-sm sm:px-5">
                  <Image src="/brand/mega-miya.png" alt="" width={32} height={32} className="rounded-md" />
                  <div className="min-w-0"><span className="font-semibold text-[#1f2328]">mega-miya</span> <span className="rounded-full border border-[#d0d7de] px-1.5 py-0.5 text-xs text-[#59636e]">Bot</span> <span className="text-[#59636e]">reviewed 2 minutes ago</span></div>
                </div>

                <div className="border-b border-[#d8dee4] bg-[#f6f8fa] px-5 py-3 font-mono text-sm font-semibold text-[#1f2328]">⌄&nbsp;&nbsp;App.tsx</div>
                <div className="overflow-x-auto border-b border-[#d8dee4] font-mono text-[11px] leading-7 sm:text-xs">
                  <div className="flex min-w-[570px] bg-[#ffebe9] text-[#1f2328]"><span className="w-12 shrink-0 border-r border-[#ffcecb] pr-3 text-right text-[#59636e]">16</span><code className="px-3">import {'{ DEFAULT_WEB_URL, resolveIncomingLinkToWebUri }'} from &apos;./linking&apos;;</code></div>
                  <div className="flex min-w-[570px] bg-[#dafbe1] text-[#1f2328]"><span className="w-12 shrink-0 border-r border-[#aceebb] pr-3 text-right text-[#59636e]">16</span><code className="px-3">import {'{ DEFAULT_WEB_URL, resolveIncomingLinkToWebUri }'} from &apos;./lin-king&apos;;</code></div>
                  <div className="flex min-w-[570px] bg-[#dafbe1] text-[#1f2328]"><span className="w-12 shrink-0 border-r border-[#aceebb] pr-3 text-right text-[#59636e]">18</span><code className="px-3">console.log(&apos;Hello world!);</code></div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-sm"><Image src="/brand/mega-miya.png" alt="" width={28} height={28} className="rounded" /><span className="font-semibold text-[#1f2328]">mega-miya</span><span className="rounded-full border border-[#d0d7de] px-1.5 py-0.5 text-xs text-[#59636e]">Bot</span></div>
                  <div className="mt-5 font-semibold text-[#1f2328]"><span className="mr-2 inline-block h-4 w-4 rounded-sm bg-[#cf222e] align-[-2px]" />CRITICAL · bug</div>
                  <p className="mt-4 text-sm leading-6 text-[#30363d]">This string literal is missing its closing quote, which makes the file invalid TypeScript/JavaScript and prevents the app from building or starting.</p>

                  <div className="mt-5 overflow-hidden rounded-lg border border-[#d0d7de]">
                    <div className="border-b border-[#d8dee4] bg-[#f6f8fa] px-3 py-2 text-xs text-[#59636e]">Suggested change</div>
                    <div className="overflow-x-auto font-mono text-[11px] leading-7 sm:text-xs">
                      <div className="flex min-w-[390px] bg-[#ffebe9]"><span className="w-11 shrink-0 border-r border-[#ffcecb] pr-2 text-right text-[#59636e]">18</span><code className="px-3">console.log(&apos;Hello world!);</code></div>
                      <div className="flex min-w-[390px] bg-[#dafbe1]"><span className="w-11 shrink-0 border-r border-[#aceebb] pr-2 text-right text-[#59636e]">18</span><code className="px-3">console.log(&apos;Hello world!&apos;);</code></div>
                    </div>
                    <div className="flex justify-end bg-white p-2"><span className="rounded-md border border-[#d0d7de] bg-[#f6f8fa] px-3 py-1.5 text-xs font-semibold text-[#1f2328] shadow-sm">Apply suggestion</span></div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-[#d8dee4] pt-4"><span className="rounded-md border border-[#d0d7de] bg-[#f6f8fa] px-3 py-1.5 text-xs font-semibold text-[#1f2328]">Resolve conversation</span><span className="flex items-center gap-1.5 text-xs text-[#5b466d]"><CheckCircleIcon className="h-4 w-4" /> Inline, actionable feedback</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5b466d]">Practical intelligence</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">A reviewer that fits your security model.</h2></div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[#e1dde6] bg-[#e1dde6] shadow-sm md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, text }) => <article key={title} className="bg-white p-8"><Icon className="h-7 w-7 text-[#5b466d]" /><h3 className="mt-6 text-lg font-semibold">{title}</h3><p className="mt-3 leading-7 text-[#686472]">{text}</p></article>)}
          </div>
        </section>

        <section id="deploy" className="border-y border-[#e1dde6] bg-[#f3f0f5]">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
            <div className="text-center"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5b466d]">Two ways to run</p><h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Choose who operates the stack.</h2></div>
            <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-2">
              <article className="relative flex flex-col rounded-2xl border-2 border-[#5b466d] bg-gradient-to-b from-[#f0ebf4] to-white p-8 shadow-md">
                <span className="absolute right-5 top-5 rounded-full bg-[#080b18] px-3 py-1 text-xs font-semibold text-white">Recommended</span>
                <CodeBracketIcon className="h-8 w-8 text-[#5b466d]" /><p className="mt-6 text-sm font-semibold text-[#5b466d]">OPEN SOURCE</p><h3 className="mt-2 text-2xl font-semibold">Self-host everything</h3><p className="mt-4 leading-7 text-[#686472]">Deploy the frontend and worker, connect MongoDB, register your GitHub and OAuth Apps, and bring your own LLM key. Best for teams that need full infrastructure ownership.</p>
                <ul className="mt-6 space-y-3 text-sm text-[#3f3b48]">{['No platform access code', 'Your infrastructure and database', 'AGPL source available on GitHub'].map(item => <li key={item} className="flex gap-2"><CheckCircleIcon className="h-5 w-5 shrink-0 text-[#5b466d]" />{item}</li>)}</ul>
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 font-semibold text-[#5b466d] hover:text-[#433550]">Read the source and setup guide <ArrowRightIcon className="h-4 w-4" /></a>
              </article>
              <article className="flex flex-col rounded-2xl border border-[#ddd8e3] bg-white p-8 shadow-sm">
                <CloudIcon className="h-8 w-8 text-[#5b466d]" /><p className="mt-6 text-sm font-semibold text-[#5b466d]">MANAGED EARLY ACCESS</p><h3 className="mt-2 text-2xl font-semibold">Use the hosted system</h3><p className="mt-4 leading-7 text-[#5e5967]">I operate the application, GitHub integration, and database. Your company installs Mega-Miya on selected repositories and supplies its own encrypted LLM credential.</p>
                <ul className="mt-6 space-y-3 text-sm text-[#3f3b48]">{['No servers or database to maintain', 'One-time invite code for new accounts', 'Repository access stays installation-scoped'].map(item => <li key={item} className="flex gap-2"><CheckCircleIcon className="h-5 w-5 shrink-0 text-[#5b466d]" />{item}</li>)}</ul>
                <div className="mt-8 flex flex-wrap gap-3"><button onClick={chooseHosted} className="rounded-lg bg-[#292334] px-4 py-2.5 font-semibold text-white hover:bg-[#080b18]">I have an access code</button><a href={contactUrl} className="rounded-lg border border-[#cfc7d8] bg-white px-4 py-2.5 font-semibold hover:bg-[#f5f2f8]">Contact me</a></div>
              </article>
            </div>

          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 text-sm text-[#77727d] sm:flex-row sm:items-center sm:justify-between sm:px-8"><p>© 2026 Ismoil · AGPL-3.0-or-later</p><div className="flex gap-5"><a href={sourceUrl} target="_blank" rel="noreferrer" className="hover:text-[#080b18]">GitHub</a><a href={contactUrl} className="hover:text-[#080b18]">Contact</a></div></footer>

      {showHostedAccess && accessCodeRequired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080b18]/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setShowHostedAccess(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="access-code-title" className="relative w-full max-w-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <button onClick={() => setShowHostedAccess(false)} aria-label="Close access-code dialog" className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"><XMarkIcon className="h-5 w-5" /></button>
            <AccessCodeGate onReturningUser={onConnect} />
          </div>
        </div>
      )}
    </div>
  );
}
