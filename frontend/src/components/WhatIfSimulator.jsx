import styles from './WhatIfSimulator.module.css';

const SLIDER_CONFIG = [
  { key: 'duration', min: 6, max: 72, step: 1, label: 'Duration (months)' },
  { key: 'credit_amount', min: 250, max: 20000, step: 50, label: 'Credit Amount' },
  { key: 'age', min: 18, max: 75, step: 1, label: 'Age' },
  { key: 'installment_commitment', min: 1, max: 4, step: 1, label: 'Installment Commitment' },
  { key: 'existing_credits', min: 1, max: 4, step: 1, label: 'Existing Credits' },
  { key: 'num_dependents', min: 1, max: 2, step: 1, label: 'Dependents' },
];

export default function WhatIfSimulator({ formData, onScenarioChange, isEnabled, loading }) {
  return (
    <section className={styles.card}>
      <h2>What-If Simulator</h2>
      <p className={styles.subtitle}>
        Adjust sliders to trigger instant re-scoring and observe risk movement in real time.
      </p>

      <div className={styles.grid}>
        {SLIDER_CONFIG.map((slider) => (
          <label key={slider.key} className={styles.sliderField}>
            <div className={styles.topLine}>
              <span>{slider.label}</span>
              <strong>{formData[slider.key]}</strong>
            </div>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={formData[slider.key]}
              disabled={!isEnabled || loading}
              onChange={(e) => onScenarioChange(slider.key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      {!isEnabled ? <p className={styles.note}>Run the first assessment to activate simulation.</p> : null}
    </section>
  );
}
