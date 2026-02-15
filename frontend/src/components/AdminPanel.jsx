import styles from './AdminPanel.module.css';

function MetricTable({ title, rows, t }) {
  return (
    <div className={styles.block}>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className={styles.empty}>{t.noData}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.group}</th>
              <th>{t.count}</th>
              <th>{t.avgPd}</th>
              <th>{t.highRiskRate}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.group}>
                <td>{r.group}</td>
                <td>{r.count}</td>
                <td>{(r.avg_pd * 100).toFixed(1)}%</td>
                <td>{(r.high_risk_rate * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AdminPanel({
  role,
  t,
  modelInfo,
  fairness,
  auditLogs,
  auditMeta,
  auditPurposeFilter,
  onPurposeFilterChange,
  onPrevAuditPage,
  onNextAuditPage,
  canPrevAuditPage,
  canNextAuditPage,
}) {
  if (role === 'end_user') return null;

  return (
    <section className={styles.card}>
      <h2>{t.adminGovernanceTitle}</h2>

      <div className={styles.block}>
        <h3>{t.modelRegistryTitle}</h3>
        {modelInfo ? (
          <ul className={styles.metaList}>
            <li><strong>{t.version}:</strong> {modelInfo.model_version}</li>
            <li><strong>{t.artifact}:</strong> {modelInfo.artifact_path}</li>
            <li><strong>{t.lastTrained}:</strong> {modelInfo.last_trained_at ? new Date(modelInfo.last_trained_at).toLocaleString() : t.unknown}</li>
            <li><strong>{t.features}:</strong> {modelInfo.categorical_features.length + modelInfo.numerical_features.length}</li>
          </ul>
        ) : (
          <p className={styles.empty}>{t.noModelMetadata}</p>
        )}
      </div>

      <MetricTable title={t.fairnessByPersonalStatus} rows={fairness?.by_personal_status ?? []} t={t} />
      <MetricTable title={t.fairnessByForeignWorker} rows={fairness?.by_foreign_worker ?? []} t={t} />

      <div className={styles.block}>
        <h3>{t.auditLogsTitle}</h3>
        <div className={styles.auditControls}>
          <input
            value={auditPurposeFilter}
            onChange={(e) => onPurposeFilterChange(e.target.value)}
            placeholder={t.auditFilterPlaceholder}
          />
          <div className={styles.auditPager}>
            <button type="button" onClick={onPrevAuditPage} disabled={!canPrevAuditPage}>{t.prev}</button>
            <span>
              {auditMeta.total === 0 ? 0 : auditMeta.offset + 1}-{Math.min(auditMeta.offset + auditMeta.count, auditMeta.total)} {t.of} {auditMeta.total}
            </span>
            <button type="button" onClick={onNextAuditPage} disabled={!canNextAuditPage}>{t.nextPage}</button>
          </div>
        </div>
        {auditLogs.length === 0 ? (
          <p className={styles.empty}>{t.noLogsYet}</p>
        ) : (
          <div className={styles.auditWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t.id}</th>
                  <th>{t.time}</th>
                  <th>{t.pdPercent}</th>
                  <th>{t.model}</th>
                  <th>{t.purpose}</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>{(log.pd_score * 100).toFixed(1)}%</td>
                    <td>{log.model_version}</td>
                    <td>{log.input_payload?.purpose ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
