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
 * @property {{title: string, items: string[]}=} keyNotes
 * @property {string=} checklist
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
            lastReviewed: '2024-11-15',
            range: { min: 8, max: 12 }
          },
          {
            id: 'acp-adult-pressure',
            title: 'Perfusion pressure',
            value: '40–60',
            unit: 'mmHg',
            info: 'Right radial artery pressure reference.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-adult-temp',
            title: 'Perfusate temp',
            value: '23–28',
            unit: '°C',
            notes: 'Moderate hypothermia',
            info: 'Moderate hypothermia is often favored over deep for neurologic outcomes.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-adult-ph',
            title: 'pH management',
            value: 'Alpha-stat',
            unit: '',
            info: 'Preserves cerebral autoregulation; reduces embolization risk.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-adult-duration',
            title: 'Duration',
            value: 'Up to 80',
            unit: 'min (reference)',
            notes: 'Varies by center/monitoring/bilateral ACP',
            info: 'Reported durations vary; if >40–50 min, consider bilateral ACP.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-adult-monitoring',
            title: 'Monitoring',
            value: 'NIRS (rSO₂), EEG',
            unit: '',
            info: 'Confirm left-right balance with bilateral NIRS.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-adult-hct',
            title: 'Hct',
            value: '25–30',
            unit: '%',
            lastReviewed: '2024-11-15'
          }
        ],
        pediatric: [
          {
            id: 'acp-peds-flow',
            title: 'Flow rate',
            value: '40–80',
            unit: 'mL/kg/min',
            notes: 'Reference 50–64',
            info: 'Neonates: ~46 ± 6 mL/kg/min; <30 mL/kg/min risks hypoxic injury.',
            lastReviewed: '2024-11-15',
            range: { min: 40, max: 80 }
          },
          {
            id: 'acp-peds-pressure',
            title: 'Perfusion pressure',
            value: 'Titrate',
            unit: '',
            notes: 'Often 20–25 mmHg reported',
            info: 'Higher MAP targets are used in some centers; adjust per protocol/monitoring site.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-temp',
            title: 'Perfusate temp',
            value: '18–25',
            unit: '°C',
            info: '25°C moderate hypothermia preserves rSO₂; moderate often favored vs deep.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-ph',
            title: 'pH management',
            value: 'pH-stat',
            unit: '',
            info: 'Often preferred in neonates/infants for cerebral protection.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-duration',
            title: 'Duration',
            value: '20–48',
            unit: 'min (reference)',
            info: 'Up to ~123 min reported; >45 min DHCA avoidance is common.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-monitoring',
            title: 'Monitoring',
            value: 'NIRS, EEG',
            unit: '',
            notes: 'TCD optional',
            info: 'Use baseline/trend changes and bilateral symmetry rather than absolute values.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-hct',
            title: 'Hct',
            value: '30–35',
            unit: '%',
            info: 'Neonatal/infant arch ACP + hypothermia commonly uses Hct 30–35% (adjust per protocol/NIRS/EEG).',
            lastReviewed: '2024-11-15'
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
          value: '20–30',
          unit: 'mmHg',
          notes: 'Target 20–25',
          info: 'Excess pressure increases brain edema risk.',
          lastReviewed: '2024-11-15'
        },
          {
            id: 'rcp-flow',
            title: 'Flow rate',
            value: '300–500',
            unit: 'mL/min',
            notes: 'Pressure-driven (SVC <25)',
            info: 'Flow is titrated to pressure; 300–500 mL/min is commonly cited.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'rcp-monitoring',
            title: 'Monitoring',
            value: 'NIRS, EEG',
            unit: '',
            notes: 'TCD optional',
            info: 'Use baseline/trend changes and bilateral symmetry rather than absolute values.',
            lastReviewed: '2024-11-15'
          }
      ]
    },
    {
      id: 'muf',
      label: 'MUF',
      intro: {
        title: 'MUF (Modified Ultrafiltration)',
        subtitle: 'Post-CPB hemoconcentration & fluid removal',
        guidance: '(Pediatric strongly recommended / Adult selective)'
      },
      tableColumns: {
        label: 'Parameter',
        pediatric: 'Pediatric (Strongly Recommended)',
        adult: 'Adult (Selective Use)',
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
          label: 'Flow Rate',
          pediatric: '10–20 mL/kg/min',
          adult: '150–300 mL/min',
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
          adult: '≥30–35%',
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
      keyNotes: {
        title: 'Key Notes',
        items: [
          'Indications: anticipated fluid overload, low Hct post-CPB, pediatric congenital (unless contraindicated).',
          'Monitoring: NIRS, CVP, arterial pressure, continuous hemodynamics; decrease flow or pause if NIRS drops.',
          'Anticoagulation: maintain adequate levels with ACT monitoring.',
          'Reference: AmSECT Pediatric Guideline 16.1 (2019~), 2024 EACTS Adult CPB Guidelines (blood conservation section).',
          'Follow institutional protocols; educational use only.'
        ]
      },
      cards: []
    },
    {
      id: 'tca',
      label: 'HCA',
      headerTitle: 'HCA by Temperature (Conservative Estimates)',
      tableRows: [
        {
          id: 'hca-28-30',
          temperature: '28–30<br>(Mild–Moderate)',
          duration: '10–15 (conservative)',
          notes: '<strong>MHCA + ACP</strong> ≤40 min possible; shorter CPB time, less coagulopathy',
          severity: 'safe',
          tooltip: 'Mild-moderate hypothermia with ACP can extend safe duration.'
        },
        {
          id: 'hca-24-28',
          temperature: '24–28 (Moderate)',
          duration: '15–20 (conservative)',
          notes: '<strong>ACP/RCP required</strong>; recent trend with lower stroke risk',
          severity: 'caution',
          tooltip: 'Moderate hypothermia commonly paired with ACP/RCP.'
        },
        {
          id: 'hca-20-24',
          temperature: '20–24<br>(Low–Moderate)',
          duration: '20–30',
          notes: '<strong>ACP</strong> shows non-inferior cognitive outcomes vs DHCA',
          severity: 'caution',
          tooltip: 'Low-moderate ranges benefit from ACP support.'
        },
        {
          id: 'hca-18-20',
          temperature: '18–20 (Deep)',
          duration: '~30 (conservative; up to 40 with caution)',
          notes: 'Isolated DHCA: limit 30; >40 ↑ neurologic injury risk',
          severity: 'high',
          tooltip: 'Deep hypothermia has higher risk beyond 30–40 minutes.'
        },
        {
          id: 'hca-<18',
          temperature: '<18 (Profound)',
          duration: '30–45',
          notes: 'High coagulopathy risk; rarely used',
          severity: 'high',
          tooltip: 'Profound hypothermia is uncommon due to bleeding risk.'
        }
      ]
    }
  ]
};
