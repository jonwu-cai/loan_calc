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

export function caIncomeTax(income, filing) {
  const brackets = filing === 'mfj' ? CA_BRACKETS_MFJ : CA_BRACKETS_SINGLE
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const [lo, rt] = brackets[i]
    const hi = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity
    if (income > lo) tax += (Math.min(income, hi) - lo) * rt
    else break
  }
  return tax
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

    // Federal: SALT-capped. State income tax usually eats most of the cap,
    // property tax is deductible only up to the remaining room.
    const saltBefore = Math.min(stateIncTax, inp.saltCap)
    const saltAfter = Math.min(stateIncTax + propTaxAnnual, inp.saltCap)
    const propDeductibleFed = saltAfter - saltBefore
    const fedSavings = (interest + propDeductibleFed) * inp.fedRate
    // CA: no SALT cap, allows mortgage interest + property tax.
    const caSavings = (interest + propTaxAnnual) * inp.caRate
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
        propTaxAnnual,
        stateIncTax,
        saltCap: inp.saltCap,
        saltBefore,
        saltAfter,
        propDeductibleFed,
        fedRate: inp.fedRate,
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
