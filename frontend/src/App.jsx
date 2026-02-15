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
        <h1>CrediShield XAI Dashboard</h1>
        <p>Explainable credit-risk scoring with SHAP reason codes and live What-If simulation.</p>
      </header>

      <div className={styles.statusRow}>
        <span className={styles.badge}>{simulationEnabled ? 'Simulation Active' : 'Assessment Mode'}</span>
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

        <XAIVisualization prediction={prediction} />

        <WhatIfSimulator
          formData={formData}
          onScenarioChange={updateField}
          isEnabled={simulationEnabled}
          loading={loading}
        />
      </main>
    </div>
  );
}

export default App;
