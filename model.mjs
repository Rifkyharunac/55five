// Methodology and policy rationale: RESEARCH.md. Thresholds are fixed policy,
// not significance tests or claims about the upstream game's randomness.
export const MODEL_VERSION = 2;
export const POLICY = Object.freeze({ train: 100, validation: 100, maxTests: 200,
  context: 20, prior: 20, brierGain: .01, accuracyGain: .03, margin: .10 });
const isBig = row => Number(row.number >= 5);
function adjacent(a,b) {
  return a.slice(0,8) === b.slice(0,8) && BigInt(b) - BigInt(a) === 1n;
}
export function candidate(history, issue) {
  const sample = history.slice(-POLICY.train);
  const baseline = (sample.reduce((sum,r)=>sum+isBig(r),0)+1)/(sample.length+2);
  const previous = sample.at(-1);
  const connected = Boolean(previous && adjacent(previous.issueNumber,issue));
  let count=0, big=0;
  if (connected) for(let i=1;i<sample.length;i++) {
    if(adjacent(sample[i-1].issueNumber,sample[i].issueNumber) && isBig(sample[i-1])===isBig(previous)) {
      count++;big+=isBig(sample[i]);
    }
  }
  return { probability:(big+POLICY.prior*baseline)/(count+POLICY.prior),
    baseline, count, connected, samples:sample.length };
}
export function walkForward(history) {
  const records=[];
  // Each target is excluded from its own training window; never shuffle time.
  for(let i=Math.max(POLICY.train,history.length-POLICY.maxTests);i<history.length;i++) {
    const model=candidate(history.slice(i-POLICY.train,i),history[i].issueNumber);
    if(!model.connected || model.count<POLICY.context) continue;
    const actual=isBig(history[i]);
    records.push({ issue:history[i].issueNumber, probability:model.probability,
      baseline:model.baseline, actual });
  }
  return records;
}
export function summarize(records) {
  if(!records.length) return {tested:0,wins:0,baselineWins:0,brier:null,baselineBrier:null};
  let wins=0,baselineWins=0,brier=0,baselineBrier=0;
  for(const r of records) {
    wins+=Number(Number(r.probability>=.5)===r.actual);
    baselineWins+=Number(Number(r.baseline>=.5)===r.actual);
    brier+=(r.probability-r.actual)**2;
    baselineBrier+=(r.baseline-r.actual)**2;
  }
  return {tested:records.length,wins,baselineWins,brier:brier/records.length,baselineBrier:baselineBrier/records.length};
}
export function evaluatePrediction(history,issue) {
  const current=candidate(history,issue);
  const records=walkForward(history);
  const evaluation=summarize(records);
  const recent=summarize(records.slice(-50));
  let reason='eligible';
  if(current.samples<POLICY.train || evaluation.tested<POLICY.validation) reason='insufficient';
  else if(!current.connected) reason='gap';
  else if(current.count<POLICY.context) reason='context';
  else if(evaluation.brier+POLICY.brierGain>=Math.min(.25,evaluation.baselineBrier) ||
    evaluation.wins/evaluation.tested<Math.max(.55,evaluation.baselineWins/evaluation.tested+POLICY.accuracyGain)) reason='baseline';
  else if(recent.brier>=Math.min(.25,recent.baselineBrier)) reason='unstable';
  else if(Math.abs(current.probability-.5)<POLICY.margin) reason='weak';
  return { modelVersion:MODEL_VERSION, label:reason==='eligible'?(current.probability>=.5?'Besar':'Kecil'):null,
    samples:current.samples,bigRate:current.probability,reason,evaluation };
}
