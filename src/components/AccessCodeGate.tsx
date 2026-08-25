'use client';

import { FormEvent, useState } from 'react';

export default function AccessCodeGate({ onReturningUser }: { onReturningUser: () => void }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/access-codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not validate this access code.');
      window.location.assign(data.authorizationUrl || '/api/auth/github');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not validate this access code.');
      setSubmitting(false);
    }
  };

  return (
    <section id="access-code" className="card border border-primary-100">
      <h2 id="access-code-title" className="text-xl font-semibold text-gray-900">Private access</h2>
      <p className="mt-1 text-sm text-gray-600">
        Mega-Miya is currently invite-only. Enter the one-time code shared with you, then connect your GitHub account.
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-sm font-medium text-gray-700">
          Access code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            autoComplete="one-time-code"
            spellCheck={false}
            placeholder="MM-XXXX-XXXX-XXXX-XXXX"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono uppercase tracking-wide"
          />
        </label>
        <button className="btn-primary self-end" type="submit" disabled={submitting || !code.trim()}>
          {submitting ? 'Validating…' : 'Use code and connect GitHub'}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 border-t pt-4 text-sm text-gray-600">
        Already used a code previously?{' '}
        <button type="button" className="font-medium text-primary-600 hover:text-primary-700" onClick={onReturningUser}>
          Sign in again with GitHub
        </button>
      </div>
    </section>
  );
}
