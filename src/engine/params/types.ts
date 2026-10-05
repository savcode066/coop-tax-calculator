import { parseDecimal, parseDollars, type Q } from '../money.ts'

/** Every value in the JSON parameter files carries the document it came from. */
export interface Sourced {
  value: string
  source: string
}

// ---------------------------------------------------------------------------
// Raw JSON shapes (exactly what lives in params/*.json)
// ---------------------------------------------------------------------------

export interface RawBracket {
  threshold: Sourced
  rate: Sourced
  constant?: Sourced
}

export interface RawHealthPremiumTier {
  over: Sourced
  rate: Sourced
  base: Sourced
  max: Sourced
}

export interface RawCpp {
  ympe: Sourced
  basicExemption: Sourced
  totalRate: Sourced
  maxContribution: Sourced
  baseRate: Sourced
  maxBaseContribution: Sourced
  firstAdditionalRate: Sourced
  yampe: Sourced
  secondAdditionalRate: Sourced
  maxSecondContribution: Sourced
}

export interface RawEi {
  maxInsurableEarnings: Sourced
  rate: Sourced
  maxPremium: Sourced
}

export interface RawBpa {
  max: Sourced
  min: Sourced
  phaseOutStart: Sourced
  phaseOutEnd: Sourced
}

export interface RawOntario {
  brackets: RawBracket[]
  basicPersonalAmount: Sourced
  surtax: { threshold: Sourced; rate: Sourced }[]
  taxReduction: { basicAmount: Sourced; perDependant: Sourced }
  healthPremium: RawHealthPremiumTier[]
}

export interface RawWithholdingEdition {
  edition: string
  effectiveFrom: string
  taxYear: number
  documentUrl: string
  federal: { brackets: RawBracket[]; basicPersonalAmount: RawBpa; canadaEmploymentAmount: Sourced }
  ontario: RawOntario
  cpp: RawCpp
  ei: RawEi
}

export interface RawAnnualParams {
  taxYear: number
  status: string
  federal: {
    brackets: RawBracket[]
    basicPersonalAmount: RawBpa
    canadaEmploymentAmount: Sourced
    topUpCredit: { rate: Sourced }
  }
  cpp: RawCpp & { actualBaseShare: Sourced }
  ei: RawEi & { refundAllIfInsurableBelow: Sourced; minimumRefund: Sourced }
  ontario: RawOntario & {
    lift: { rate: Sourced; max: Sourced; singleThreshold: Sourced; reductionRate: Sourced }
  }
}

// ---------------------------------------------------------------------------
// Parsed shapes used by the engines. Money is a cents-valued Q; rates are Q.
// ---------------------------------------------------------------------------

export interface Bracket {
  /** Lower bound of the bracket, in cents. */
  threshold: Q
  rate: Q
  /** T4127 constant (K / KP), in cents. Zero when not supplied. */
  constant: Q
}

export interface HealthPremiumTier {
  over: Q
  rate: Q
  base: Q
  max: Q
}

export interface CppParams {
  ympe: Q
  basicExemption: Q
  totalRate: Q
  maxContribution: Q
  baseRate: Q
  maxBaseContribution: Q
  firstAdditionalRate: Q
  yampe: Q
  secondAdditionalRate: Q
  maxSecondContribution: Q
}

export interface EiParams {
  maxInsurableEarnings: Q
  rate: Q
  maxPremium: Q
}

export interface BpaParams {
  max: Q
  min: Q
  phaseOutStart: Q
  phaseOutEnd: Q
}

export interface OntarioParams {
  brackets: Bracket[]
  lowestRate: Q
  basicPersonalAmount: Q
  surtax: { threshold: Q; rate: Q }[]
  taxReduction: { basicAmount: Q; perDependant: Q }
  healthPremium: HealthPremiumTier[]
}

export interface FederalParams {
  brackets: Bracket[]
  lowestRate: Q
  basicPersonalAmount: BpaParams
  canadaEmploymentAmount: Q
}

export interface WithholdingParams {
  edition: string
  effectiveFrom: string
  taxYear: number
  documentUrl: string
  federal: FederalParams
  ontario: OntarioParams
  cpp: CppParams
  ei: EiParams
}

export interface AnnualParams {
  taxYear: number
  status: string
  federal: FederalParams & { topUpRate: Q }
  cpp: CppParams & { actualBaseShare: Q }
  ei: EiParams & { refundAllIfInsurableBelow: Q; minimumRefund: Q }
  ontario: OntarioParams & {
    lift: { rate: Q; max: Q; singleThreshold: Q; reductionRate: Q }
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const $ = (s: Sourced): Q => parseDollars(s.value)
const r = (s: Sourced): Q => parseDecimal(s.value)

const brackets = (raw: RawBracket[]): Bracket[] => {
  if (raw.length === 0) throw new Error('Bracket table is empty')
  return raw.map((b) => ({
    threshold: $(b.threshold),
    rate: r(b.rate),
    constant: b.constant ? $(b.constant) : parseDollars('0'),
  }))
}

const lowest = (bs: Bracket[]): Q => bs[0]!.rate

const cpp = (c: RawCpp): CppParams => ({
  ympe: $(c.ympe),
  basicExemption: $(c.basicExemption),
  totalRate: r(c.totalRate),
  maxContribution: $(c.maxContribution),
  baseRate: r(c.baseRate),
  maxBaseContribution: $(c.maxBaseContribution),
  firstAdditionalRate: r(c.firstAdditionalRate),
  yampe: $(c.yampe),
  secondAdditionalRate: r(c.secondAdditionalRate),
  maxSecondContribution: $(c.maxSecondContribution),
})

const ei = (e: RawEi): EiParams => ({
  maxInsurableEarnings: $(e.maxInsurableEarnings),
  rate: r(e.rate),
  maxPremium: $(e.maxPremium),
})

const bpa = (b: RawBpa): BpaParams => ({
  max: $(b.max),
  min: $(b.min),
  phaseOutStart: $(b.phaseOutStart),
  phaseOutEnd: $(b.phaseOutEnd),
})

const ontario = (o: RawOntario): OntarioParams => {
  const bs = brackets(o.brackets)
  return {
    brackets: bs,
    lowestRate: lowest(bs),
    basicPersonalAmount: $(o.basicPersonalAmount),
    surtax: o.surtax.map((s) => ({ threshold: $(s.threshold), rate: r(s.rate) })),
    taxReduction: { basicAmount: $(o.taxReduction.basicAmount), perDependant: $(o.taxReduction.perDependant) },
    healthPremium: o.healthPremium.map((t) => ({ over: $(t.over), rate: r(t.rate), base: $(t.base), max: $(t.max) })),
  }
}

export function parseWithholdingEdition(raw: RawWithholdingEdition): WithholdingParams {
  const fb = brackets(raw.federal.brackets)
  return {
    edition: raw.edition,
    effectiveFrom: raw.effectiveFrom,
    taxYear: raw.taxYear,
    documentUrl: raw.documentUrl,
    federal: {
      brackets: fb,
      lowestRate: lowest(fb),
      basicPersonalAmount: bpa(raw.federal.basicPersonalAmount),
      canadaEmploymentAmount: $(raw.federal.canadaEmploymentAmount),
    },
    ontario: ontario(raw.ontario),
    cpp: cpp(raw.cpp),
    ei: ei(raw.ei),
  }
}

export function parseAnnualParams(raw: RawAnnualParams): AnnualParams {
  const fb = brackets(raw.federal.brackets)
  return {
    taxYear: raw.taxYear,
    status: raw.status,
    federal: {
      brackets: fb,
      lowestRate: lowest(fb),
      basicPersonalAmount: bpa(raw.federal.basicPersonalAmount),
      canadaEmploymentAmount: $(raw.federal.canadaEmploymentAmount),
      topUpRate: r(raw.federal.topUpCredit.rate),
    },
    cpp: { ...cpp(raw.cpp), actualBaseShare: r(raw.cpp.actualBaseShare) },
    ei: {
      ...ei(raw.ei),
      refundAllIfInsurableBelow: $(raw.ei.refundAllIfInsurableBelow),
      minimumRefund: $(raw.ei.minimumRefund),
    },
    ontario: {
      ...ontario(raw.ontario),
      lift: {
        rate: r(raw.ontario.lift.rate),
        max: $(raw.ontario.lift.max),
        singleThreshold: $(raw.ontario.lift.singleThreshold),
        reductionRate: r(raw.ontario.lift.reductionRate),
      },
    },
  }
}
