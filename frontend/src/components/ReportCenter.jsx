import { useMemo, useState } from 'react';
import {
  createCase,
  createReportFromCase,
  createReportShareLink,
  fetchAuditPackage,
  listReports,
} from '../api/client';
import styles from './ReportCenter.module.css';

function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(rows, fileName) {
  const header = ['report_id', 'case_id', 'created_at', 'created_by', 'title', 'pd'];
  const lines = rows.map((r) => [
    r.id,
    r.case_id,
    r.created_at,
    r.created_by,
    String(r.title ?? '').replaceAll(',', ' '),
    r.report_payload?.case?.prediction_payload?.probability_of_default ?? '',
  ].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportCenter({ role, t, formData, prediction }) {
  if (role === 'end_user') return null;

  const [caseIdInput, setCaseIdInput] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shareLinks, setShareLinks] = useState({});

  const canCreate = Boolean(prediction);
  const selectedCaseId = useMemo(() => Number(caseIdInput || 0), [caseIdInput]);

  const createCaseAndReport = async () => {
    if (!canCreate) return;

    setLoading(true);
    setError('');
    try {
      const created = await createCase({
        applicant_payload: formData,
        auto_predict: true,
      });
      const caseId = created.case.id;
      setCaseIdInput(String(caseId));
      await createReportFromCase(caseId, `Case ${caseId} Report`);
      const listed = await listReports(caseId);
      setReports(listed.entries ?? []);
    } catch (e) {
      setError(e.message || 'Unable to create report.');
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    if (!selectedCaseId) return;
    setLoading(true);
    setError('');
    try {
      const listed = await listReports(selectedCaseId);
      setReports(listed.entries ?? []);
    } catch (e) {
      setError(e.message || 'Unable to fetch reports.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (reportId) => {
    setError('');
    try {
      const res = await createReportShareLink(reportId, 60);
      setShareLinks((prev) => ({ ...prev, [reportId]: res.share_url }));
    } catch (e) {
      setError(e.message || 'Unable to create share link.');
    }
  };

  const handleDownloadPdf = async (report) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    let y = 14;

    const write = (line, step = 7) => {
      doc.text(String(line), 14, y);
      y += step;
    };

    write(report.title, 10);
    write(`Case ID: ${report.case_id}`);
    write(`Created: ${new Date(report.created_at).toLocaleString()}`);
    write(`Created by: ${report.created_by}`);
    y += 2;

    const casePayload = report.report_payload?.case;
    const pd = casePayload?.prediction_payload?.probability_of_default;
    write(`Status: ${casePayload?.status ?? 'N/A'}`);
    if (typeof pd === 'number') {
      write(`PD Score: ${(pd * 100).toFixed(1)}%`);
    }

    write('--- Applicant Snapshot ---');
    Object.entries(casePayload?.applicant_payload ?? {}).slice(0, 12).forEach(([k, v]) => write(`${k}: ${v}`, 6));

    doc.save(`case_${report.case_id}_report_${report.id}.pdf`);
  };

  const handleDownloadAuditPackage = async () => {
    if (!selectedCaseId) return;
    setLoading(true);
    setError('');
    try {
      const pkg = await fetchAuditPackage(selectedCaseId);
      downloadJson(pkg, `case_${selectedCaseId}_audit_package.json`);
    } catch (e) {
      setError(e.message || 'Unable to export audit package.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.card}>
      <h2>{t.reportCenterTitle ?? 'Report Center'}</h2>
      <p>{t.reportCenterSubtitle ?? 'Create, download, and share case reports with expiring links.'}</p>

      <div className={styles.controls}>
        <button type="button" className={styles.primaryBtn} onClick={createCaseAndReport} disabled={!canCreate || loading}>
          {t.createCaseReport ?? 'Create Case + Report'}
        </button>

        <input
          type="number"
          min="1"
          value={caseIdInput}
          onChange={(e) => setCaseIdInput(e.target.value)}
          placeholder={t.caseIdPlaceholder ?? 'Case ID'}
        />

        <button type="button" className={styles.secondaryBtn} onClick={loadReports} disabled={!selectedCaseId || loading}>
          {t.loadReports ?? 'Load Reports'}
        </button>

        <button type="button" className={styles.secondaryBtn} onClick={handleDownloadAuditPackage} disabled={!selectedCaseId || loading}>
          {t.downloadAuditPackage ?? 'Download Audit Package'}
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <h3>{t.caseReportHistory ?? 'Case Report History'}</h3>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => downloadCsv(reports, `case_${selectedCaseId || 'reports'}_history.csv`)}
            disabled={reports.length === 0}
          >
            {t.downloadCaseCsv ?? 'Download Case CSV'}
          </button>
        </div>

        {reports.length === 0 ? (
          <p className={styles.empty}>{t.noReportsYet ?? 'No reports found for this case yet.'}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t.time ?? 'Time'}</th>
                  <th>{t.pdPercent ?? 'PD%'}</th>
                  <th>{t.actionsLabel ?? 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const pd = report.report_payload?.case?.prediction_payload?.probability_of_default;
                  return (
                    <tr key={report.id}>
                      <td>{report.id}</td>
                      <td>{new Date(report.created_at).toLocaleString()}</td>
                      <td>{typeof pd === 'number' ? `${(pd * 100).toFixed(1)}%` : '—'}</td>
                      <td className={styles.rowActions}>
                        <button type="button" className={styles.secondaryBtn} onClick={() => handleDownloadPdf(report)}>
                          {t.downloadPdfBtn ?? 'PDF'}
                        </button>
                        <button type="button" className={styles.secondaryBtn} onClick={() => handleShare(report.id)}>
                          {t.createShareLinkBtn ?? 'Share'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {Object.entries(shareLinks).map(([reportId, link]) => (
        <p key={reportId} className={styles.shareLink}>
          {t.shareLinkLabel ?? 'Share Link'} #{reportId}: <a href={link} target="_blank" rel="noreferrer">{link}</a>
        </p>
      ))}
    </section>
  );
}
