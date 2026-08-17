import './style.css';
import { formatChips } from './chips';
import { money, percent, signedCount } from './format';
import { DEFAULT_PARAMS, ramp, recommend, validate, type Params, type RampRange, type Recommendation } from './model';

const STORAGE_KEY = 'blackjack-betting-strategy/params';

const LIMIT_LABEL: Record<Recommendation['limit'], string> = {
  'table-min': 'Table minimum',
  heat: 'Heat ramp',
  kelly: 'Kelly',
  'table-max': 'Table maximum',
};

function input(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) throw new Error(`Missing input: ${id}`);
  return element;
}

function select(id: string): HTMLSelectElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLSelectElement)) throw new Error(`Missing select: ${id}`);
  return element;
}

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found;
}

function readParams(): Params {
  return {
    bankroll: input('bankroll').valueAsNumber,
    kellyFraction: input('kellyFraction').valueAsNumber / 100,
    minBet: input('minBet').valueAsNumber,
    maxBet: input('maxBet').valueAsNumber,
    edgeAtZero: input('edgeAtZero').valueAsNumber / 100,
    edgePerTrueCount: input('edgePerTrueCount').valueAsNumber / 100,
    variance: input('variance').valueAsNumber,
    twoHandFactor: input('twoHandFactor').valueAsNumber,
    twoHandTrigger: input('twoHandTrigger').valueAsNumber / 100,
    heatCount: input('heatCount').valueAsNumber,
    simplifyBets: input('simplifyBets').checked,
    maxChips: Number(select('maxChips').value),
    evenDollars: input('evenDollars').checked,
    rounding: input('roundDown').checked ? 'down' : 'nearest',
  };
}

function writeParams(p: Params): void {
  input('bankroll').value = String(p.bankroll);
  input('kellyFraction').value = String(Math.round(p.kellyFraction * 100));
  input('minBet').value = String(p.minBet);
  input('maxBet').value = String(p.maxBet);
  input('edgeAtZero').value = String(p.edgeAtZero * 100);
  input('edgePerTrueCount').value = String(p.edgePerTrueCount * 100);
  input('variance').value = String(p.variance);
  input('twoHandFactor').value = String(p.twoHandFactor);
  input('twoHandTrigger').value = String(Math.round(p.twoHandTrigger * 100));
  input('heatCount').value = String(p.heatCount);
  input('simplifyBets').checked = p.simplifyBets;
  select('maxChips').value = String(p.maxChips);
  input('evenDollars').checked = p.evenDollars;
  input('roundDown').checked = p.rounding === 'down';
  select('maxChips').disabled = !p.simplifyBets;
}

function readRange(): RampRange {
  return {
    from: input('rampFrom').valueAsNumber,
    to: input('rampTo').valueAsNumber,
    step: input('rampStep').valueAsNumber,
  };
}

function load(): Params {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PARAMS;
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PARAMS;
    return { ...DEFAULT_PARAMS, ...(parsed as Partial<Params>) };
  } catch {
    return DEFAULT_PARAMS;
  }
}

function save(p: Params): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (private mode); settings simply do not persist.
  }
}

function describe(r: Recommendation): string {
  if (r.hands === 2) return `2 hands × ${money(r.betPerHand)}`;
  return `1 hand × ${money(r.betPerHand)}`;
}

function renderRecommendation(p: Params, trueCount: number): void {
  const r = recommend(p, trueCount);
  const target = element('recommendation');
  target.innerHTML = '';

  const headline = document.createElement('div');
  headline.className = 'headline';
  headline.textContent = describe(r);

  const detail = document.createElement('dl');
  const rows: [string, string][] = [
    ['Total on the felt', money(r.totalWagered)],
    ['Chips per hand', formatChips(r.chips) || '—'],
    ['Edge', percent(r.edge)],
    ['Full Kelly', money(r.fullKelly)],
    ['% of full Kelly', percent(r.kellyRatio, 0)],
    ['Limited by', LIMIT_LABEL[r.limit]],
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    detail.append(dt, dd);
  }

  target.append(headline, detail);
}

function renderRamp(p: Params, range: RampRange, currentCount: number): void {
  const body = document.querySelector<HTMLTableSectionElement>('#ramp tbody');
  if (!body) return;
  body.innerHTML = '';

  for (const r of ramp(p, range)) {
    const row = document.createElement('tr');
    if (Math.abs(r.trueCount - currentCount) < 1e-9) row.className = 'current';

    const cells = [
      signedCount(r.trueCount),
      percent(r.edge),
      money(r.kelly),
      Number.isFinite(r.heatCap) ? money(r.heatCap) : '—',
      money(r.betPerHand),
      String(r.hands),
      money(r.totalWagered),
      formatChips(r.chips) || '—',
      percent(r.kellyRatio, 0),
      LIMIT_LABEL[r.limit],
    ];
    for (const text of cells) {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.append(cell);
    }
    body.append(row);
  }
}

function renderWarnings(messages: string[]): void {
  const box = element('warnings');
  box.innerHTML = '';
  box.hidden = messages.length === 0;
  for (const message of messages) {
    const line = document.createElement('div');
    line.textContent = message;
    box.append(line);
  }
}

function update(): void {
  const p = readParams();
  const range = readRange();
  const currentCount = input('currentCount').valueAsNumber;

  select('maxChips').disabled = !p.simplifyBets;

  const warnings = validate(p);
  renderWarnings(warnings);

  const fatal = p.bankroll <= 0 || p.minBet <= 0 || p.maxBet < p.minBet || p.variance <= 0 || p.twoHandFactor <= 0;
  if (fatal || !Number.isFinite(currentCount)) {
    element('recommendation').textContent = 'Fix the settings above to see a recommendation.';
    const body = document.querySelector<HTMLTableSectionElement>('#ramp tbody');
    if (body) body.innerHTML = '';
    return;
  }

  renderRecommendation(p, currentCount);
  renderRamp(p, range, currentCount);
  save(p);
}

writeParams(load());
update();

for (const target of [element('settings'), element('currentCount')]) {
  target.addEventListener('input', update);
  target.addEventListener('change', update);
}

element('reset').addEventListener('click', () => {
  writeParams(DEFAULT_PARAMS);
  update();
});
