/**
 * Engine 2: the income tax actually owed for the year, and the refund or
 * balance owing against what payroll withheld.
 *
 * Line order follows the T1 return, Schedule 8, T2204, Schedule 11, ON428 and
 * ON428-A. Assumptions for v1: Ontario resident on Dec 31, single, no
 * dependants, 18-69 all year, employment income only, no other deductions or
 * credits, no tuition transfer.
 */
import { add, exactCents, floor0, fromCents, gt, min, mul, r2, sub, ZERO, type Q } from '../money.ts'
import { annualParamsFor, defaultRegistry, type ParamRegistry } from '../params/select.ts'
import { federalBasicPersonalAmount, ontarioHealthPremium, ontarioSurtax, ontarioTaxReduction, progressiveTax } from '../tax-tables.ts'
import { annualCpp, annualEi, sumSlips } from './cpp-ei.ts'
import { claimTuition } from './tuition.ts'
import type { AnnualInput, AnnualResult, AnnualWarning } from './types.ts'

export function computeAnnual(input: AnnualInput, registry: ParamRegistry = defaultRegistry): AnnualResult {
  const p = annualParamsFor(input.taxYear, registry)
  const c = exactCents
  const warnings: AnnualWarning[] = []

  const employmentIncome = fromCents(sumSlips(input.slips, 'gross')) // line 10100
  const cpp = annualCpp(p.cpp, input.slips)
  const ei = annualEi(p.ei, input.slips)

  // Net income (23600) = total income - line 22215; taxable income (26000) = net income.
  const netIncome = floor0(sub(employmentIncome, fromCents(cpp.enhancedDeduction)))
  const taxableIncome = netIncome

  // --- Federal (T1 Step 5) -------------------------------------------------
  const fed = p.federal
  const fedTaxOnIncome = r2(progressiveTax(fed.brackets, taxableIncome))
  const bpa = federalBasicPersonalAmount(fed.basicPersonalAmount, netIncome) // 30000
  const cea = min(fed.canadaEmploymentAmount, employmentIncome) // 31260
  const creditAmountsBeforeTuition = add(bpa, fromCents(cpp.baseCredit), fromCents(ei.credit), cea) // 30800, 31200
  const tuition = claimTuition({
    taxableIncome,
    taxOnIncome: fedTaxOnIncome,
    firstBracketThreshold: fed.brackets[1]?.threshold ?? taxableIncome,
    lowestRate: fed.lowestRate,
    otherCreditAmounts: creditAmountsBeforeTuition,
    currentYear: fromCents(input.tuition.currentYear),
    carryforward: fromCents(input.tuition.carryforward),
  })
  const allCreditAmounts = add(creditAmountsBeforeTuition, tuition.fromCarryforward, tuition.fromCurrentYear) // 33500
  const fedCredits = r2(mul(fed.lowestRate, allCreditAmounts)) // 35000
  const federalTax = floor0(sub(fedTaxOnIncome, fedCredits)) // 42000
  const firstThreshold = fed.brackets[1]?.threshold
  if (firstThreshold && gt(allCreditAmounts, firstThreshold)) warnings.push('federal-top-up-credit-not-modelled')

  // --- Ontario (ON428 / ON428-A) --------------------------------------------
  const on = p.ontario
  const onTaxOnIncome = r2(progressiveTax(on.brackets, taxableIncome)) // line 8
  const onCredits = r2(mul(on.lowestRate, add(on.basicPersonalAmount, fromCents(cpp.baseCredit), fromCents(ei.credit)))) // 61500
  const basicTax = floor0(sub(onTaxOnIncome, onCredits)) // line 62
  const surtax = ontarioSurtax(on.surtax, basicTax) // line 68
  const beforeReduction = add(basicTax, surtax) // line 73
  const reduction = gt(beforeReduction, ZERO) ? ontarioTaxReduction(on.taxReduction.basicAmount, beforeReduction) : ZERO // line 80
  const afterReduction = floor0(sub(beforeReduction, reduction)) // line 83
  const lift = liftCredit(on.lift, employmentIncome, netIncome)
  const liftApplied = min(lift, afterReduction) // line 85
  const healthPremium = ontarioHealthPremium(on.healthPremium, taxableIncome) // line 89
  const ontarioTax = add(sub(afterReduction, liftApplied), healthPremium) // line 90 -> 42800

  // --- Result ----------------------------------------------------------------
  const totalTax = add(federalTax, ontarioTax)
  const totalWithheld = sumSlips(input.slips, 'incomeTax')
  const refund = totalWithheld - c(totalTax) + cpp.overpayment + ei.refunded

  return {
    taxYear: input.taxYear,
    employmentIncome: c(employmentIncome),
    netIncome: c(netIncome),
    taxableIncome: c(taxableIncome),
    cpp,
    ei,
    federal: {
      taxOnIncome: c(fedTaxOnIncome),
      basicPersonalAmount: c(bpa),
      canadaEmploymentAmount: c(cea),
      creditAmountsBeforeTuition: c(creditAmountsBeforeTuition),
      tuitionRoom: c(tuition.room),
      tuitionUsedFromCarryforward: c(tuition.fromCarryforward),
      tuitionUsedFromCurrentYear: c(tuition.fromCurrentYear),
      nonRefundableCredits: c(fedCredits),
      tax: c(federalTax),
    },
    ontario: {
      taxOnIncome: c(onTaxOnIncome),
      nonRefundableCredits: c(onCredits),
      basicTax: c(basicTax),
      surtax: c(surtax),
      taxReduction: c(reduction),
      liftCredit: c(liftApplied),
      healthPremium: c(healthPremium),
      tax: c(ontarioTax),
    },
    totalTax: c(totalTax),
    totalWithheld,
    refund,
    tuitionCarryforwardRemaining: c(tuition.remaining),
    warnings,
  }
}

/** ON428-A Part A (single): min(max, 5.05% x employment income) - 5% x (adjusted net income - $32,500). */
function liftCredit(l: { rate: Q; max: Q; singleThreshold: Q; reductionRate: Q }, employmentIncome: Q, adjustedNetIncome: Q): Q {
  const maxCredit = min(r2(mul(l.rate, employmentIncome)), l.max) // line 5
  const reduction = r2(mul(l.reductionRate, floor0(sub(adjustedNetIncome, l.singleThreshold)))) // line 19
  return floor0(sub(maxCredit, reduction)) // line 20
}
