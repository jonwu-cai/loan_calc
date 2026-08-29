// Pure calculation helpers — a faithful port of the original spreadsheet logic.

// CA state income tax, 2025 single-filer brackets (used to gauge SALT room).
const CA_BRACKETS_SINGLE = [
  [0, 0.01], [10412, 0.02], [24684, 0.04], [38959, 0.06],
  [54081, 0.08], [68350, 0.093], [349137, 0.103],
]
// 2025 MFJ brackets are ~2x the single widths up through 9.3%.
const CA_BRACKETS_MFJ = [
  [0, 0.01], [20824, 0.02], [49368, 0.04], [77918, 0.06],
  [108162, 0.08], [136700, 0.093], [698274, 0.103],
]

// Federal income tax, 2025 brackets.
const FED_BRACKETS_SINGLE = [
  [0, 0.10], [11925, 0.12], [48475, 0.22], [103350, 0.24],
  [197300, 0.32], [250525, 0.35], [626350, 0.37],
]
const FED_BRACKETS_MFJ = [
  [0, 0.10], [23850, 0.12], [96950, 0.22], [206700, 0.24],
  [394600, 0.32], [501050, 0.35], [751600, 0.37],
]

// 2025 federal standard deduction (post-OBBBA).
const FED_STD_DEDUCTION = { single: 15750, mfj: 31500 }
// Mortgage-interest acquisition-debt limits: interest is deductible only on the
// portion of principal up to these caps. Federal $750k; California conforms to $1M.
const FED_MORTGAGE_LIMIT = 750000
const CA_MORTGAGE_LIMIT = 1000000
// CA itemized-deduction phase-out: reduce itemized by the lesser of 6% of AGI over
// the threshold or 80% of itemized. 2025 FTB AGI thresholds.
const CA_ITEMIZED_PHASEOUT = { single: 252203, mfj: 504411 }

function bracketTax(income, brackets) {
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const [lo, rt] = brackets[i]
    const hi = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity
    if (income > lo) tax += (Math.min(income, hi) - lo) * rt
    else break
  }
  return tax
}

export function caIncomeTax(income, filing) {
  return bracketTax(income, filing === 'mfj' ? CA_BRACKETS_MFJ : CA_BRACKETS_SINGLE)
}

export function fedIncomeTax(income, filing) {
  return bracketTax(Math.max(0, income), filing === 'mfj' ? FED_BRACKETS_MFJ : FED_BRACKETS_SINGLE)
}

export function monthlyPI(loan, annualRate, termYears) {
  const r = annualRate / 12
  const n = termYears * 12
  if (r === 0) return loan / n
  return (loan * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1)
}

// Total interest paid during a given 12-month window (year index 0-based),
// plus the ending balance.
export function yearInterest(loan, annualRate, termYears, M, yearIndex) {
  const r = annualRate / 12
  const n = termYears * 12
  let bal = loan
  const startMonth = yearIndex * 12
  for (let m = 0; m < startMonth && m < n; m++) {
    bal -= M - bal * r
  }
  let totInt = 0
  for (let m = 0; m < 12 && startMonth + m < n; m++) {
    const interest = bal * r
    totInt += interest
    bal -= M - interest
  }
  return { interest: totInt, endBalance: bal }
}

// Remaining mortgage balance after a whole number of years of payments.
export function remainingBalance(loan, annualRate, termYears, yearsPaid) {
  const r = annualRate / 12
  const n = termYears * 12
  const M = monthlyPI(loan, annualRate, termYears)
  let bal = loan
  const months = Math.min(Math.max(0, yearsPaid) * 12, n)
  for (let m = 0; m < months; m++) bal -= M - bal * r
  return Math.max(0, bal)
}

// Current rent scenario: total monthly cost projected forward with per-line growth.
export function projectRent(inp) {
  const rows = []
  let rent = inp.rent
  let pge = inp.pge
  let trash = inp.trash
  let water = inp.water

  for (let yr = 1; yr <= inp.years; yr++) {
    const total = rent + pge + trash + water
    rows.push({ year: yr, rent, pge, trash, water, total })
    rent *= 1 + inp.rentGrowth
    pge *= 1 + inp.pgeGrowth
    trash *= 1 + inp.trashGrowth
    water *= 1 + inp.waterGrowth
  }

  return { rows }
}

export function project(inp) {
  const loan = Math.max(0, inp.price - inp.down)
  const M = monthlyPI(loan, inp.rate, inp.termYears)
  const stateIncTax = caIncomeTax(inp.income, inp.filing)

  const rows = []
  let assessed = inp.price
  let hoa = inp.hoa
  let pge = inp.pge
  let ho6 = inp.ho6Annual

  for (let yr = 1; yr <= inp.years; yr++) {
    const { interest } = yearInterest(loan, inp.rate, inp.termYears, M, yr - 1)
    const propTaxAnnual = assessed * inp.propTaxRate
    const propTaxM = propTaxAnnual / 12

    // Deductible interest is limited by acquisition-debt caps (fed $750k, CA $1M):
    // only the fraction of the loan under the cap earns a deduction.
    const fedInterest = interest * (loan > 0 ? Math.min(1, FED_MORTGAGE_LIMIT / loan) : 0)
    const caInterest = interest * (loan > 0 ? Math.min(1, CA_MORTGAGE_LIMIT / loan) : 0)

    // Federal: compare itemizing (SALT-capped) against the standard deduction, in both
    // the renting and owning cases, then take the marginal tax difference. This models
    // the standard-deduction floor and stacks the deduction at the right income level.
    const stdDed = FED_STD_DEDUCTION[inp.filing] ?? FED_STD_DEDUCTION.single
    const saltBefore = Math.min(stateIncTax, inp.saltCap)              // renting: SALT = state income tax
    const saltAfter = Math.min(stateIncTax + propTaxAnnual, inp.saltCap) // owning: + property tax
    const propDeductibleFed = saltAfter - saltBefore
    const itemizedRent = saltBefore
    const itemizedBuy = saltAfter + fedInterest
    const dedRent = Math.max(stdDed, itemizedRent)
    const dedBuy = Math.max(stdDed, itemizedBuy)
    const fedDeduction = dedBuy - dedRent // incremental deduction actually gained by buying
    const taxableRent = Math.max(0, inp.income - dedRent)
    const taxableBuy = Math.max(0, inp.income - dedBuy)
    const fedTaxBefore = fedIncomeTax(taxableRent, inp.filing)
    const fedTaxAfter = fedIncomeTax(taxableBuy, inp.filing)
    const fedSavings = fedTaxBefore - fedTaxAfter
    const fedEffRate = fedDeduction > 0 ? fedSavings / fedDeduction : 0

    // California: no SALT cap (full property tax + mortgage interest, state income tax
    // itself not deductible), but itemized deductions phase out for high earners.
    const caThreshold = CA_ITEMIZED_PHASEOUT[inp.filing] ?? CA_ITEMIZED_PHASEOUT.single
    const caItemized = caInterest + propTaxAnnual
    const caPhaseOut = Math.min(0.06 * Math.max(0, inp.income - caThreshold), 0.8 * caItemized)
    const caDeductible = caItemized - caPhaseOut
    const caSavings = caDeductible * inp.caRate
    const taxSaveM = (fedSavings + caSavings) / 12

    const gross = M + propTaxM + hoa + ho6 / 12 + pge
    const net = gross - taxSaveM

    rows.push({
      year: yr,
      pi: M,
      propTaxM,
      hoa,
      ho6M: ho6 / 12,
      pge,
      interestM: interest / 12,
      taxSaveM,
      gross,
      net,
      // Full working for the tax-savings breakdown (annual figures).
      tax: {
        interest,
        fedInterest,
        caInterest,
        propTaxAnnual,
        stateIncTax,
        saltCap: inp.saltCap,
        saltBefore,
        saltAfter,
        propDeductibleFed,
        stdDed,
        itemizedRent,
        itemizedBuy,
        dedRent,
        dedBuy,
        fedDeduction,
        income: inp.income,
        taxableRent,
        taxableBuy,
        fedTaxBefore,
        fedTaxAfter,
        fedEffRate,
        caItemized,
        caPhaseOut,
        caDeductible,
        caRate: inp.caRate,
        fedSavings,
        caSavings,
        annualSavings: fedSavings + caSavings,
      },
    })

    assessed *= 1 + inp.propTaxGrowth
    hoa *= 1 + inp.hoaGrowth
    pge *= 1 + inp.pgeGrowth
    ho6 *= 1 + inp.ho6Growth
  }

  return { loan, monthlyPI: M, stateIncTax, rows }
}
