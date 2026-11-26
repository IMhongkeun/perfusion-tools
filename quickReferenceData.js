'use strict';

/**
 * @typedef {Object} QuickReferenceReference
 * @property {string} label
 * @property {string=} url
 */

/**
 * @typedef {Object} QuickReferenceCard
 * @property {string} id
 * @property {string} title
 * @property {string} value
 * @property {string} unit
 * @property {string=} notes
 * @property {string=} info
 * @property {string=} copyText
 * @property {{label: string, url?: string}[]=} references
 * @property {string=} lastReviewed
 * @property {{min: number, max: number}=} range
 */

/**
 * @typedef {Object} QuickReferenceTab
 * @property {string} id
 * @property {string} label
 * @property {QuickReferenceCard[]} cards
 * @property {{adult?: QuickReferenceCard[], pediatric?: QuickReferenceCard[]}=} profiles
 * @property {{durations: number[], defaultDuration: number, endpointText: string}=} calculator
 * @property {{title: string, subtitle: string, guidance: string}=} intro
 * @property {{label: string, value: string, unit?: string}=} tableColumns
 * @property {{label: string, rangeLabel: string, unitLabel: string, range: {min: number, max: number}}=} miniCalculator
 * @property {{id: string, label: string, pediatric: string, adult: string, notes?: string, highlight?: string}[]=} tableRows
 * @property {string=} checklist
 * @property {string=} durationColumnLabel
 * @property {string[]=} footnotes
 */

/** @type {{tabs: QuickReferenceTab[]}} */
window.quickReferenceData = {
  tabs: [
    {
      id: 'acp',
      label: 'ACP',
      profiles: {
        adult: [
          {
            id: 'acp-adult-flow',
            title: 'Flow rate',
            value: '8–12',
            unit: 'mL/kg/min',
            info: 'High-flow may increase cerebral edema risk; titrate with monitoring.',
            lastReviewed: '2026-11-27',
            range: { min: 8, max: 12 }
          },
          {
            id: 'acp-adult-pressure',
            title: 'Perfusion pressure',
            value: '40–60',
            unit: 'mmHg',
            info: 'Right radial artery pressure reference.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'acp-adult-temp',
            title: 'Perfusate temp',
            value: '23–28',
            unit: '°C',
            notes: 'Moderate hypothermia',
            info: 'Moderate hypothermia is often favored over deep for neurologic outcomes.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'acp-adult-ph',
            title: 'pH management',
            value: 'Alpha-stat',
            unit: '',
            info: 'Preserves cerebral autoregulation; reduces embolization risk.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'acp-adult-duration',
            title: 'Duration',
            value: 'Up to ~80',
            unit: 'min (observed)',
            notes: 'Elective observational data; not a safety limit',
            info: 'In 2,008 elective arch cases with ACP, circulatory arrest up to at least 80 min was not associated with a significant increase in mortality or permanent stroke. No universal safe limit is established. If >40–50 min is expected, consider bilateral ACP.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'acp-adult-monitoring',
            title: 'Monitoring',
            value: 'NIRS (rSO₂), EEG',
            unit: '',
            info: 'Confirm left-right balance with bilateral NIRS.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'acp-adult-hct',
            title: 'Hct',
            value: '25–30',
            unit: '%',
            lastReviewed: '2026-11-27'
          }
        ],
        pediatric: [
          {
            id: 'acp-peds-flow',
            title: 'Flow rate',
            value: '40–80',
            unit: 'mL/kg/min',
            notes: 'Reference 50–64',
            info: 'Mean 46 ± 6 mL/kg/min at ~25°C in children <5 y (72% neonates); 56.6 ± 10.6 mL/kg/min at 18°C in neonates. <30 mL/kg/min is inadequate for many patients.',
            lastReviewed: '2026-11-27',
            range: { min: 40, max: 80 }
          },
          {
            id: 'acp-peds-pressure',
            title: 'Perfusion pressure',
            value: 'Titrate',
            unit: '',
            notes: 'Often 20–25 mmHg reported',
            info: 'Higher MAP targets are used in some centers; adjust per protocol/monitoring site.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'acp-peds-temp',
            title: 'Perfusate temp',
            value: '18–25',
            unit: '°C',
            info: '25°C moderate hypothermia preserves rSO₂; moderate often favored vs deep.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'acp-peds-ph',
            title: 'pH management',
            value: 'pH-stat',
            unit: '',
            info: 'Often preferred in neonates/infants for cerebral protection.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'acp-peds-duration',
            title: 'Duration',
            value: 'No fixed limit',
            unit: '',
            notes: 'Observed: median 48 (10–123) at ~25°C; 71 ± 28 at 18°C',
            info: 'No universal safe ACP duration is established. Observed times vary with protocol and temperature.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'acp-peds-monitoring',
            title: 'Monitoring',
            value: 'NIRS, EEG',
            unit: '',
            notes: 'TCD optional',
            info: 'Use baseline/trend changes and bilateral symmetry rather than absolute values.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'acp-peds-hct',
            title: 'Hct',
            value: '30–35',
            unit: '%',
            info: 'Neonatal/infant arch ACP + hypothermia commonly uses Hct 30–35% (adjust per protocol/NIRS/EEG).',
            lastReviewed: '2026-11-27'
          }
        ]
      }
    },
    {
      id: 'rcp',
      label: 'RCP',
      cards: [
        {
          id: 'rcp-svc-pressure',
          title: 'SVC pressure',
          value: '~20–25',
          unit: 'mmHg',
          notes: 'Maintenance reference',
          info: 'Pressure-regulated RCP; adjust to measurement site and neuromonitoring. Excess pressure increases brain edema risk.',
          lastReviewed: '2026-11-27'
        },
          {
            id: 'rcp-flow',
            title: 'Flow rate',
            value: '300–500',
            unit: 'mL/min',
            notes: 'Pressure-driven (SVC ~20–25)',
            info: 'Flow is titrated to pressure; 300–500 mL/min is commonly cited.',
            lastReviewed: '2026-11-27'
          },
          {
            id: 'rcp-monitoring',
            title: 'Monitoring',
            value: 'NIRS, EEG',
            unit: '',
            notes: 'TCD optional',
            info: 'Use baseline/trend changes and bilateral symmetry rather than absolute values.',
            lastReviewed: '2026-11-27'
          }
      ]
    },
    {
      id: 'tca',
      label: 'HCA',
      headerTitle: 'HCA by Temperature',
      durationColumnLabel: 'Model-estimated arrest time without cerebral perfusion',
      footnotes: [
        'Historical cerebral-metabolism model estimates (McCullough 1999), not clinically validated safe limits. Values in minutes. Published model points: 30°C ≈9, 25°C ≈14, 20°C ≈21, 15°C ≈31, 10°C ≈45. *Calculated here with the same model assumptions (5 min tolerated at 37°C; cerebral Q10 2.3): time = 5 × 2.3^((37 − T)/10), rounded to whole minutes. Temperature categories follow EACTS 2024 Table 3 (core rectal/bladder temperature); the 2013 consensus uses nasopharyngeal temperature.',
        'Hypothermia-only arrest estimates do not directly apply when ACP is used. Assess cerebral protection using perfusion adequacy and neuromonitoring. If lower-body perfusion is interrupted, consider lower-body ischemic time separately. Temperature alone does not define a universal safe duration.'
      ],
      tableRows: [
        {
          id: 'hca-28-30',
          temperature: '28–30<br>(Mild)',
          duration: '~9 (30°C) to ~11* (28°C)',
          notes: 'Shorter CPB time, less coagulopathy'
        },
        {
          id: 'hca-24-28',
          temperature: '24–28<br>(High-moderate)',
          duration: '~11* (28°C), ~14 (25°C), ~15* (24°C)',
          notes: '—'
        },
        {
          id: 'hca-20-24',
          temperature: '20–24<br>(Low-moderate)',
          duration: '~15* (24°C) to ~21 (20°C)',
          notes: '—'
        },
        {
          id: 'hca-18-20',
          temperature: '18–20 (Deep)',
          duration: '~21 (20°C) to ~24* (18°C)',
          notes: 'Guideline text: isolated deep HCA should not exceed 30–40 min (EACTS 2024)'
        },
        {
          id: 'hca-<18',
          temperature: '<18<br>(Deep; profound ≤14)',
          duration: '~24* (18°C), ~31 (15°C), ~45 (10°C)',
          notes: 'High coagulopathy risk; rarely used',
          tooltip: 'Profound hypothermia is uncommon due to bleeding risk.'
        }
      ]
    },
    {
      id: 'muf',
      label: 'MUF',
      intro: {
        title: 'MUF (Modified Ultrafiltration)',
        subtitle: 'Post-CPB hemoconcentration & fluid removal',
        guidance: '(Pediatric: consider unless contraindicated / Adult: high-risk or anaemic patients)'
      },
      tableColumns: {
        label: 'Parameter',
        pediatric: 'Pediatric (Consider unless contraindicated)',
        adult: 'Adult (High-risk or anaemic)',
        notes: 'Notes'
      },
      miniCalculator: {
        label: 'Pediatric MUF flow range',
        rangeLabel: 'Flow range',
        unitLabel: 'mL/min',
        range: { min: 10, max: 20 }
      },
      tableRows: [
        {
          id: 'muf-flow-rate',
          label: 'Blood flow through filter',
          pediatric: '10–20 mL/kg/min',
          adult: '150–300 mL/min (study protocol)',
          notes: 'Start slow, titrate to hemodynamics',
          highlight: 'pediatric'
        },
        {
          id: 'muf-duration',
          label: 'Duration',
          pediatric: '10–20 min or until goal',
          adult: '10–15 min',
          notes: 'Until target Hct or volume removed',
          highlight: 'pediatric'
        },
        {
          id: 'muf-target-hct',
          label: 'Target Hct',
          pediatric: '≥35–40%',
          adult: 'No established endpoint',
          notes: 'Or minimize transfusion/bleeding',
          highlight: 'pediatric'
        },
        {
          id: 'muf-circuit',
          label: 'Circuit',
          pediatric: 'A-V MUF (preferred)',
          adult: 'A-V or similar',
          notes: 'Heat exchanger required',
          highlight: 'pediatric'
        },
        {
          id: 'muf-pressure',
          label: 'Pressure',
          pediatric: 'Arterial line always positive',
          adult: 'Arterial line always positive',
          notes: 'Negative pressure → air embolism risk!',
          highlight: 'pediatric'
        }
      ],
      checklist: 'Pre-MUF checklist: Unslave pump, warm exchanger, confirm air-free circuit, maintain positive arterial pressure.',
      cards: []
    }
  ]
};
