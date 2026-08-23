'use client';

import { useEffect, useState } from 'react';

type Provider = 'openai' | 'anthropic';

interface AccountSettings {
  githubAccountId: number;
  login: string;
  type: 'User' | 'Organization';
  credential: {
    provider: Provider;
    model: string;
    keyLastFour: string;
    updatedAt: string;
  } | null;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: 'gpt-5.4',
  anthropic: 'claude-sonnet-4-6',
};

export default function LLMSettings() {
  const [accounts, setAccounts] = useState<AccountSettings[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [provider, setProvider] = useState<Provider>('openai');
  const [model, setModel] = useState(DEFAULT_MODELS.openai);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedAccount = accounts.find((account) => account.githubAccountId === accountId);

  useEffect(() => {
    fetch('/api/llm-settings')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load AI settings');
        setAccounts(data.accounts || []);
        if (data.accounts?.length) setAccountId(data.accounts[0].githubAccountId);
      })
      .catch((error) => setMessage({ type: 'error', text: error.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedAccount?.credential) return;
    setProvider(selectedAccount.credential.provider);
    setModel(selectedAccount.credential.model);
    setApiKey('');
  }, [accountId, selectedAccount?.credential]);

  const changeProvider = (nextProvider: Provider) => {
    setProvider(nextProvider);
    setModel(DEFAULT_MODELS[nextProvider]);
  };

  const save = async () => {
    if (!accountId) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/llm-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubAccountId: accountId, provider, model, apiKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save AI settings');

      setAccounts((current) => current.map((account) => account.githubAccountId === accountId
        ? { ...account, credential: { ...data.credential, updatedAt: new Date().toISOString() } }
        : account));
      setApiKey('');
      setMessage({ type: 'success', text: 'AI provider saved securely.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save AI settings' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!accountId || !selectedAccount?.credential) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/llm-settings?githubAccountId=${accountId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete AI settings');
      setAccounts((current) => current.map((account) => account.githubAccountId === accountId
        ? { ...account, credential: null }
        : account));
      setApiKey('');
      setMessage({ type: 'success', text: 'AI credential deleted.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete AI settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card">Loading AI provider settings...</div>;

  return (
    <section id="ai-settings" className="card">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-gray-900">AI Provider</h2>
        <p className="text-sm text-gray-600 mt-1">
          Use your own provider key. Mega-Miyya encrypts it and never displays it again.
        </p>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-gray-600">Reconnect GitHub with organization access before configuring a provider.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            GitHub account or company
            <select
              value={accountId || ''}
              onChange={(event) => setAccountId(Number(event.target.value))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              {accounts.map((account) => (
                <option key={account.githubAccountId} value={account.githubAccountId}>
                  {account.login} ({account.type})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Provider
            <select
              value={provider}
              onChange={(event) => changeProvider(event.target.value as Provider)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Model
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={DEFAULT_MODELS[provider]}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            API key
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="new-password"
              placeholder={selectedAccount?.credential
                ? `Replace key ending in ${selectedAccount.credential.keyLastFour}`
                : 'Paste a provider API key'}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>

          <div className="md:col-span-2 flex items-center justify-between gap-4">
            <div className="text-sm">
              {message && (
                <span className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                  {message.text}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {selectedAccount?.credential && (
                <button className="btn-secondary" onClick={remove} disabled={saving}>Delete credential</button>
              )}
              <button className="btn-primary" onClick={save} disabled={saving || !apiKey || !model}>
                {saving ? 'Saving...' : selectedAccount?.credential ? 'Replace credential' : 'Save credential'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
