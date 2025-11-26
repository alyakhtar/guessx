'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import LocaleSelector from '../../../components/LocaleSelector';

interface Config {
    difficulty: 'easy' | 'medium' | 'hard';
    minGuesses: number;
    maxGuesses: number;
    numberLength: number;
}

export default function AdminPage() {
    const t = useTranslations('admin');
    const locale = useLocale();
    const [configs, setConfigs] = useState<Record<string, Config>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [darkMode, setDarkMode] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [selectedNumberLength, setSelectedNumberLength] = useState(4);

    useEffect(() => {
        fetchConfigs();
        // Load saved dark mode preference from localStorage
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode !== null) {
            setDarkMode(savedDarkMode === 'true');
        }
        setMounted(true);
    }, []);

    const handleDarkModeToggle = () => {
        const newDarkMode = !darkMode;
        setDarkMode(newDarkMode);
        localStorage.setItem('darkMode', newDarkMode.toString());
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

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
                    <Link href={`/${locale}`} className="text-decoration-none me-3">
                        <h1 className="display-4 fw-bold text-primary mb-0 mt-0 h-auto">
                            Guess<span className="text-info">X</span>
                        </h1>
                    </Link>

                    <div className="d-flex ms-auto">
                        <LocaleSelector />
                        <button
                            className="btn btn-sm btn-outline-secondary ms-2"
                            onClick={handleDarkModeToggle}
                        >
                            {darkMode ? '🌞' : '🌙'}
                        </button>
                    </div>
                </div>
            </nav>

            <div className="card shadow">
                <div className="card-header">
                    <h1 className="h3 mb-0">{t('title')}</h1>
                </div>
                <div className="card-body">
                    {message.text && (
                        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} mb-3`}>
                            {message.text}
                        </div>
                    )}

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
                </div>
            </div>
        </div>
    );
}
