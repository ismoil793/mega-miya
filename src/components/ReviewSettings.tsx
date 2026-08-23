'use client';

import { useEffect, useState } from 'react';

type Depth = 'diff' | 'changed-files' | 'balanced' | 'deep';
interface Account { githubAccountId: number; login: string; contextDepth: Depth; autoApproveWhenResolved: boolean }

export default function ReviewSettings() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const account = accounts.find((item) => item.githubAccountId === selected);
  useEffect(() => {
    fetch('/api/review-settings').then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load review settings');
      setAccounts(data.accounts || []);
      setSelected(data.accounts?.[0]?.githubAccountId || null);
    }).catch((error) => setMessage(error.message));
  }, []);
  const update = (patch: Partial<Account>) => setAccounts((current) => current.map((item) =>
    item.githubAccountId === selected ? { ...item, ...patch } : item));
  const save = async () => {
    if (!account) return;
    setMessage('Saving...');
    const response = await fetch('/api/review-settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });
    const data = await response.json();
    setMessage(response.ok ? 'Review settings saved.' : data.error || 'Failed to save review settings');
  };
  if (!accounts.length) return null;
  return <section className="card">
    <h2 className="text-xl font-semibold text-gray-900">Review behavior</h2>
    <p className="mt-1 text-sm text-gray-600">Selected source files are sent only to this account&apos;s configured AI provider. Source context is not stored.</p>
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="text-sm font-medium text-gray-700">GitHub account
        <select className="mt-1 block w-full rounded-md border px-3 py-2" value={selected || ''} onChange={(event) => setSelected(Number(event.target.value))}>
          {accounts.map((item) => <option key={item.githubAccountId} value={item.githubAccountId}>{item.login}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-gray-700">Context depth
        <select className="mt-1 block w-full rounded-md border px-3 py-2" value={account?.contextDepth || 'diff'} onChange={(event) => update({ contextDepth: event.target.value as Depth })}>
          <option value="diff">Diff only — lowest cost</option>
          <option value="changed-files">Full changed files</option>
          <option value="balanced">Changed files + imports/tests/config</option>
          <option value="deep">Deep (currently same bounded discovery)</option>
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm text-gray-700 md:col-span-2">
        <input type="checkbox" className="mt-1" checked={Boolean(account?.autoApproveWhenResolved)} onChange={(event) => update({ autoApproveWhenResolved: event.target.checked })} />
        Automatically approve the reviewed commit after every Mega-Miya review thread is resolved.
      </label>
      <div className="flex items-center justify-between md:col-span-2"><span className="text-sm text-gray-600">{message}</span><button className="btn-primary" onClick={save}>Save review settings</button></div>
    </div>
  </section>;
}
