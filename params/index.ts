/**
 * Registry of every parameter file. Adding a tax year or a mid-year edition
 * means adding the JSON file and one import line here (see README).
 */
import type { RawAnnualParams, RawWithholdingEdition } from '../src/engine/params/types.ts'
import annual2026 from './annual/2026.json'
import w20260101 from './withholding/2026-01-01.json'
import w20260701 from './withholding/2026-07-01.json'

export const rawWithholdingEditions: readonly RawWithholdingEdition[] = [w20260101, w20260701]

export const rawAnnualParams: readonly RawAnnualParams[] = [annual2026]
