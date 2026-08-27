import React, { useMemo, useState } from 'react'
import { project } from './calc.js'

const usd = (n, dp = 0) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: dp, minimumFractionDigits: dp })

const DEFAULTS = {
  price: 800000,
  down: 175000,
  rate: 0.0655,
  termYears: 30,
  propTaxRate: 0.011,
  propTaxGrowth: 0.02,
  hoa: 1007,
  hoaGrowth: 0.055,
  ho6Annual: 600,
  ho6Growth: 0,
  pge: 200,
  pgeGrowth: 0,
  income: 300000,
  filing: 'single',
  fedRate: 0.35,
  caRate: 0.093,
  saltCap: 40000,
  years: 5,
}

// field: [key, label, kind] where kind is 'usd' | 'pct' | 'num'
const GROUPS = [
  {
    title: 'Purchase & Loan',
    fields: [
      ['price', 'Condo price', 'usd'],
      ['down', 'Down payment', 'usd'],
      ['rate', 'Interest rate', 'pct'],
      ['termYears', 'Loan term (years)', 'num'],
    ],
  },
  {
    title: 'Recurring Costs (monthly unless noted)',
    fields: [
      ['hoa', 'HOA', 'usd'],
      ['pge', 'PG&E / utilities', 'usd'],
      ['ho6Annual', 'HO-6 insurance (annual)', 'usd'],
      ['propTaxRate', 'Property tax rate', 'pct'],
    ],
  },
  {
    title: 'Annual Growth Rates',
    fields: [
      ['hoaGrowth', 'HOA growth', 'pct'],
      ['propTaxGrowth', 'Property tax growth', 'pct'],
      ['pgeGrowth', 'PG&E growth', 'pct'],
      ['ho6Growth', 'Insurance growth', 'pct'],
    ],
  },
  {
    title: 'Taxes',
    fields: [
      ['income', 'Annual income', 'usd'],
      ['fedRate', 'Federal marginal rate', 'pct'],
      ['caRate', 'CA marginal rate', 'pct'],
      ['saltCap', 'SALT cap', 'usd'],
    ],
  },
]

function Field({ fieldKey, label, kind, value, onChange }) {
  // Percent fields are stored as decimals but shown/edited as percents.
  const display = kind === 'pct' ? +(value * 100).toFixed(4) : value
  const step = kind === 'pct' ? 0.05 : kind === 'usd' ? 1000 : 1
  const handle = (e) => {
    const raw = e.target.value
    if (raw === '') return onChange(fieldKey, 0)
    const num = parseFloat(raw)
    if (Number.isNaN(num)) return
    onChange(fieldKey, kind === 'pct' ? num / 100 : num)
  }
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="input-wrap">
        {kind === 'usd' && <span className="adorn adorn-left">$</span>}
        <input
          type="number"
          value={display}
          step={step}
          onChange={handle}
          className={kind === 'usd' ? 'has-left' : kind === 'pct' ? 'has-right' : ''}
        />
        {kind === 'pct' && <span className="adorn adorn-right">%</span>}
      </div>
    </label>
  )
}

export default function App() {
  const [inp, setInp] = useState(DEFAULTS)
  const update = (key, val) => setInp((s) => ({ ...s, [key]: val }))
  const reset = () => setInp(DEFAULTS)

  const result = useMemo(() => project(inp), [inp])
  const y1 = result.rows[0]

  return (
    <div className="app">
      <header className="header">
        <h1>Condo Cost Calculator</h1>
        <p className="sub">
          Live monthly carrying cost after property tax, insurance, HOA, utilities and tax
          deductions — with a multi-year projection. Every field is editable.
        </p>
      </header>

      <div className="layout">
        <section className="inputs">
          {GROUPS.map((g) => (
            <div className="group" key={g.title}>
              <h2>{g.title}</h2>
              <div className="grid">
                {g.fields.map(([k, label, kind]) => (
                  <Field key={k} fieldKey={k} label={label} kind={kind} value={inp[k]} onChange={update} />
                ))}
              </div>
            </div>
          ))}
          <div className="group">
            <h2>Projection</h2>
            <div className="grid">
              <label className="field">
                <span className="field-label">Filing status</span>
                <div className="input-wrap">
                  <select value={inp.filing} onChange={(e) => update('filing', e.target.value)}>
                    <option value="single">Single</option>
                    <option value="mfj">Married filing jointly</option>
                  </select>
                </div>
              </label>
              <Field fieldKey="years" label="Years to project" kind="num" value={inp.years} onChange={update} />
            </div>
          </div>
          <button className="reset" onClick={reset}>Reset to defaults</button>
        </section>

        <section className="outputs">
          <div className="hero">
            <div className="hero-card primary">
              <span className="hero-label">Year 1 gross / month</span>
              <span className="hero-value">{usd(y1.gross)}</span>
              <span className="hero-note">actual cash out the door</span>
            </div>
            <div className="hero-card accent">
              <span className="hero-label">Year 1 net / month</span>
              <span className="hero-value">{usd(y1.net)}</span>
              <span className="hero-note">after est. tax savings</span>
            </div>
          </div>

          <div className="stats">
            <Stat label="Loan amount" value={usd(result.loan)} />
            <Stat label="Down payment %" value={`${((inp.down / inp.price) * 100).toFixed(1)}%`} />
            <Stat label="Monthly P&I" value={usd(result.monthlyPI)} />
            <Stat label="Est. tax savings / mo" value={usd(y1.taxSaveM)} />
          </div>

          <div className="breakdown">
            <h2>Year 1 monthly breakdown</h2>
            <Row label="Mortgage (P&I)" value={y1.pi} />
            <Row label="Property tax" value={y1.propTaxM} />
            <Row label="HOA" value={y1.hoa} />
            <Row label="HO-6 insurance" value={y1.ho6M} />
            <Row label="PG&E / utilities" value={y1.pge} />
            <Row label="Gross monthly" value={y1.gross} strong />
            <Row label="Tax savings" value={-y1.taxSaveM} muted />
            <Row label="Net effective monthly" value={y1.net} strong accent />
          </div>

          <div className="table-wrap">
            <h2>{inp.years}-year projection</h2>
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>P&I</th>
                  <th>Prop tax</th>
                  <th>HOA</th>
                  <th>Tax save</th>
                  <th>Gross/mo</th>
                  <th>Net/mo</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.year}>
                    <td>{r.year}</td>
                    <td>{usd(r.pi)}</td>
                    <td>{usd(r.propTaxM)}</td>
                    <td>{usd(r.hoa)}</td>
                    <td className="muted">−{usd(r.taxSaveM)}</td>
                    <td>{usd(r.gross)}</td>
                    <td className="accent-text">{usd(r.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="disclaimer">
            Tax savings are realized annually (smaller tax bill / larger refund), not as reduced
            monthly checks — your real out-of-pocket is the gross figure. Marginal rates, SALT cap,
            and property-tax rate are editable estimates; verify against your actual situation.
          </p>
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

function Row({ label, value, strong, accent, muted }) {
  return (
    <div className={`brow${strong ? ' strong' : ''}${accent ? ' accent-row' : ''}`}>
      <span>{label}</span>
      <span className={muted ? 'muted' : ''}>{usd(value)}</span>
    </div>
  )
}
