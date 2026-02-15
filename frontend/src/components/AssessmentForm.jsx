import styles from './AssessmentForm.module.css';
import { FORM_SELECT_OPTIONS } from '../constants/formOptions';

const STEP_GROUPS = [
  {
    title: 'Applicant Profile',
    fields: ['age', 'personal_status', 'job', 'employment', 'num_dependents', 'housing'],
  },
  {
    title: 'Credit Profile',
    fields: ['checking_status', 'credit_history', 'existing_credits', 'other_payment_plans', 'own_telephone', 'foreign_worker'],
  },
  {
    title: 'Loan Details',
    fields: ['purpose', 'credit_amount', 'duration', 'installment_commitment', 'savings_status', 'residence_since', 'other_parties', 'property_magnitude'],
  },
];

const FIELD_LABELS = {
  checking_status: 'Checking Status',
  duration: 'Duration (months)',
  credit_history: 'Credit History',
  purpose: 'Loan Purpose',
  credit_amount: 'Credit Amount',
  savings_status: 'Savings Status',
  employment: 'Employment Length',
  installment_commitment: 'Installment Commitment',
  personal_status: 'Personal Status',
  other_parties: 'Other Parties',
  residence_since: 'Residence Since',
  property_magnitude: 'Property Magnitude',
  age: 'Age',
  other_payment_plans: 'Other Payment Plans',
  housing: 'Housing',
  existing_credits: 'Existing Credits',
  job: 'Job',
  num_dependents: 'Dependents',
  own_telephone: 'Own Telephone',
  foreign_worker: 'Foreign Worker',
};

const NUMERIC_FIELDS = new Set([
  'duration',
  'credit_amount',
  'installment_commitment',
  'residence_since',
  'age',
  'existing_credits',
  'num_dependents',
]);

function renderInput(field, value, onChange) {
  if (FORM_SELECT_OPTIONS[field]) {
    return (
      <select
        className={styles.input}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
      >
        {FORM_SELECT_OPTIONS[field].map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className={styles.input}
      type="number"
      value={value}
      onChange={(e) => onChange(field, Number(e.target.value))}
      min={NUMERIC_FIELDS.has(field) ? 1 : undefined}
    />
  );
}

export default function AssessmentForm({
  formData,
  onFieldChange,
  onSubmit,
  currentStep,
  onStepChange,
  loading,
}) {
  const step = STEP_GROUPS[currentStep];

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h2>Assessment Form</h2>
        <p>Step {currentStep + 1} of {STEP_GROUPS.length}: {step.title}</p>
      </header>

      <div className={styles.grid}>
        {step.fields.map((field) => (
          <label key={field} className={styles.fieldGroup}>
            <span className={styles.label}>{FIELD_LABELS[field]}</span>
            {renderInput(field, formData[field], onFieldChange)}
          </label>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => onStepChange(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0 || loading}
          className={styles.secondary}
        >
          Previous
        </button>

        {currentStep < STEP_GROUPS.length - 1 ? (
          <button
            type="button"
            onClick={() => onStepChange(Math.min(STEP_GROUPS.length - 1, currentStep + 1))}
            disabled={loading}
            className={styles.primary}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className={styles.primary}
          >
            {loading ? 'Scoring...' : 'Assess Risk'}
          </button>
        )}
      </div>
    </section>
  );
}
