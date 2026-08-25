'use client';

import { useState, useEffect } from 'react';
import { CodeReview } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import RepositoryModal from '@/components/RepositoryModal';
import GitHubAppInstallation from '@/components/GitHubAppInstallation';
import LLMSettings from '@/components/LLMSettings';
import ReviewSettings from '@/components/ReviewSettings';
import AccessCodeGate from '@/components/AccessCodeGate';

interface User {
  id: string;
  githubId: number;
  githubUsername: string;
  email?: string;
  name?: string;
  avatarUrl: string;
  repositories: string[];
  settings: any;
  createdAt: string;
}

export default function Dashboard() {
  const [reviews, setReviews] = useState<CodeReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [oauthMessage, setOauthMessage] = useState<string>('');
  const [showRepositoryModal, setShowRepositoryModal] = useState(false);
  const [accessCodeRequired, setAccessCodeRequired] = useState(false);

  useEffect(() => {
    checkOAuthStatus();
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setAccessCodeRequired(Boolean(data.accessCodeRequired));
      
      if (data.user) {
        setUser(data.user);
        await fetchReviews();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setLoading(false);
    }
  };

  const checkOAuthStatus = () => {
    // Check URL parameters for OAuth results
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success === 'connected') {
      setOauthStatus('success');
      setOauthMessage('Successfully connected to GitHub!');
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      setOauthStatus('error');
      setOauthMessage(error === 'access_code_required'
        ? 'A valid one-time access code is required for a new account.'
        : `Connection failed: ${error}`);
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reviews');
      const data = await response.json();
      
      if (response.ok) {
        setReviews(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch reviews');
      }
    } catch (err) {
      setError('Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGitHub = () => {
    setOauthStatus('loading');
    // Redirect to GitHub OAuth
    window.location.href = '/api/auth/github';
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setOauthStatus('idle');
      setOauthMessage('');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleRepositorySave = (repositories: string[]) => {
    // Update user state with new repositories
    if (user) {
      setUser({
        ...user,
        repositories: repositories,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: 'badge-warning',
      completed: 'badge-success',
      failed: 'badge-error',
    };
    
    return (
      <span className={`badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-info'}`}>
        {status}
      </span>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reviews...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchReviews}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mega Miya</h1>
              <p className="text-gray-600">AI-Powered Code Review Tool</p>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <img 
                    src={user.avatarUrl} 
                    alt={user.githubUsername}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">@{user.githubUsername}</p>
                    <p className="text-gray-500">Connected</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="btn-secondary text-sm"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button 
                  className={`btn-primary ${oauthStatus === 'loading' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={handleConnectGitHub}
                  disabled={oauthStatus === 'loading'}
                >
                  {oauthStatus === 'loading' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    accessCodeRequired ? 'Returning user sign in' : 'Connect GitHub'
                  )}
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => document.getElementById('ai-settings')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* OAuth Status Messages */}
      {oauthStatus === 'success' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 bg-green-400 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{oauthMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {oauthStatus === 'error' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 bg-red-400 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✕</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{oauthMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Info Section */}
      {user && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <img 
                  src={user.avatarUrl} 
                  alt={user.githubUsername}
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Welcome, {user.name || user.githubUsername}!
                  </h2>
                  <p className="text-gray-600">
                    Connected as @{user.githubUsername} • {user.repositories.length} repositories enabled • Webhooks automatic
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  className="btn-secondary"
                  onClick={() => setShowRepositoryModal(true)}
                >
                  Select Repositories
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GitHub App Installation Section */}
      {user && user.repositories.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <GitHubAppInstallation 
            repositories={user.repositories.map(repo => ({
              id: 0, // We don't have the actual ID here, but it's not used
              name: repo.split('/')[1],
              fullName: repo,
              isEnabled: true,
            }))}
            onInstallationComplete={() => {
              // Refresh user data after installation
              fetchUser();
            }}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user && accessCodeRequired && <div className="mb-8"><AccessCodeGate onReturningUser={handleConnectGitHub} /></div>}
        {user && <div className="mb-8"><LLMSettings /></div>}
        {user && <div className="mb-8"><ReviewSettings /></div>}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-lg">📊</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Reviews</p>
                <p className="text-2xl font-semibold text-gray-900">{reviews.length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-lg">✅</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {reviews.filter(r => r.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-yellow-600 text-lg">⏳</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {reviews.filter(r => r.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 text-lg">❌</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Failed</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {reviews.filter(r => r.status === 'failed').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews List */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Recent Reviews</h2>
            <button 
              onClick={fetchReviews}
              className="btn-secondary"
            >
              Refresh
            </button>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {user ? 'No reviews yet' : 'Connect to get started'}
              </h3>
              <p className="text-gray-600 mb-4">
                {user 
                  ? 'Create a pull request in one of your connected repositories to get your first AI review.'
                  : 'Connect your GitHub repositories to start getting AI-powered code reviews.'
                }
              </p>
              {!user && (
                <button 
                  className="btn-primary"
                  onClick={accessCodeRequired
                    ? () => document.getElementById('access-code')?.scrollIntoView({ behavior: 'smooth' })
                    : handleConnectGitHub}
                >
                  {accessCodeRequired ? 'Enter an access code' : 'Connect GitHub'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {review.repositoryName}
                        </h3>
                        {getStatusBadge(review.status)}
                      </div>
                      
                      {review.review && (
                        <div className="space-y-2">
                          <p className="text-gray-600">{review.review.summary}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className={`font-medium ${getScoreColor(review.review.score)}`}>
                              Score: {review.review.score}/100
                            </span>
                            <span>
                              {review.review.suggestions.length} suggestions
                            </span>
                            <span>
                              {review.review.issues.length} issues
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-3 text-sm text-gray-500">
                        Created {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button className="btn-secondary text-sm">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-600 sm:px-6 lg:px-8">
          Mega Miya is licensed under the AGPL-3.0-or-later.{' '}
          <a
            href="https://github.com/ismoil793/mega-miya"
            className="font-medium text-blue-600 hover:text-blue-800"
            target="_blank"
            rel="noreferrer"
          >
            View source code
          </a>
          {' '}· Copyright © 2026{' '}
          <a
            href="https://github.com/ismoil793"
            className="font-medium text-blue-600 hover:text-blue-800"
            target="_blank"
            rel="noreferrer"
          >
            Ismoil
          </a>
        </div>
      </footer>

      {/* Repository Modal */}
      <RepositoryModal
        isOpen={showRepositoryModal}
        onClose={() => setShowRepositoryModal(false)}
        onSave={handleRepositorySave}
      />
    </div>
  );
}
