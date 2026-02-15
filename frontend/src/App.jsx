import { useEffect, useState } from 'react';
import { predictRisk } from './api/client';
import AssessmentForm from './components/AssessmentForm';
import WhatIfSimulator from './components/WhatIfSimulator';
import XAIVisualization from './components/XAIVisualization';
import { DEFAULT_FORM_VALUES } from './constants/formOptions';
import styles from './App.module.css';

function App() {
  const [formData, setFormData] = useState(DEFAULT_FORM_VALUES);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const runPrediction = async (payload) => {
    setLoading(true);
    setError('');
    try {
      const result = await predictRisk(payload);
      setPrediction(result);
      return result;
    } catch (err) {
      console.error('runPrediction failed in App', err);
      setError(err.message || 'Prediction failed unexpectedly.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleAssessRisk = async () => {
    const result = await runPrediction(formData);
    if (result) {
      setSimulationEnabled(true);
      setDrawerOpen(true);
    }
  };

  useEffect(() => {
    if (!simulationEnabled) {
      return;
    }

    const timeoutId = setTimeout(() => {
      runPrediction(formData);
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [formData, simulationEnabled]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>CrediShield XAI</h1>
        <p>Premium explainable credit intelligence with real-time scenario simulation.</p>
      </header>

      <div className={styles.statusRow}>
        <span className={styles.badge}>{simulationEnabled ? 'What-If Unlocked' : 'Assessment Mode'}</span>
        <span className={styles.backend}>Backend: http://127.0.0.1:8000</span>
        {error ? <span className={styles.error}>{error}</span> : null}
      </div>

      <main className={styles.layout}>
        <AssessmentForm
          formData={formData}
          onFieldChange={updateField}
          onSubmit={handleAssessRisk}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          loading={loading}
        />

        <XAIVisualization prediction={prediction} loading={loading} />
      </main>

      {simulationEnabled ? (
        <button
          type="button"
          className={styles.drawerToggle}
          onClick={() => setDrawerOpen((prev) => !prev)}
        >
          {drawerOpen ? 'Hide What-If Simulator' : 'Open What-If Simulator'}
        </button>
      ) : null}

      {simulationEnabled ? (
        <aside className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
          <WhatIfSimulator
            formData={formData}
            onScenarioChange={updateField}
            isEnabled={simulationEnabled}
            loading={loading}
          />
        </aside>
      ) : null}
    </div>
  );
}

export default App;
