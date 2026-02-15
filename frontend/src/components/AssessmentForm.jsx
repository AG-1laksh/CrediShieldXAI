import styles from './AssessmentForm.module.css';
import { FORM_SELECT_OPTIONS } from '../constants/formOptions';

const STEP_GROUPS = [
  {
    title: 'Applicant',
    shortTitle: 'Profile',
    fields: ['age', 'personal_status', 'job', 'employment', 'num_dependents', 'housing'],
  },
  {
    title: 'History',
    shortTitle: 'Credit',
    fields: ['checking_status', 'credit_history', 'existing_credits', 'other_payment_plans', 'own_telephone', 'foreign_worker'],
  },
  {
    title: 'Financials',
    shortTitle: 'Loan',
    fields: ['purpose', 'credit_amount', 'duration', 'installment_commitment', 'savings_status', 'residence_since', 'other_parties', 'property_magnitude'],
  },
];

const FIELD_LABELS = {
  checking_status: 'Money in Checking Account',
  duration: 'Repayment Time (months)',
  credit_history: 'Past Repayment Record',
  purpose: 'Why You Need the Loan',
  credit_amount: 'Loan Amount',
  savings_status: 'Money in Savings',
  employment: 'Time in Current Employment',
  installment_commitment: 'Monthly Payment Burden',
  personal_status: 'Family / Personal Status',
  other_parties: 'Support from Other Person',
  residence_since: 'Time at Current Home',
  property_magnitude: 'Main Assets You Own',
  age: 'Age',
  other_payment_plans: 'Other Ongoing Payment Plans',
  housing: 'Living Situation',
  existing_credits: 'Current Active Loans',
  job: 'Work Type',
  num_dependents: 'People Depending on Your Income',
  own_telephone: 'Registered Telephone',
  foreign_worker: 'Foreign Worker Status',
};

const FIELD_MEANINGS = {
  checking_status: 'The balance range in your checking account.',
  duration: 'How many months you plan to take to repay this loan.',
  credit_history: 'How well you have repaid loans in the past.',
  purpose: 'What the loan will be used for.',
  credit_amount: 'The total amount of money you want to borrow.',
  savings_status: 'The balance range in your savings account.',
  employment: 'How long you have been in your current employment.',
  installment_commitment: 'How heavy your monthly loan payments are (from low to high).',
  personal_status: 'Your family/personal status used for credit profiling.',
  other_parties: 'Whether someone else (co-applicant/guarantor) supports this loan.',
  residence_since: 'How long you have lived in your current home.',
  property_magnitude: 'Your main property/asset type (for example home, car, etc.).',
  age: 'Your age in years.',
  other_payment_plans: 'Whether you already have other payment plans running.',
  housing: 'Your current living arrangement (rent/own/free).',
  existing_credits: 'How many active loans you currently have.',
  job: 'The type/skill level of your job.',
  num_dependents: 'How many people rely on your income.',
  own_telephone: 'Whether you have a registered telephone.',
  foreign_worker: 'Whether you are recorded as a foreign worker in this dataset.',
};

const OPTION_MEANINGS = {
  checking_status: {
    '<0': 'Balance is below 0.',
    '0<=X<200': 'Balance is between 0 and 200.',
    '>=200': 'Balance is 200 or more.',
    'no checking': 'No checking account information is available.',
  },
  savings_status: {
    '<100': 'Savings are below 100.',
    '100<=X<500': 'Savings are between 100 and 500.',
    '500<=X<1000': 'Savings are between 500 and 1000.',
    '>=1000': 'Savings are 1000 or more.',
    'no known savings': 'No savings information is available.',
  },
  employment: {
    unemployed: 'Currently not employed.',
    '<1': 'Employment duration is less than 1 year.',
    '1<=X<4': 'Employment duration is between 1 and 4 years.',
    '4<=X<7': 'Employment duration is between 4 and 7 years.',
    '>=7': 'Employment duration is 7 years or more.',
  },
  other_parties: {
    none: 'No co-applicant or guarantor is involved.',
    'co applicant': 'A co-applicant is applying with you.',
    guarantor: 'A guarantor backs the loan.',
  },
  housing: {
    rent: 'You currently rent your home.',
    own: 'You own your home.',
    'for free': 'You live without paying rent.',
  },
  own_telephone: {
    none: 'No registered telephone.',
    yes: 'Registered telephone available.',
  },
  foreign_worker: {
    yes: 'Recorded as a foreign worker in this dataset.',
    no: 'Not recorded as a foreign worker in this dataset.',
  },
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

export default function AssessmentForm({ formData, updateField, currentStep, setCurrentStep, onAssess, loading }) {
  const currentGroup = STEP_GROUPS[currentStep];
  const isLastStep = currentStep === STEP_GROUPS.length - 1;

  const handleChange = (field, e) => {
    let val = e.target.value;
    if (NUMERIC_FIELDS.has(field)) {
      val = Number(val);
    }
    updateField(field, val);
  };

  const renderField = (field) => {
    const options = FORM_SELECT_OPTIONS[field];
    const label = FIELD_LABELS[field] || field;
    const fieldMeaning = FIELD_MEANINGS[field];
    const selectedOptionMeaning = options ? OPTION_MEANINGS[field]?.[formData[field]] : null;

    return (
      <div key={field} className={styles.fieldGroup}>
        <label className={styles.label}>{label}</label>
        {fieldMeaning ? <p className={styles.helperText}>{fieldMeaning}</p> : null}
        {options ? (
          <>
            <select
              className={styles.select}
              value={formData[field]}
              onChange={(e) => handleChange(field, e)}
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {selectedOptionMeaning ? <p className={styles.optionHint}>{selectedOptionMeaning}</p> : null}
          </>
        ) : (
          <input
            className={styles.input}
            type="number"
            value={formData[field]}
            onChange={(e) => handleChange(field, e)}
          />
        )}
      </div>
    );
  };

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2>Risk Assessment</h2>
        <p>Complete the profile to generate an AI-powered risk score.</p>
      </div>

      <div className={styles.progressContainer}>
        {STEP_GROUPS.map((grp, idx) => {
           let nodeClass = styles.stepNode;
           if (idx < currentStep) nodeClass += ` ${styles.stepNodeCompleted}`;
           if (idx === currentStep) nodeClass += ` ${styles.stepNodeActive}`;
           
           return (
             <div key={idx} className={nodeClass}>
                <span>{idx + 1}</span>
                <span className={styles.stepLabel}>{grp.shortTitle}</span>
             </div>
           );
        })}
      </div>

      <div className={styles.formGrid}>
        {currentGroup.fields.map(renderField)}
      </div>

      <div className={styles.actions}>
        {currentStep > 0 && (
          <button className={styles.button} onClick={() => setCurrentStep((p) => p - 1)} disabled={loading}>
            Back
          </button>
        )}
        
        {!isLastStep ? (
          <button className={styles.submitButton} onClick={() => setCurrentStep((p) => p + 1)} disabled={loading}>
            Next Step
          </button>
        ) : (
          <button className={styles.submitButton} onClick={onAssess} disabled={loading}>
            {loading ? 'Analyzing...' : 'Assess Risk'}
          </button>
        )}
      </div>
    </section>
  );
}
