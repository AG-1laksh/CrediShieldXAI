import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styles from './XAIVisualization.module.css';

function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function buildWaterfallData(prediction) {
  const items = [
    ...(prediction?.top_risk_increasing ?? []).map((item) => ({ ...item, direction: 'up' })),
    ...(prediction?.top_risk_decreasing ?? []).map((item) => ({ ...item, direction: 'down' })),
  ];

  return items.map((item) => ({
    feature: item.feature,
    impact: item.impact,
    impactAbs: Math.abs(item.impact),
    color: item.direction === 'up' ? '#ef4444' : '#10b981',
  }));
}

export default function XAIVisualization({ prediction }) {
  if (!prediction) {
    return (
      <section className={styles.card}>
        <h2>XAI Visualization</h2>
        <p className={styles.empty}>Run an assessment to view risk gauge and SHAP waterfall.</p>
      </section>
    );
  }

  const pd = prediction.probability_of_default;
  const gaugeData = [{ name: 'PD', value: pd * 100, fill: pd >= 0.5 ? '#ef4444' : '#22c55e' }];
  const waterfallData = buildWaterfallData(prediction);

  return (
    <section className={styles.card}>
      <h2>XAI Visualization</h2>

      <div className={styles.panels}>
        <div className={styles.panel}>
          <h3>Risk Gauge</h3>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={240}>
              <RadialBarChart
                cx="50%"
                cy="85%"
                innerRadius="65%"
                outerRadius="100%"
                barSize={20}
                data={gaugeData}
                startAngle={180}
                endAngle={0}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <p className={styles.score}>{formatPct(pd)} PD</p>
          </div>
        </div>

        <div className={styles.panel}>
          <h3>SHAP Waterfall</h3>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={waterfallData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="feature" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={65} />
                <YAxis />
                <Tooltip formatter={(value) => Number(value).toFixed(4)} />
                <Bar dataKey="impactAbs" name="|SHAP Impact|">
                  {waterfallData.map((entry) => (
                    <Cell key={entry.feature} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.reasons}>
        <div>
          <h4>Top Risk-Increasing</h4>
          <ul>
            {(prediction.top_risk_increasing ?? []).map((r) => (
              <li key={`inc-${r.feature}`}>{r.feature}: +{r.impact.toFixed(4)}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Top Risk-Decreasing</h4>
          <ul>
            {(prediction.top_risk_decreasing ?? []).map((r) => (
              <li key={`dec-${r.feature}`}>{r.feature}: {r.impact.toFixed(4)}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
