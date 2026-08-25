'use client';

import { useState, useEffect } from 'react';

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  private?: boolean;
  language?: string;
  stars?: number;
  updatedAt?: string;
  isEnabled: boolean;
  hasGitHubApp?: boolean;
}

interface GitHubAppInstallationProps {
  repositories: Repository[];
  onInstallationComplete?: () => void;
}

export default function GitHubAppInstallation({ repositories, onInstallationComplete }: GitHubAppInstallationProps) {
  const [loading, setLoading] = useState(false);
  const [installationStatus, setInstallationStatus] = useState<Record<string, boolean>>({});
  const [showInstallationModal, setShowInstallationModal] = useState(false);
  const [appName, setAppName] = useState('mega-miya');

  // Get GitHub App installation URL
  const getInstallationUrl = (repository: string) => {
    const [owner] = repository.split('/');
    return `https://github.com/apps/${appName}/installations/new?target_id=${owner}`;
  };

  // Check installation status for repositories
  const checkInstallationStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/github-app/installation-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositories: repositories.map(repo => repo.fullName),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInstallationStatus(data.installations);
        setAppName(data.appName || 'mega-miya');
      }
    } catch (error) {
      console.error('Failed to check installation status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositories.length > 0) {
      checkInstallationStatus();
    }
  }, [repositories]);

  const enabledRepositories = repositories.filter(repo => repo.isEnabled);
  const needsInstallation = enabledRepositories.filter(repo => !installationStatus[repo.fullName]);

  if (enabledRepositories.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" aria-busy={loading}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">GitHub App Installation</h3>
          <p className="text-sm text-gray-600">
            Install the GitHub App to enable bot comments on your repositories
          </p>
        </div>
        <button
          onClick={() => setShowInstallationModal(true)}
          className="btn-primary text-sm"
        >
          Manage Installation
        </button>
      </div>

      {/* Installation Status */}
      <div className="space-y-3">
        {enabledRepositories.map((repo) => (
          <div key={repo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {installationStatus[repo.fullName] ? (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                ) : (
                  <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{repo.fullName}</p>
                <p className="text-sm text-gray-500">
                  {installationStatus[repo.fullName] 
                    ? 'GitHub App installed - Bot comments enabled' 
                    : 'GitHub App not installed - Comments will appear under your name'
                  }
                </p>
              </div>
            </div>
            {!installationStatus[repo.fullName] && (
              <a
                href={getInstallationUrl(repo.fullName)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-sm"
              >
                Install App
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Installation Modal */}
      {showInstallationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Install GitHub App</h3>
              <button
                onClick={() => setShowInstallationModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
                <h4 className="font-medium text-primary-700 mb-2">Why install the GitHub App?</h4>
                <ul className="text-sm text-primary-700 space-y-1">
                  <li>• AI review comments appear under the bot&apos;s name</li>
                  <li>• Clear separation between human and AI comments</li>
                  <li>• Professional appearance for automated reviews</li>
                  <li>• Better user experience for your team</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Repositories that need installation:</h4>
                {needsInstallation.map((repo) => (
                  <div key={repo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{repo.fullName}</p>
                      <p className="text-sm text-gray-500">
                        {repo.private ? 'Private repository' : 'Public repository'}
                      </p>
                    </div>
                    <a
                      href={getInstallationUrl(repo.fullName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary text-sm"
                    >
                      Install App
                    </a>
                  </div>
                ))}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-2">Installation Instructions:</h4>
                <ol className="text-sm text-yellow-800 space-y-1">
                  <li>1. Click &quot;Install App&quot; for each repository above</li>
                  <li>2. You&apos;ll be redirected to GitHub&apos;s installation page</li>
                  <li>3. Choose &quot;All repositories&quot; or &quot;Only select repositories&quot;</li>
                  <li>4. Click &quot;Install&quot; to complete the setup</li>
                  <li>5. Return here and refresh to see the updated status</li>
                </ol>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowInstallationModal(false)}
                  className="btn-secondary"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    checkInstallationStatus();
                    setShowInstallationModal(false);
                    onInstallationComplete?.();
                  }}
                  className="btn-primary"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
