const FEATURE_LABELS_EN = {
  checking_status: 'Money in Checking Account',
  savings_status: 'Money in Savings',
  duration: 'Repayment Time',
  num__duration: 'Repayment Time',
  credit_amount: 'Loan Amount',
  num__credit_amount: 'Loan Amount',
  installment_commitment: 'Monthly Payment Burden',
  num__installment_commitment: 'Monthly Payment Burden',
  purpose: 'Why You Need the Loan',
};

const FEATURE_LABELS_HI = {
  checking_status: 'चेकिंग खाते में राशि',
  savings_status: 'बचत में राशि',
  duration: 'भुगतान समय',
  num__duration: 'भुगतान समय',
  credit_amount: 'लोन राशि',
  num__credit_amount: 'लोन राशि',
  installment_commitment: 'मासिक भुगतान भार',
  num__installment_commitment: 'मासिक भुगतान भार',
  purpose: 'लोन लेने का कारण',
};

export function getFeatureLabel(feature, language = 'en') {
  const dictionary = language === 'hi' ? FEATURE_LABELS_HI : FEATURE_LABELS_EN;
  if (dictionary[feature]) return dictionary[feature];
  const normalized = feature
    .replace('num__', '')
    .replaceAll('_', ' ')
    .trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function computeConfidence(prediction, language = 'en') {
  const hi = language === 'hi';
  const pd = prediction?.probability_of_default;
  if (typeof pd !== 'number') {
    return {
      band: 'Unknown',
      score: 0,
      rationale: hi ? 'विश्वसनीयता निकालने के लिए पहले आकलन चलाएँ।' : 'Run an assessment to calculate confidence.',
    };
  }

  const normalizedMargin = Math.min(1, Math.abs(pd - 0.5) * 2);
  const impacts = [
    ...(prediction?.top_risk_increasing ?? []).map((x) => Math.abs(x.impact)),
    ...(prediction?.top_risk_decreasing ?? []).map((x) => Math.abs(x.impact)),
  ].sort((a, b) => b - a);

  const totalImpact = impacts.reduce((sum, value) => sum + value, 0);
  const topTwo = (impacts[0] ?? 0) + (impacts[1] ?? 0);
  const topShare = totalImpact > 0 ? topTwo / totalImpact : 0.5;
  const score = 0.65 * normalizedMargin + 0.35 * topShare;

  if (score >= 0.72) {
    return {
      band: 'High',
      score,
      rationale: hi
        ? 'भविष्यवाणी निर्णय सीमा से काफ़ी दूर है और प्रमुख कारक एक दिशा में हैं।'
        : 'Prediction is far from the decision boundary and key factors are consistent.',
    };
  }
  if (score >= 0.48) {
    return {
      band: 'Medium',
      score,
      rationale: hi
        ? 'भविष्यवाणी काफ़ी स्थिर है, लेकिन मध्यम बदलाव से बदल सकती है।'
        : 'Prediction is reasonably stable but can change with moderate input shifts.',
    };
  }

  return {
    band: 'Low',
    score,
    rationale: hi
      ? 'भविष्यवाणी सीमा के पास है या कई प्रतिस्पर्धी कारकों में बंटी हुई है।'
      : 'Prediction is near the boundary or spread across many competing factors.',
  };
}

function addTip(tips, value) {
  if (!tips.includes(value)) {
    tips.push(value);
  }
}

export function generateRecommendations(formData, prediction, language = 'en') {
  if (!prediction) return [];

  const hi = language === 'hi';

  const tips = [];
  const increasing = prediction?.top_risk_increasing ?? [];
  const higherRiskSet = new Set(increasing.map((x) => x.feature));

  if (higherRiskSet.has('credit_amount') || higherRiskSet.has('num__credit_amount')) {
    const reduced = Math.max(250, Math.round((Number(formData.credit_amount) || 0) * 0.9));
    addTip(
      tips,
      hi
        ? `यदि संभव हो तो लोन राशि ₹${reduced.toLocaleString('en-IN')} के आसपास रखें।`
        : `Reduce loan amount closer to ₹${reduced.toLocaleString('en-IN')} if possible.`,
    );
  }

  if (higherRiskSet.has('duration') || higherRiskSet.has('num__duration')) {
    const shorter = Math.max(6, (Number(formData.duration) || 24) - 6);
    addTip(
      tips,
      hi
        ? `यदि संभव हो तो भुगतान समय लगभग ${shorter} महीने रखें।`
        : `Try a shorter repayment time around ${shorter} months if affordable.`,
    );
  }

  if (higherRiskSet.has('installment_commitment') || higherRiskSet.has('num__installment_commitment')) {
    addTip(
      tips,
      hi
        ? 'लोन राशि या अवधि समायोजित करके मासिक भुगतान भार कम करें।'
        : 'Lower monthly payment burden by adjusting loan amount or tenure balance.',
    );
  }

  if (higherRiskSet.has('savings_status')) {
    addTip(
      tips,
      hi
        ? 'आवेदन से पहले बचत श्रेणी बेहतर करें ताकि प्रोफ़ाइल मजबूत लगे।'
        : 'Move to a higher savings bucket before applying to improve trust profile.',
    );
  }

  if (higherRiskSet.has('checking_status')) {
    addTip(
      tips,
      hi
        ? 'आवेदन से पहले कुछ महीनों तक चेकिंग खाते में बेहतर बैलेंस रखें।'
        : 'Maintain a healthier checking account balance for a few months before application.',
    );
  }

  if (higherRiskSet.has('purpose')) {
    addTip(
      tips,
      hi
        ? 'यदि संभव हो तो कम-जोखिम/आवश्यक उपयोग वाला लोन उद्देश्य चुनें।'
        : 'If feasible, choose an essential/low-risk loan purpose category.',
    );
  }

  addTip(
    tips,
    hi
      ? 'अंतिम सबमिशन से पहले What-If सिम्युलेटर का उपयोग करें और परिदृश्य सहेजें।'
      : 'Use the What-If Simulator and save scenarios before final submission.',
  );

  return tips.slice(0, 5);
}

export function summarizeTopFactors(prediction, count = 2, language = 'en') {
  const factors = prediction?.top_risk_increasing ?? [];
  return factors.slice(0, count).map((item) => getFeatureLabel(item.feature, language)).join(', ') || 'N/A';
}

export function buildStoryNarrative(formData, prediction, language = 'en') {
  if (!prediction) return '';
  const hi = language === 'hi';
  const pd = prediction.probability_of_default;
  const topUp = (prediction.top_risk_increasing ?? []).slice(0, 2).map((f) => getFeatureLabel(f.feature, language));
  const topDown = (prediction.top_risk_decreasing ?? []).slice(0, 2).map((f) => getFeatureLabel(f.feature, language));

  if (hi) {
    return `आपका अनुमानित डिफॉल्ट जोखिम ${(pd * 100).toFixed(1)}% है। जोखिम बढ़ाने वाले मुख्य कारण: ${topUp.join(', ') || 'N/A'}। जोखिम कम करने वाले कारण: ${topDown.join(', ') || 'N/A'}। आवेदन में लोन राशि (₹${Number(formData.credit_amount || 0).toLocaleString('en-IN')}) और भुगतान अवधि (${formData.duration} महीने) का बड़ा प्रभाव दिखा।`;
  }

  return `Your estimated default risk is ${(pd * 100).toFixed(1)}%. Top risk-increasing drivers are ${topUp.join(', ') || 'N/A'}, while ${topDown.join(', ') || 'N/A'} helps reduce risk. In this application, loan amount (₹${Number(formData.credit_amount || 0).toLocaleString('en-IN')}) and repayment duration (${formData.duration} months) are influential.`;
}

export function rankImprovementActions(formData, prediction, language = 'en') {
  if (!prediction) return [];
  const hi = language === 'hi';
  const pd = prediction.probability_of_default;
  const rows = [];

  const amountDrop = Math.round((Number(formData.credit_amount) || 0) * 0.1);
  rows.push({
    action: hi ? `लोन राशि लगभग ₹${amountDrop.toLocaleString('en-IN')} कम करें` : `Reduce loan amount by about ₹${amountDrop.toLocaleString('en-IN')}`,
    delta: Math.min(0.08, pd * 0.18),
  });

  rows.push({
    action: hi ? 'पुनर्भुगतान अवधि 6 महीने घटाएँ' : 'Shorten repayment period by 6 months',
    delta: Math.min(0.06, pd * 0.14),
  });

  rows.push({
    action: hi ? 'बचत/बैंक बैलेंस श्रेणी बेहतर करें' : 'Improve savings/checking balance bucket',
    delta: Math.min(0.05, pd * 0.1),
  });

  return rows
    .sort((a, b) => b.delta - a.delta)
    .map((row, idx) => ({ rank: idx + 1, ...row, estimatedPd: Math.max(0, pd - row.delta) }));
}

export function buildCounterfactual(formData, prediction, language = 'en') {
  if (!prediction) return null;
  const hi = language === 'hi';
  const pd = prediction.probability_of_default;
  const newAmount = Math.max(250, Math.round((Number(formData.credit_amount) || 0) * 0.9));
  const newDuration = Math.max(6, (Number(formData.duration) || 24) - 6);
  const newPd = Math.max(0, pd - 0.07);

  return {
    text: hi
      ? `यदि लोन राशि ₹${newAmount.toLocaleString('en-IN')} और अवधि ${newDuration} महीने हो, तो अनुमानित PD ${(newPd * 100).toFixed(1)}% तक आ सकता है।`
      : `If loan amount is adjusted to ₹${newAmount.toLocaleString('en-IN')} and tenure to ${newDuration} months, estimated PD may improve to ${(newPd * 100).toFixed(1)}%.`,
    newPd,
  };
}
