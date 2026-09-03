import React, { useEffect, useMemo, useState } from 'react'
import { project, projectRent, projectRentOut, remainingBalance } from './calc.js'

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
  ho6Annual: 1299,
  ho6Growth: 0.06,
  pge: 200,
  pgeGrowth: 0.08,
  income: 300000,
  filing: 'single',
  caRate: 0.093,
  saltCap: 40000,
  years: 30,
}

const RENT_DEFAULTS = {
  rent: 6369,
  pge: 200,
  trash: 44.87,
  water: 188.48,
  rentGrowth: 0.02,
  pgeGrowth: 0.08,
  trashGrowth: 0.05,
  waterGrowth: 0.05,
  years: 30,
}

const RENT_GROUPS = [
  {
    title: 'Current Monthly Costs',
    fields: [
      ['rent', 'Rent', 'usd'],
      ['pge', 'PG&E / utilities', 'usd'],
      ['water', 'Water', 'usd'],
      ['trash', 'Trash', 'usd'],
    ],
  },
  {
    title: 'Annual Growth Rates',
    fields: [
      ['rentGrowth', 'Rent growth', 'pct'],
      ['pgeGrowth', 'PG&E growth', 'pct'],
      ['waterGrowth', 'Water growth', 'pct'],
      ['trashGrowth', 'Trash growth', 'pct'],
    ],
  },
]

const RENTOUT_DEFAULTS = {
  rentStartYear: 0,
  rent: 5500,
  rentGrowth: 0.03,
  vacancyRate: 0.05,
  mgmtRate: 0.08,
  maintenanceRate: 0.05,
  landPct: 0.2,
  years: 30,
}

const RENTOUT_GROUPS = [
  {
    title: 'Rental Income',
    fields: [
      ['rentStartYear', 'Start renting after (yrs owned)', 'num'],
      ['rent', 'Monthly rent charged', 'usd'],
      ['rentGrowth', 'Rent growth', 'pct'],
      ['vacancyRate', 'Vacancy rate', 'pct'],
    ],
  },
  {
    title: 'Operating Costs (% of rent)',
    fields: [
      ['mgmtRate', 'Property mgmt fee', 'pct'],
      ['maintenanceRate', 'Maintenance / repairs', 'pct'],
    ],
  },
  {
    title: 'Depreciation',
    fields: [['landPct', 'Land value (% of price)', 'pct']],
  },
]

const COMPARE_DEFAULTS = {
  holdYears: 5,
  salePrice: 900000,
  closingCostPct: 0.1,
  renovation: 0,
  capGainsExclusion: 250000,
  capGainsRate: 0.15,
  investReturn: 0.05,
  investTaxRate: 0.37,
}

const COMPARE_GROUPS = [
  {
    title: 'Sale',
    fields: [
      ['holdYears', 'Years before selling', 'num'],
      ['salePrice', 'Sale price', 'usd'],
      ['closingCostPct', 'Closing cost', 'pct'],
      ['renovation', 'Renovation', 'usd'],
    ],
  },
  {
    title: 'Capital Gains',
    fields: [
      ['capGainsExclusion', 'Cap gains exclusion', 'usd'],
      ['capGainsRate', 'Federal LTCG rate', 'pct'],
    ],
  },
  {
    title: 'Opportunity Cost (invest instead)',
    fields: [
      ['investReturn', 'Investment return', 'pct'],
      ['investTaxRate', 'Investment tax rate', 'pct'],
    ],
  },
]

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
      ['income', 'Annual income (AGI)', 'usd'],
      ['caRate', 'CA marginal rate', 'pct'],
      ['saltCap', 'SALT cap', 'usd'],
    ],
  },
]

function Field({ fieldKey, label, kind, value, onChange, hint }) {
  // Percent fields are stored as decimals but shown/edited as percents.
  const toDisplay = (v) => (kind === 'pct' ? +(v * 100).toFixed(4) : v)
  // Local draft so the field can be cleared/edited freely instead of snapping to 0.
  const [text, setText] = useState(String(toDisplay(value)))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(String(toDisplay(value)))
  }, [value, focused]) // eslint-disable-line react-hooks/exhaustive-deps

  const step = kind === 'pct' ? 0.05 : kind === 'usd' ? 1000 : 1
  const handle = (e) => {
    const raw = e.target.value
    setText(raw)
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return
    const num = parseFloat(raw)
    if (Number.isNaN(num)) return
    onChange(fieldKey, kind === 'pct' ? num / 100 : num)
  }
  const handleBlur = () => {
    setFocused(false)
    const num = parseFloat(text)
    if (text === '' || Number.isNaN(num)) {
      onChange(fieldKey, 0)
      setText('0')
    } else {
      setText(String(toDisplay(kind === 'pct' ? num / 100 : num)))
    }
  }
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="input-wrap">
        {kind === 'usd' && <span className="adorn adorn-left">$</span>}
        <input
          type="number"
          value={text}
          step={step}
          onFocus={() => setFocused(true)}
          onChange={handle}
          onBlur={handleBlur}
          className={kind === 'usd' ? 'has-left' : kind === 'pct' ? 'has-right' : ''}
        />
        {kind === 'pct' && <span className="adorn adorn-right">%</span>}
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

const TABS = [
  ['buy', 'Buy (condo)'],
  ['rent', 'Rent (today)'],
  ['rentout', 'Rent it out'],
  ['compare', 'Compare'],
]

export default function App() {
  const [tab, setTab] = useState('buy')
  // Lifted so the Compare tab sees the exact inputs used on the Buy and Rent tabs.
  const [buyInp, setBuyInp] = useState(DEFAULTS)
  const [rentInp, setRentInp] = useState(RENT_DEFAULTS)
  const [rentOutInp, setRentOutInp] = useState(RENTOUT_DEFAULTS)
  const [compareInp, setCompareInp] = useState(COMPARE_DEFAULTS)

  return (
    <div className="app">
      <header className="header">
        <h1>Housing Cost Calculator</h1>
        <p className="sub">
          Compare the monthly cost of buying a condo against your current rent — with an adjustable
          projection out to 30 years. Every field is editable.
        </p>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'buy' && <BuyView inp={buyInp} setInp={setBuyInp} />}
      {tab === 'rent' && <RentView inp={rentInp} setInp={setRentInp} />}
      {tab === 'rentout' && (
        <RentOutView buyInp={buyInp} inp={rentOutInp} setInp={setRentOutInp} />
      )}
      {tab === 'compare' && (
        <CompareView buyInp={buyInp} rentInp={rentInp} inp={compareInp} setInp={setCompareInp} />
      )}
    </div>
  )
}

function BuyView({ inp, setInp }) {
  const update = (key, val) => setInp((s) => ({ ...s, [key]: val }))
  const reset = () => setInp(DEFAULTS)

  const result = useMemo(() => project(inp), [inp])
  const y1 = result.rows[0]

  return (
    <div className="layout">
        <section className="inputs">
          {GROUPS.map((g) => (
            <div className="group" key={g.title}>
              <h2>{g.title}</h2>
              <div className="grid">
                {g.fields.map(([k, label, kind]) => (
                  <Field
                    key={k}
                    fieldKey={k}
                    label={label}
                    kind={kind}
                    value={inp[k]}
                    onChange={update}
                    hint={k === 'down' && inp.price > 0 ? `${((inp.down / inp.price) * 100).toFixed(1)}% of price` : undefined}
                  />
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

          <TaxExplainer y1={y1} filing={inp.filing} />

          <div className="table-wrap">
            <h2>{inp.years}-year projection</h2>
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>P&I</th>
                  <th>Prop tax</th>
                  <th>HOA</th>
                  <th>HO-6</th>
                  <th>PG&E</th>
                  <th>Tax save</th>
                  <th>Gross/mo</th>
                  <th className="col-hl">Net/mo</th>
                  <th className="faded">Total</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={r.year}>
                    <td>{r.year}</td>
                    <td>{usd(r.pi)}</td>
                    <td>{usd(r.propTaxM)}</td>
                    <td>{usd(r.hoa)}</td>
                    <td>{usd(r.ho6M)}</td>
                    <td>{usd(r.pge)}</td>
                    <td className="muted">−{usd(r.taxSaveM)}</td>
                    <td>{usd(r.gross)}</td>
                    <td className="accent-text col-hl">{usd(r.net)}</td>
                    <td className="faded">{usd(result.rows.slice(0, i + 1).reduce((s, x) => s + x.net * 12, 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="disclaimer">
            Tax savings are realized annually (smaller tax bill / larger refund), not as reduced
            monthly checks — your real out-of-pocket is the gross figure. Federal savings use 2025
            marginal brackets (so a large deduction that drops you out of the 35% bracket saves less
            on that portion); income, CA rate, SALT cap and property-tax rate are editable estimates
            — verify against your actual situation.
          </p>
        </section>
      </div>
  )
}

function TaxExplainer({ y1, filing }) {
  const t = y1.tax
  const roomForProp = Math.max(0, t.saltCap - t.stateIncTax)
  const pct = (r) => `${(r * 100).toFixed(2)}%`
  return (
    <details className="explainer">
      <summary>How the tax savings are calculated (Year 1)</summary>
      <p className="explainer-intro">
        The benefit comes from deducting <strong>mortgage interest</strong> and{' '}
        <strong>property tax</strong>. Federal savings compare itemizing against the standard
        deduction across your 2025 marginal brackets (the deduction can push you out of the 35%
        bracket); California has no SALT cap but phases out itemized deductions for high earners — so
        the two are computed separately.
      </p>

      <div className="step">
        <div className="step-head"><span className="step-num">1</span> Deductible mortgage interest <span className="tag">$750k fed / $1M CA cap</span></div>
        <div className="step-body">
          <span>Interest paid in year 1 (from the amortization schedule)</span>
          <span className="calc-out">{usd(t.interest)}</span>
        </div>
        <div className="step-body">
          <span>Federally deductible (interest on first $750k of principal)</span>
          <span className="calc-out">{usd(t.fedInterest)}</span>
        </div>
        <div className="step-body">
          <span>CA deductible (interest on first $1M of principal)</span>
          <span className="calc-out">{usd(t.caInterest)}</span>
        </div>
      </div>

      <div className="step">
        <div className="step-head"><span className="step-num">2</span> Federally deductible property tax (SALT cap)</div>
        <div className="step-body">
          <span>Est. CA state income tax ({filing === 'mfj' ? 'MFJ' : 'single'}) — already uses up SALT room</span>
          <span className="calc-out">{usd(t.stateIncTax)}</span>
        </div>
        <div className="step-body">
          <span>SALT cap</span>
          <span className="calc-out">{usd(t.saltCap)}</span>
        </div>
        <div className="step-body">
          <span>Room left for property tax = cap − state income tax</span>
          <span className="calc-out">{usd(roomForProp)}</span>
        </div>
        <div className="step-body highlight">
          <span>Federally deductible property tax = min(property tax, room)</span>
          <span className="calc-out">{usd(t.propDeductibleFed)}</span>
        </div>
      </div>

      <div className="step">
        <div className="step-head"><span className="step-num">3</span> Federal savings <span className="tag">standard vs. itemized, marginal</span></div>
        <div className="step-body">
          <span>Standard deduction ({filing === 'mfj' ? 'MFJ' : 'single'}, 2025)</span>
          <span className="calc-out">{usd(t.stdDed)}</span>
        </div>
        <div className="step-body">
          <span>Deduction taken while renting = max(standard, state income tax)</span>
          <span className="calc-out">{usd(t.dedRent)}</span>
        </div>
        <div className="step-body">
          <span>Deduction taken while owning = max(standard, SALT + interest)</span>
          <span className="calc-out">{usd(t.dedBuy)}</span>
        </div>
        <div className="step-body highlight">
          <span>Extra deduction from buying</span>
          <span className="calc-out">{usd(t.fedDeduction)}</span>
        </div>
        <div className="step-body">
          <span>Federal tax on taxable income {usd(t.taxableRent)} (renting)</span>
          <span className="calc-out">{usd(t.fedTaxBefore)}</span>
        </div>
        <div className="step-body">
          <span>Federal tax on taxable income {usd(t.taxableBuy)} (owning)</span>
          <span className="calc-out">{usd(t.fedTaxAfter)}</span>
        </div>
        <div className="step-body highlight">
          <span>Federal savings = tax before − tax after (effective {pct(t.fedEffRate)})</span>
          <span className="calc-out">{usd(t.fedSavings)}</span>
        </div>
      </div>

      <div className="step">
        <div className="step-head"><span className="step-num">4</span> California savings <span className="tag">no SALT cap · 6% phase-out</span></div>
        <div className="step-body">
          <span>CA itemized = deductible interest + full property tax</span>
          <span className="calc-out">{usd(t.caItemized)}</span>
        </div>
        <div className="step-body">
          <span>Itemized phase-out (6% of AGI over threshold, ≤80% of itemized)</span>
          <span className="calc-out">−{usd(t.caPhaseOut)}</span>
        </div>
        <div className="step-body">
          <span>CA deductible after phase-out</span>
          <span className="calc-out">{usd(t.caDeductible)}</span>
        </div>
        <div className="step-body highlight">
          <span>CA savings = {usd(t.caDeductible)} × {pct(t.caRate)}</span>
          <span className="calc-out">{usd(t.caSavings)}</span>
        </div>
      </div>

      <div className="step total-step">
        <div className="step-body strong">
          <span>Total annual tax savings = federal + CA</span>
          <span className="calc-out">{usd(t.annualSavings)}</span>
        </div>
        <div className="step-body strong accent-row">
          <span>Per month = ÷ 12</span>
          <span className="calc-out">{usd(t.annualSavings / 12)}</span>
        </div>
      </div>

      <p className="explainer-note">
        The savings are the <em>incremental</em> benefit of buying: we compute your deduction (the
        larger of the standard deduction or your itemized total) both while renting and while owning,
        and take the difference in tax. "Annual income" is treated as your income before the
        standard/itemized deduction (roughly AGI). Edit income, CA rate, and SALT cap to match your
        situation.
      </p>
    </details>
  )
}

function RentView({ inp, setInp }) {
  const update = (key, val) => setInp((s) => ({ ...s, [key]: val }))
  const reset = () => setInp(RENT_DEFAULTS)

  const result = useMemo(() => projectRent(inp), [inp])
  const rows = result.rows
  const y1 = rows[0]
  const yLast = rows[rows.length - 1]
  const totalPaid = rows.reduce((s, r) => s + r.total * 12, 0)

  return (
    <div className="layout">
      <section className="inputs">
        {RENT_GROUPS.map((g) => (
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
            <Field fieldKey="years" label="Years to project" kind="num" value={inp.years} onChange={update} />
          </div>
        </div>
        <button className="reset" onClick={reset}>Reset to defaults</button>
      </section>

      <section className="outputs">
        <div className="hero">
          <div className="hero-card primary">
            <span className="hero-label">Year 1 total / month</span>
            <span className="hero-value">{usd(y1.total)}</span>
            <span className="hero-note">rent + utilities today</span>
          </div>
          <div className="hero-card accent">
            <span className="hero-label">Year {yLast.year} total / month</span>
            <span className="hero-value">{usd(yLast.total)}</span>
            <span className="hero-note">after {inp.years} years of growth</span>
          </div>
        </div>

        <div className="breakdown">
          <h2>Year 1 monthly breakdown</h2>
          <Row label="Rent" value={y1.rent} />
          <Row label="PG&E / utilities" value={y1.pge} />
          <Row label="Water" value={y1.water} />
          <Row label="Trash" value={y1.trash} />
          <Row label="Total monthly" value={y1.total} strong accent />
        </div>

        <div className="table-wrap">
          <h2>{inp.years}-year projection</h2>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Rent</th>
                <th>PG&E</th>
                <th>Water</th>
                <th>Trash</th>
                <th className="col-hl">Total/mo</th>
                <th className="faded">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  <td>{usd(r.rent)}</td>
                  <td>{usd(r.pge)}</td>
                  <td>{usd(r.water)}</td>
                  <td>{usd(r.trash)}</td>
                  <td className="accent-text col-hl">{usd(r.total)}</td>
                  <td className="faded">{usd(rows.slice(0, i + 1).reduce((s, x) => s + x.total * 12, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="disclaimer">
          Total paid over {inp.years} years at these growth rates: <strong>{usd(totalPaid)}</strong>.
          All figures are monthly unless noted; growth compounds annually.
        </p>
      </section>
    </div>
  )
}

function RentOutView({ buyInp, inp, setInp }) {
  const update = (key, val) => setInp((s) => ({ ...s, [key]: val }))
  const reset = () => setInp(RENTOUT_DEFAULTS)

  // The rent-out scenario runs on the SAME condo you'd buy — price, loan, property
  // tax, HOA and insurance all come from the Buy tab. Its own `years` wins.
  const merged = useMemo(() => ({ ...buyInp, ...inp }), [buyInp, inp])
  const result = useMemo(() => projectRentOut(merged), [merged])
  const rows = result.rows
  const y1 = rows[0]
  const m = (annual) => annual / 12 // annual → monthly for the breakdown
  const grossYield = buyInp.price > 0 ? (y1.grossRent / buyInp.price) * 100 : 0
  const cumAfterTax = rows.reduce((s, r) => s + r.afterTaxCF, 0)
  const finalCarry = rows[rows.length - 1].lossCarry
  const positive = y1.afterTaxCF >= 0

  return (
    <div className="layout">
      <section className="inputs">
        {RENTOUT_GROUPS.map((g) => (
          <div className="group" key={g.title}>
            <h2>{g.title}</h2>
            <div className="grid">
              {g.fields.map(([k, label, kind]) => (
                <Field
                  key={k}
                  fieldKey={k}
                  label={label}
                  kind={kind}
                  value={inp[k]}
                  onChange={update}
                  hint={
                    k === 'rent' && buyInp.price > 0
                      ? `${grossYield.toFixed(1)}% gross yield/yr`
                      : k === 'rentStartYear'
                      ? result.delay > 0
                        ? `first rental year = ownership year ${result.delay + 1}`
                        : 'rent from day one'
                      : k === 'landPct'
                      ? `${(100 - inp.landPct * 100).toFixed(0)}% building = ${usd(result.depreciableBasis)} basis`
                      : undefined
                  }
                />
              ))}
            </div>
            {g.title === 'Depreciation' && (
              <p className="caption">
                You only set the <strong>land %</strong> — land can't be depreciated, so it's carved
                out of the price (a condo still owns a small share of the land under the building).
                The rest (the building, {usd(result.depreciableBasis)}) is written off on a fixed IRS
                schedule: straight-line over <strong>27.5 years</strong> (3.64%/yr) ={' '}
                <strong>{usd(result.depreciation)}/yr</strong>. Set land % from your county assessor's
                land-vs-improvement split (typically 15–25% for a condo).
              </p>
            )}
          </div>
        ))}
        <div className="group">
          <h2>Projection</h2>
          <div className="grid">
            <Field fieldKey="years" label="Years to project" kind="num" value={inp.years} onChange={update} />
          </div>
          <p className="caption">
            Purchase price, loan, property tax, HOA and insurance come from the{' '}
            <strong>Buy</strong> tab ({usd(buyInp.price)} condo, {usd(result.loan)} loan). PG&amp;E is
            excluded — your tenant pays it.
            {result.delay > 0 && (
              <>
                {' '}You own it {result.delay} year{result.delay > 1 ? 's' : ''} first, so by the first
                rental year the mortgage is further paid down and property tax, HOA and insurance have
                grown to their year-{result.delay + 1} levels ({usd(y1.hoaAnnual / 12)}/mo HOA,{' '}
                {usd(y1.propTaxAnnual / 12)}/mo tax).
              </>
            )}
          </p>
        </div>
        <button className="reset" onClick={reset}>Reset to defaults</button>
      </section>

      <section className="outputs">
        <div className="hero">
          <div className={`hero-card ${positive ? 'accent' : 'danger'}`}>
            <span className="hero-label">Year 1 net cash flow / month</span>
            <span className="hero-value">{usd(m(y1.afterTaxCF))}</span>
            <span className="hero-note">after tax, in your pocket</span>
          </div>
          <div className="hero-card primary">
            <span className="hero-label">Year 1 pre-tax cash flow / month</span>
            <span className="hero-value">{usd(m(y1.preTaxCF))}</span>
            <span className="hero-note">rent − expenses − full mortgage</span>
          </div>
        </div>

        <div className="stats">
          <Stat label="Monthly rent" value={usd(y1.rent)} />
          <Stat label="Mortgage P&I / mo" value={usd(result.monthlyPI)} />
          <Stat label="Depreciation / yr" value={usd(result.depreciation)} />
          <Stat label="Gross yield" value={`${grossYield.toFixed(1)}%`} />
        </div>

        <div className="breakdown">
          <h2>Year 1 monthly cash flow</h2>
          <Row label="Rent collected" value={y1.rent} />
          <Row label={`Vacancy (${(inp.vacancyRate * 100).toFixed(1)}%)`} value={-m(y1.vacancyLoss)} muted />
          <Row label="HOA" value={-m(y1.hoaAnnual)} muted />
          <Row label="Property tax" value={-m(y1.propTaxAnnual)} muted />
          <Row label="HO-6 insurance" value={-m(y1.ho6Annual)} muted />
          <Row label={`Management fee (${(inp.mgmtRate * 100).toFixed(1)}%)`} value={-m(y1.mgmtFee)} muted />
          <Row label={`Maintenance (${(inp.maintenanceRate * 100).toFixed(1)}%)`} value={-m(y1.maintenance)} muted />
          <Row label="Mortgage (P&I)" value={-m(y1.mortgageAnnual)} muted />
          <Row label="Pre-tax cash flow" value={m(y1.preTaxCF)} strong />
          <Row
            label={y1.rentalTax >= 0 ? 'Income tax on rental' : 'Tax benefit from loss'}
            value={-m(y1.rentalTax)}
            muted
          />
          <Row
            label="Net monthly cash flow"
            value={m(y1.afterTaxCF)}
            strong
            accent={positive}
            danger={!positive}
          />
        </div>

        <div className="breakdown">
          <h2>Rental income tax — Schedule E (year 1, annual)</h2>
          <Row label="Effective rental income" value={y1.effectiveRent} />
          <Row label="Operating expenses (deductible)" value={-y1.cashOpEx} muted />
          <Row label="Mortgage interest (deductible, no $750k cap)" value={-y1.interest} muted />
          <Row label="Depreciation (non-cash)" value={-y1.depreciation} muted />
          <Row
            label={y1.netRentalIncome >= 0 ? 'Net taxable rental income' : 'Net rental loss'}
            value={y1.netRentalIncome}
            strong
          />
          {y1.netRentalIncome >= 0 ? (
            <>
              {y1.lossUsed > 0 && (
                <Row label="Less: prior suspended losses applied" value={-y1.lossUsed} muted />
              )}
              <Row label="Taxable rental income" value={y1.taxableRental} />
              <Row label="Federal tax (marginal)" value={-y1.fedTax} muted />
              {y1.niit > 0 && <Row label="Federal NIIT (3.8%)" value={-y1.niit} muted />}
              <Row label="CA tax (marginal)" value={-y1.caTax} muted />
              <Row label="Total rental income tax" value={-y1.rentalTax} strong danger={y1.rentalTax > 0} />
            </>
          ) : (
            <>
              <Row label="§469 special allowance (phases out $100k–$150k MAGI)" value={y1.specialAllowance} muted />
              <Row label="Currently deductible loss" value={y1.deductibleLoss} />
              <Row label="Suspended loss carried forward" value={y1.suspendedLoss} muted />
              <Row
                label={y1.deductibleLoss > 0 ? 'Tax benefit this year' : 'No current tax benefit (loss suspended)'}
                value={-y1.rentalTax}
                strong
                accent={y1.rentalTax < 0}
              />
            </>
          )}
        </div>

        <RentOutTaxExplainer />

        <div className="table-wrap">
          <h2>{inp.years}-year projection (annual)</h2>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Rent/mo</th>
                <th>Op ex</th>
                <th>Interest</th>
                <th>Deprec.</th>
                <th>Taxable</th>
                <th>Tax</th>
                <th>Pre-tax CF</th>
                <th className="col-hl">After-tax CF</th>
                <th className="faded">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  <td>{usd(r.rent)}</td>
                  <td>{usd(r.cashOpEx)}</td>
                  <td>{usd(r.interest)}</td>
                  <td>{usd(r.depreciation)}</td>
                  <td className={r.netRentalIncome < 0 ? 'muted' : ''}>{usd(r.netRentalIncome)}</td>
                  <td className="muted">{r.rentalTax >= 0 ? `−${usd(r.rentalTax)}` : `+${usd(-r.rentalTax)}`}</td>
                  <td>{usd(r.preTaxCF)}</td>
                  <td className={`col-hl ${r.afterTaxCF >= 0 ? 'accent-text' : ''}`}>{usd(r.afterTaxCF)}</td>
                  <td className="faded">{usd(rows.slice(0, i + 1).reduce((s, x) => s + x.afterTaxCF, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="disclaimer">
          Net cash flow over {inp.years} years: <strong>{usd(cumAfterTax)}</strong> after tax
          (pre-tax {usd(rows.reduce((s, r) => s + r.preTaxCF, 0))}).{' '}
          {finalCarry > 0 && (
            <>
              At your income the $25,000 special allowance is fully phased out, so net rental losses are{' '}
              <strong>suspended</strong>: {usd(finalCarry)} of passive losses accumulate by year{' '}
              {inp.years}, offsetting future rental profit or your gain at sale (they aren't lost).{' '}
            </>
          )}
          Pre-tax cash flow spends the full mortgage payment; the tax line only deducts the interest
          portion plus depreciation, so a property can be cash-flow positive yet show a taxable loss.
          Not tax advice — verify brackets and your situation.
        </p>
      </section>
    </div>
  )
}

function RentOutTaxExplainer() {
  return (
    <details className="explainer">
      <summary>How renting it out is taxed</summary>
      <p className="explainer-intro">
        Rental profit is ordinary income (federal Schedule E + CA), but it's taxed on the{' '}
        <strong>net</strong> after expenses and depreciation — not the rent you collect. Four rules
        drive the number:
      </p>

      <div className="step">
        <div className="step-head"><span className="step-num">1</span> Deduct interest &amp; depreciation <span className="tag">no $750k cap</span></div>
        <div className="step-body">
          <span>Mortgage <strong>interest</strong> is fully deductible on Schedule E — the $750k acquisition-debt cap only applies to a primary residence (Schedule A). Only interest, not principal.</span>
        </div>
        <div className="step-body">
          <span><strong>Depreciation</strong>: the building (price minus land) is written off straight-line over 27.5 years (~3.64%/yr). It's a non-cash deduction that shields rental income, so you can be cash-positive but show a tax loss.</span>
        </div>
      </div>

      <div className="step">
        <div className="step-head"><span className="step-num">2</span> Passive-loss rules <span className="tag">$25k allowance, gone at $150k</span></div>
        <div className="step-body">
          <span>Rentals are passive. A net loss offsets W-2/other income only up to a $25,000 special allowance, which phases out $0.50 per $1 of MAGI from $100k to $150k. Above $150k MAGI it's $0 — the loss is <strong>suspended</strong> and carried forward (Form 8582 / CA FTB 3801) to offset future rental profit or the gain when you sell. It isn't lost, just deferred.</span>
        </div>
      </div>

      <div className="step">
        <div className="step-head"><span className="step-num">3</span> Net income is taxed + NIIT <span className="tag">3.8% federal</span></div>
        <div className="step-body">
          <span>When the rental shows a profit (after any carried-forward losses), it stacks on your ordinary income at your marginal federal + CA rates. High earners (MAGI &gt; $200k single / $250k MFJ) also owe the <strong>3.8% NIIT</strong> on net rental income — federal only, CA has no NIIT.</span>
        </div>
      </div>

      <div className="step">
        <div className="step-head"><span className="step-num">4</span> At sale <span className="tag">recapture &amp; QBI</span></div>
        <div className="step-body">
          <span>Depreciation you took is recaptured at sale (unrecaptured §1250 gain, up to 25% federal; CA taxes it as ordinary income) — modeled on the Compare tab, not here.</span>
        </div>
        <div className="step-body">
          <span>A 20% QBI deduction can apply if the rental clears the Rev. Proc. 2019-38 safe harbor (≥250 hours/yr, separate books, logs). A single passively-managed condo usually won't — so it's not assumed here.</span>
        </div>
      </div>

      <p className="explainer-note">
        Based on IRS Pub. 527 (rental property), Pub. 925 (passive-activity/at-risk rules), Pub. 936
        (the $750k cap is Schedule A only), Form 8960 (NIIT), and CA FTB Form 3801. Brackets shift
        yearly — verify against the current IRS/FTB tables.
      </p>
    </details>
  )
}

function CompareView({ buyInp, rentInp, inp, setInp }) {
  const update = (key, val) => setInp((s) => ({ ...s, [key]: val }))
  const reset = () => setInp(COMPARE_DEFAULTS)
  const [showDiffInfo, setShowDiffInfo] = useState(false)

  const c = useMemo(() => {
    const hy = Math.max(1, Math.round(inp.holdYears))

    // Cumulative cash paid over the holding period on each path.
    const buyRes = project({ ...buyInp, years: hy })
    const rentRes = projectRent({ ...rentInp, years: hy })
    const buyPaid = buyRes.rows.reduce((s, r) => s + r.net * 12, 0)
    const rentPaid = rentRes.rows.reduce((s, r) => s + r.total * 12, 0)

    // Sale side.
    const loanBal = remainingBalance(buyRes.loan, buyInp.rate, buyInp.termYears, hy)
    const closingCosts = inp.salePrice * inp.closingCostPct
    // Capital gain: proceeds net of selling costs and improvements, minus purchase price.
    const capitalGain = inp.salePrice - closingCosts - inp.renovation - buyInp.price
    // §121 primary-residence exclusion requires 2 of the last 5 years of ownership+use.
    const exclusionEligible = hy >= 2
    const exclusion = exclusionEligible ? inp.capGainsExclusion : 0
    const taxableGain = Math.max(0, capitalGain - exclusion)
    // CA taxes gains as ordinary income (use the CA marginal rate); high earners also
    // owe the 3.8% federal NIIT. Below one year it's short-term (ordinary), flagged in UI.
    const niitThreshold = buyInp.filing === 'mfj' ? 250000 : 200000
    const niitRate = buyInp.income > niitThreshold ? 0.038 : 0
    const capGainsRateTotal = inp.capGainsRate + niitRate + buyInp.caRate
    const capGainsTax = taxableGain * capGainsRateTotal
    const shortTerm = hy < 1
    const moneyBack =
      inp.salePrice - closingCosts - inp.renovation - loanBal - capGainsTax

    // Down payment is upfront cash out. It comes back at sale inside moneyBack
    // (a smaller loan balance means more equity), so it must be charged here too.
    const netBuyCost = buyInp.down + buyPaid - moneyBack

    // Opportunity cost of buying: capital the renter can invest instead.
    const g = 1 + inp.investReturn
    // 1) The down payment, invested up front and compounded over the holding period.
    const downFV = buyInp.down * Math.pow(g, hy)
    const downGain = downFV - buyInp.down
    // 2) The month-by-month buy-minus-rent cash-flow gap. Each month's surplus is
    //    invested and grows at the annual rate until the end of the holding period.
    //    Only the growth counts — the gap itself is already in buyPaid - rentPaid.
    const totalMonths = hy * 12
    const diffSchedule = []
    let diffPrincipal = 0
    let diffFV = 0
    for (let m = 0; m < totalMonths; m++) {
      const yi = Math.floor(m / 12)
      const buyM = buyRes.rows[yi].net
      const rentM = rentRes.rows[yi].total
      const diff = buyM - rentM
      const monthsGrown = totalMonths - 1 - m
      const factor = Math.pow(g, monthsGrown / 12)
      const fv = diff * factor
      diffPrincipal += diff
      diffFV += fv
      diffSchedule.push({ month: m + 1, year: yi + 1, buy: buyM, rent: rentM, diff, monthsGrown, factor, fv })
    }
    const diffGain = diffFV - diffPrincipal

    // Investment gains are taxable too. The rate is editable (default 37% — top federal
    // ordinary bracket, for gains taxed as ordinary income rather than long-term). Applied
    // to the gain only, not the contributed principal, when liquidated at year hy.
    const invTaxRate = inp.investTaxRate
    const downGainTax = downGain * invTaxRate
    const downGainNet = downGain - downGainTax
    const diffGainTax = diffGain * invTaxRate
    const diffGainNet = diffGain - diffGainTax

    // Down payment gain is the renter's (they didn't tie it up in a home).
    const rentNet = rentPaid - downGainNet
    // The yearly cash-flow gap is the buyer's opportunity cost: whatever extra the
    // buyer spends could have been invested, so its growth adds to the cost of owning.
    const buyNet = netBuyCost + diffGainNet
    const netDiff = buyNet - rentNet // <0 => buying is cheaper

    return {
      hy, buyPaid, rentPaid, loanBal, closingCosts,
      capitalGain, exclusion, exclusionEligible, taxableGain, capGainsTax,
      niitRate, capGainsRateTotal, shortTerm,
      moneyBack, netBuyCost,
      downGain, diffGain, diffPrincipal, diffFV, diffSchedule, buyNet, rentNet, netDiff,
      invTaxRate, downGainTax, downGainNet, diffGainTax, diffGainNet,
    }
  }, [inp, buyInp, rentInp])

  const buyCheaper = c.netDiff < 0
  const advantage = Math.abs(c.netDiff)

  return (
    <div className="layout">
      <section className="inputs">
        {COMPARE_GROUPS.map((g) => (
          <div className="group" key={g.title}>
            <h2>{g.title}</h2>
            <div className="grid">
              {g.fields.map(([k, label, kind]) => (
                <Field key={k} fieldKey={k} label={label} kind={kind} value={inp[k]} onChange={update} />
              ))}
            </div>
            {g.title === 'Sale' && (
              <p className="caption">
                Sale price is{' '}
                <strong>
                  {inp.salePrice >= buyInp.price ? '+' : ''}
                  {(buyInp.price > 0 ? (inp.salePrice / buyInp.price - 1) * 100 : 0).toFixed(1)}%
                </strong>{' '}
                vs. the {usd(buyInp.price)} purchase price
                {c.hy > 0 && buyInp.price > 0 && (
                  <> ({((Math.pow(inp.salePrice / buyInp.price, 1 / c.hy) - 1) * 100).toFixed(1)}%/yr)</>
                )}
                .
              </p>
            )}
            {g.title === 'Capital Gains' && (
              <>
                <details className="explainer inline-explainer">
                  <summary>How you qualify — the 2-out-of-5-year rules</summary>
                  <p className="explainer-intro">
                    To claim the {usd(inp.capGainsExclusion)} exclusion you must pass two basic tests:
                  </p>
                  <div className="step-body highlight">
                    <span><strong>Ownership test</strong> — owned the home at least 24 months during the 5-year period before the sale.</span>
                  </div>
                  <div className="step-body highlight">
                    <span><strong>Use test</strong> — lived in it as your primary residence at least 24 months during that same 5-year window.</span>
                  </div>
                  <div className="step-body highlight">
                    <span><strong>Frequency limit</strong> — you can only use this exclusion once every two years.</span>
                  </div>
                </details>
              </>
            )}
          </div>
        ))}
        <button className="reset" onClick={reset}>Reset to defaults</button>
      </section>

      <section className="outputs">
        <div className="hero">
          <div className="hero-card primary">
            <span className="hero-label">Money back from sale</span>
            <span className="hero-value">{usd(c.moneyBack)}</span>
            <span className="hero-note">cash in pocket after selling in year {c.hy}</span>
          </div>
          <div className={`hero-card ${buyCheaper ? 'accent' : 'danger'}`}>
            <span className="hero-label">{buyCheaper ? 'Buying is cheaper by' : 'Renting is cheaper by'}</span>
            <span className="hero-value">{usd(advantage)}</span>
            <span className="hero-note">net cost of buying vs. renting, over {c.hy} years</span>
          </div>
        </div>

        <div className="breakdown">
          <h2>Money back from selling (year {c.hy})</h2>
          <Row label="Sale price" value={inp.salePrice} />
          <Row label={`Closing costs (${(inp.closingCostPct * 100).toFixed(1)}%)`} value={-c.closingCosts} muted />
          <Row label="Renovation" value={-inp.renovation} muted />
          <Row label="Remaining mortgage payoff" value={-c.loanBal} muted />
          <Row label="Capital gains tax" value={-c.capGainsTax} muted />
          <Row label="Money back" value={c.moneyBack} strong accent />
        </div>

        <div className="breakdown">
          <h2>Capital gains</h2>
          <Row label="Capital gain (sale − closing − renovation − purchase price)" value={c.capitalGain} />
          <Row
            label={c.exclusionEligible ? 'Exclusion' : 'Exclusion (not eligible — held < 2 yrs)'}
            value={-c.exclusion}
            muted
          />
          <Row label="Taxable gain" value={c.taxableGain} />
          <div className="brow strong">
            <span>
              Tax ({(c.capGainsRateTotal * 100).toFixed(1)}% = {(inp.capGainsRate * 100).toFixed(1)}% fed
              {c.niitRate > 0 && ' + 3.8% NIIT'} + {(buyInp.caRate * 100).toFixed(1)}% CA)
            </span>
            <span>{usd(c.capGainsTax)}</span>
          </div>
          {c.shortTerm && (
            <p className="caption">
              Held under 1 year — this would be a <strong>short-term</strong> gain taxed at ordinary
              federal rates (higher than the long-term rate shown). Adjust the federal rate to reflect
              that.
            </p>
          )}
        </div>

        <div className="breakdown">
          <h2>Net comparison over {c.hy} years</h2>
          <Row
            label={`Buy — down payment${buyInp.price > 0 ? ` (${((buyInp.down / buyInp.price) * 100).toFixed(1)}% of price)` : ''}`}
            value={buyInp.down}
          />
          <Row label="Buy — total net cost (after tax savings)" value={c.buyPaid} />
          <Row label="Buy — money back from sale" value={-c.moneyBack} muted />
          <div className="brow">
            <span>
              Buy — payment differences invested (gain @ {(inp.investReturn * 100).toFixed(1)}%)
              <button
                type="button"
                className="info-btn"
                aria-label="How this is calculated"
                aria-expanded={showDiffInfo}
                onClick={() => setShowDiffInfo((s) => !s)}
              >
                i
              </button>
            </span>
            <span className="muted">{usd(c.diffGain)}</span>
          </div>
          <Row
            label={`Buy — cap-gains tax on that gain (${(c.invTaxRate * 100).toFixed(1)}%)`}
            value={-c.diffGainTax}
            muted
          />
          {showDiffInfo && (
            <div className="info-note">
              <p className="caption" style={{ margin: '0 0 10px' }}>
                Each month we take <strong>buy − rent</strong> monthly cost and invest that surplus.
                It grows at {(inp.investReturn * 100).toFixed(1)}%/yr until year {c.hy}, so a surplus
                in month <em>m</em> is multiplied by {(1 + inp.investReturn).toFixed(2)}
                <sup>(months left ÷ 12)</sup>. The <strong>gain</strong> used in the comparison is the
                ending value minus what was put in (the surplus itself is already in the cash-paid
                totals). A negative diff means buying is cheaper month-to-month — the buyer invests
                the surplus.
              </p>
              <div className="schedule-wrap">
                <table className="schedule">
                  <thead>
                    <tr>
                      <th>Mo</th>
                      <th>Yr</th>
                      <th>Buy/mo</th>
                      <th>Rent/mo</th>
                      <th>Diff/mo</th>
                      <th>Mos left</th>
                      <th>×Factor</th>
                      <th>Value @ yr {c.hy}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.diffSchedule.map((r) => (
                      <tr key={r.month}>
                        <td>{r.month}</td>
                        <td>{r.year}</td>
                        <td>{usd(r.buy, 2)}</td>
                        <td>{usd(r.rent, 2)}</td>
                        <td>{usd(r.diff, 2)}</td>
                        <td>{r.monthsGrown}</td>
                        <td>{r.factor.toFixed(4)}</td>
                        <td>{usd(r.fv, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Total invested (sum of diffs)</td>
                      <td>{usd(c.diffPrincipal, 2)}</td>
                      <td colSpan={2}>Ending value</td>
                      <td>{usd(c.diffFV, 2)}</td>
                    </tr>
                    <tr className="foot-gain">
                      <td colSpan={7}>Investment gain = ending value − invested</td>
                      <td>{usd(c.diffGain, 2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          <Row label="Buy — net cost after opportunity cost" value={c.buyNet} strong />
          <Row label="Rent — total cash paid" value={c.rentPaid} />
          <Row label={`Rent — down payment invested (gain @ ${(inp.investReturn * 100).toFixed(1)}%)`} value={-c.downGain} muted />
          <Row label={`Rent — cap-gains tax on that gain (${(c.invTaxRate * 100).toFixed(1)}%)`} value={c.downGainTax} muted />
          <Row label="Rent — net cost after investing" value={c.rentNet} strong />
          <Row
            label={buyCheaper ? 'Buying saves' : 'Renting saves'}
            value={advantage}
            strong
            accent={buyCheaper}
            danger={!buyCheaper}
          />
        </div>

        <p className="disclaimer">
          Net cost of owning = all cash paid (P&I, taxes, HOA, insurance, utilities) minus what you
          walk away with at sale. A negative net difference means buying costs less than renting over
          the same period. Capital gain adds renovation and closing costs to basis; the §121
          exclusion applies only if held ≥ 2 years, and the gain is taxed at the federal long-term
          rate + 3.8% NIIT (high earners) + your CA marginal rate (CA has no preferential rate) —
          all editable estimates; verify against your actual situation. Opportunity cost is
          modeled by investing at {(inp.investReturn * 100).toFixed(1)}%: the renter invests the
          down payment, and each side invests whatever it saves in monthly cash flow vs. the other
          (that growth sits on the buy line, since the gap is the buyer's opportunity cost). Those
          investment gains are themselves taxed at the editable investment tax rate
          ({(c.invTaxRate * 100).toFixed(1)}%, defaulting to the 37% top federal ordinary bracket)
          when the portfolio is liquidated at year {c.hy} — so the after-tax investment return, not
          the headline rate, is what competes with the after-tax mortgage.
        </p>
      </section>
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

function Row({ label, value, strong, accent, danger, muted }) {
  return (
    <div className={`brow${strong ? ' strong' : ''}${accent ? ' accent-row' : ''}${danger ? ' danger-row' : ''}`}>
      <span>{label}</span>
      <span className={muted ? 'muted' : ''}>{usd(value)}</span>
    </div>
  )
}
