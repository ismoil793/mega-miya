'use client';

import { useState, useEffect } from 'react';

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stars: number;
  updatedAt: string;
  isEnabled: boolean;
}

interface RepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (repositories: string[]) => void;
}

export default function RepositoryModal({ isOpen, onClose, onSave }: RepositoryModalProps) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [githubAppInstallUrl, setGitHubAppInstallUrl] = useState('https://github.com/apps/mega-miyya/installations/new');

  useEffect(() => {
    if (isOpen) {
      fetchRepositories();
    }
  }, [isOpen]);

  const fetchRepositories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/repositories');
      const data = await response.json();
      
      if (response.ok) {
        setRepositories(data.repositories);
        setSelectedRepos(data.selectedRepositories);
        if (data.githubAppInstallUrl) setGitHubAppInstallUrl(data.githubAppInstallUrl);
      } else {
        setError(data.error || 'Failed to fetch repositories');
      }
    } catch (err) {
      setError('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/repositories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositories: selectedRepos }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        onSave(selectedRepos);
        onClose();
      } else {
        setError(data.error || 'Failed to save repositories');
      }
    } catch (err) {
      setError('Failed to save repositories');
    } finally {
      setSaving(false);
    }
  };

  const toggleRepository = (fullName: string) => {
    setSelectedRepos(prev => 
      prev.includes(fullName)
        ? prev.filter(repo => repo !== fullName)
        : [...prev, fullName]
    );
  };

  const toggleAll = () => {
    if (selectedRepos.length === filteredRepositories.length) {
      setSelectedRepos([]);
    } else {
      setSelectedRepos(filteredRepositories.map(repo => repo.fullName));
    }
  };

  const filteredRepositories = repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Select Repositories</h2>
            <p className="text-sm text-gray-600 mt-1">
              Choose which repositories to enable AI code reviews for
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading repositories...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchRepositories}
                className="btn-primary"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Select All */}
              {filteredRepositories.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRepos.length === filteredRepositories.length && filteredRepositories.length > 0}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-3 font-medium text-gray-900">
                      Select All ({selectedRepos.length}/{filteredRepositories.length})
                    </span>
                  </label>
                </div>
              )}

              {/* Repository List */}
              <div className="space-y-3">
                {filteredRepositories.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">📁</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchTerm ? 'No repositories found' : 'No repositories available'}
                    </h3>
                    <p className="text-gray-600">
                      {searchTerm 
                        ? 'Try adjusting your search terms'
                        : 'You need admin access to repositories to enable AI reviews'
                      }
                    </p>
                    {!searchTerm && (
                      <a
                        href={githubAppInstallUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary inline-block mt-4"
                      >
                        Install Mega-Miyya GitHub App
                      </a>
                    )}
                  </div>
                ) : (
                  filteredRepositories.map((repo) => (
                    <div
                      key={repo.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        selectedRepos.includes(repo.fullName)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <label className="flex items-start cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRepos.includes(repo.fullName)}
                          onChange={() => toggleRepository(repo.fullName)}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium text-gray-900">{repo.name}</h3>
                              <p className="text-sm text-gray-600">{repo.fullName}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              {repo.private && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Private
                                </span>
                              )}
                              {repo.language && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {repo.language}
                                </span>
                              )}
                              {repo.stars > 0 && (
                                <span className="inline-flex items-center text-sm text-gray-500">
                                  ⭐ {repo.stars}
                                </span>
                              )}
                            </div>
                          </div>
                          {repo.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {repo.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            Updated {new Date(repo.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </label>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {selectedRepos.length} repository{selectedRepos.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Selection'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
