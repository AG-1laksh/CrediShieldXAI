import { useState } from 'react';
import styles from './BatchScoringPanel.module.css';

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? '';
    });
    return obj;
  });
}

export default function BatchScoringPanel({ role, onRunBatch, loading, t }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (role === 'end_user') return null;

  const handleFile = async (file) => {
    setError('');
    setResult(null);
    if (!file) return;

    setFileName(file.name);
    const content = await file.text();
    const parsed = parseCsv(content);
    setRows(parsed);
    if (!parsed.length) {
      setError(t.csvParseFailed);
    }
  };

  const handleRun = async () => {
    setError('');
    setResult(null);
    try {
      const output = await onRunBatch(rows);
      setResult(output);
    } catch (e) {
      setError(e.message || t.batchScoringFailed);
    }
  };

  const handleDownload = () => {
    if (!result?.results?.length) return;
    const header = ['index', 'probability_of_default'];
    const lines = result.results.map((row) => `${row.index},${row.probability_of_default}`);
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_results_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className={styles.card}>
      <h2>{t.batchTitle}</h2>
      <p>{t.batchSubtitle}</p>

      <label className={styles.fileInputWrap}>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      <div className={styles.metaRow}>
        <span>{fileName || t.noFileSelected}</span>
        <span>{rows.length} {t.rowsSuffix}</span>
      </div>

      <button type="button" disabled={loading || rows.length === 0} className={styles.runBtn} onClick={handleRun}>
        {t.runBatchScoring}
      </button>

      {error ? <p className={styles.error}>{error}</p> : null}

      {result ? (
        <div className={styles.resultBox}>
          <strong>{t.processedRows}: {result.count} {t.rowsSuffix}</strong>
          <ul>
            {result.results.slice(0, 5).map((row) => (
              <li key={row.index}>{t.rowLabel} {row.index + 1}: {(row.probability_of_default * 100).toFixed(1)}% PD</li>
            ))}
          </ul>
          {result.results.length > 5 ? <em>{t.showingFirstRows}</em> : null}
          <button type="button" className={styles.downloadBtn} onClick={handleDownload}>
            {t.downloadResultCsv}
          </button>
        </div>
      ) : null}
    </section>
  );
}
