'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useUserSettings } from '../../../lib/useUserSettings';
import { setSetting } from '../../../lib/userSettings';

interface Config {
    difficulty: 'easy' | 'medium' | 'hard';
    minGuesses: number;
    maxGuesses: number;
    numberLength: number;
}

interface PlayerStats {
    id: string;
    name: string;
    identityKind: 'account' | 'guest' | 'legacy-guest';
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
    vsHumanGames: number;
    vsHumanWins: number;
    vsBotGames: number;
    vsBotWins: number;
    averageGuesses: number;
    totalGuesses: number;
    fastestWin: number | null;
    slowestWin: number | null;
    recentGames: unknown[];
}

interface PlayerStatsResponse {
    accounts: PlayerStats[];
    guests: {
        current: PlayerStats[];
        legacy: PlayerStats[];
    };
}

function StatsTable({ players, formatDuration }: { players: PlayerStats[]; formatDuration: (ms: number | null) => string }) {
    if (players.length === 0) {
        return <p className="text-muted mb-0">No statistics available yet.</p>;
    }

    return (
        <div className="table-responsive">
            <table className="table table-striped table-hover mb-0">
                <thead className="table-dark">
                    <tr>
                        <th>Player</th>
                        <th>Games</th>
                        <th>Wins</th>
                        <th>Losses</th>
                        <th>Win Rate</th>
                        <th>Vs Human</th>
                        <th>Vs Bot</th>
                        <th>Avg Guesses</th>
                        <th>Fastest Win</th>
                    </tr>
                </thead>
                <tbody>
                    {players.map((player) => (
                        <tr key={`${player.identityKind}-${player.id}`}>
                            <td className="fw-bold">{player.name}</td>
                            <td>{player.totalGames}</td>
                            <td className="text-success">{player.wins}</td>
                            <td className="text-danger">{player.losses}</td>
                            <td>{player.winRate.toFixed(1)}%</td>
                            <td>{player.vsHumanWins}/{player.vsHumanGames}</td>
                            <td>{player.vsBotWins}/{player.vsBotGames}</td>
                            <td>{player.averageGuesses.toFixed(1)}</td>
                            <td>{formatDuration(player.fastestWin)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function AdminPage() {
    const t = useTranslations('admin');
    const [configs, setConfigs] = useState<Record<string, Config>>({});
    const [playerStats, setPlayerStats] = useState<PlayerStatsResponse>({
        accounts: [],
        guests: { current: [], legacy: [] },
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const { darkMode } = useUserSettings();
    const [selectedNumberLength, setSelectedNumberLength] = useState(4);
    const [activeTab, setActiveTab] = useState<'configs' | 'stats'>('configs');
    const [statsTab, setStatsTab] = useState<'accounts' | 'guests'>('accounts');
    const [statsLoading, setStatsLoading] = useState(false);

    const fetchConfigs = async () => {
        try {
            const response = await fetch('/api/admin/configs');
            const data = await response.json();
            setConfigs(data);
            setMessage({ type: '', text: '' });
        } catch (error) {
            setMessage({ type: 'error', text: t('errors.loadError') });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfigs();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/admin/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs }),
            });
            const result = await response.json();
            if (response.ok) {
                setMessage({ type: 'success', text: result.message });
            } else {
                setMessage({ type: 'error', text: t('errors.saveError') });
            }
        } catch (error) {
            setMessage({ type: 'error', text: t('errors.saveError') });
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (difficulty: string, field: string, value: number) => {
        setConfigs(prev => ({
            ...prev,
            [difficulty]: {
                ...prev[difficulty],
                [field]: value,
            },
        }));
    };

    const fetchPlayerStats = async () => {
        setStatsLoading(true);
        try {
            const response = await fetch('/api/admin/player-stats');
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load player stats');
            }
            if (!data || !Array.isArray(data.accounts) || !data.guests) {
                throw new Error('Unexpected player statistics response');
            }
            setPlayerStats({
                accounts: data.accounts,
                guests: {
                    current: Array.isArray(data.guests.current) ? data.guests.current : [],
                    legacy: Array.isArray(data.guests.legacy) ? data.guests.legacy : [],
                },
            });
            setMessage({ type: '', text: '' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to load player stats' });
        } finally {
            setStatsLoading(false);
        }
    };

    const formatDuration = (ms: number | null) => {
        if (!ms) return 'N/A';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (activeTab === 'stats') {
            fetchPlayerStats();
        }
    }, [activeTab]);

    if (loading) {
        return (
            <div className="container py-4">
                <div className="text-center">
                    <div className="spinner-border" role="status"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-4">
            {/* Navigation Header */}
            <nav className="navbar navbar-expand-lg mb-4 shadow-sm">
                <div className="container-fluid">
                    <Link href="/" className="text-decoration-none me-3">
                        <h1 className="display-4 fw-bold text-primary mb-0 mt-0 h-auto">
                            Guess<span className="text-info">X</span>
                        </h1>
                    </Link>

                    <div className="d-flex ms-auto">
                        <button
                            className="btn btn-sm btn-outline-secondary ms-2"
                            onClick={() => setSetting('darkMode', !darkMode)}
                        >
                            {darkMode ? '🌞' : '🌙'}
                        </button>
                    </div>
                </div>
            </nav>

            <div className="card shadow">
                <div className="card-header">
                    <h1 className="h3 mb-0">{t('title')}</h1>
                    <ul className="nav nav-tabs card-header-tabs mt-3">
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === 'configs' ? 'active' : ''}`}
                                onClick={() => setActiveTab('configs')}
                            >
                                Bot Configurations
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === 'stats' ? 'active' : ''}`}
                                onClick={() => setActiveTab('stats')}
                            >
                                Player Statistics
                            </button>
                        </li>
                    </ul>
                </div>
                <div className="card-body">
                    {message.text && (
                        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} mb-3`}>
                            {message.text}
                        </div>
                    )}

                    {activeTab === 'configs' && (
                        <>
                            {/* Number Length Selector */}
                            <div className="mb-4">
                                <label className="form-label fw-medium mb-3">{t('lengthSelector.label')}</label>
                                <div className="btn-group" role="group" style={{ marginLeft: '10px' }}>
                                    {[4, 5, 6].map(length => (
                                        <button
                                            key={length}
                                            type="button"
                                            className={`btn ${selectedNumberLength === length ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => setSelectedNumberLength(length)}
                                        >
                                            {length}-digit
                                        </button>
                                    ))}
                                </div>
                                <div className="form-text small text-muted mt-1">
                                    {t('lengthSelector.description', { length: selectedNumberLength })}
                                </div>
                            </div>

                            <div className="table-responsive">
                                <table className="table table-bordered">
                                    <thead className="table-dark">
                                        <tr>
                                            <th>{t('table.difficulty')}</th>
                                            <th>{t('table.minGuess')}</th>
                                            <th>{t('table.maxGuess')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {['easy', 'medium', 'hard'].map(difficulty => {
                                            const configKey = `${difficulty}_${selectedNumberLength}`;
                                            const config = configs[configKey] || {
                                                difficulty,
                                                minGuesses: difficulty === 'easy' ? (selectedNumberLength * 3) :
                                                    difficulty === 'medium' ? (selectedNumberLength * 2) :
                                                        (selectedNumberLength + 2),
                                                maxGuesses: difficulty === 'easy' ? (selectedNumberLength * 4) :
                                                    difficulty === 'medium' ? (selectedNumberLength * 3) :
                                                        (selectedNumberLength + 4),
                                                numberLength: selectedNumberLength
                                            };

                                            return (
                                                <tr key={configKey}>
                                                    <td className="fw-bold text-capitalize">{difficulty}</td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            value={config.minGuesses}
                                                            onChange={(e) => updateConfig(configKey, 'minGuesses', parseInt(e.target.value))}
                                                            min="1"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            value={config.maxGuesses}
                                                            onChange={(e) => updateConfig(configKey, 'maxGuesses', parseInt(e.target.value))}
                                                            min="1"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="d-flex justify-content-between align-items-center">
                                <button
                                    className="btn btn-secondary"
                                    onClick={fetchConfigs}
                                    disabled={loading}
                                >
                                    {t('buttons.refresh')}
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                            {t('buttons.saving')}
                                        </>
                                    ) : (
                                        t('buttons.save')
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    {activeTab === 'stats' && (
                        <>
                            {statsLoading ? (
                                <div className="text-center py-4">
                                    <div className="spinner-border" role="status"></div>
                                    <div className="mt-2">Loading player statistics...</div>
                                </div>
                            ) : (
                                <>
                                    <ul className="nav nav-pills mb-3" role="tablist">
                                        <li className="nav-item" role="presentation">
                                            <button
                                                type="button"
                                                className={`nav-link ${statsTab === 'accounts' ? 'active' : ''}`}
                                                onClick={() => setStatsTab('accounts')}
                                            >
                                                Accounts
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button
                                                type="button"
                                                className={`nav-link ${statsTab === 'guests' ? 'active' : ''}`}
                                                onClick={() => setStatsTab('guests')}
                                            >
                                                Guests
                                            </button>
                                        </li>
                                    </ul>

                                    {statsTab === 'accounts' ? (
                                        <StatsTable players={playerStats.accounts} formatDuration={formatDuration} />
                                    ) : (
                                        <div className="d-grid gap-4">
                                            <div className="alert alert-secondary mb-0">
                                                Guest statistics are admin-only operational data. They are grouped by display name and are never treated as account identity.
                                            </div>
                                            <section>
                                                <h2 className="h5">Current guest results</h2>
                                                <StatsTable players={playerStats.guests.current} formatDuration={formatDuration} />
                                            </section>
                                            <section>
                                                <h2 className="h5">Legacy guest results</h2>
                                                <p className="small text-muted">Results created before identity-aware persistence. They remain unattributed and cannot be claimed by a later account.</p>
                                                <StatsTable players={playerStats.guests.legacy} formatDuration={formatDuration} />
                                            </section>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="mt-3">
                                <button
                                    className="btn btn-secondary"
                                    onClick={fetchPlayerStats}
                                    disabled={statsLoading}
                                >
                                    Refresh Statistics
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
