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
            notes: 'Adult ACP target',
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
            unit: 'min (elective)',
            info: 'If >40–50 min, consider bilateral ACP.',
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
            notes: 'Median 50–64',
            info: 'Neonates: ~46 ± 6 mL/kg/min; <30 mL/kg/min risks hypoxic injury.',
            lastReviewed: '2024-11-15',
            range: { min: 40, max: 80 }
          },
          {
            id: 'acp-peds-pressure',
            title: 'Perfusion pressure',
            value: '20–25',
            unit: 'mmHg',
            info: 'Lower pressures may be adequate in neonates; some protocols use 40–60.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-temp',
            title: 'Temperature',
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
            unit: 'min (median)',
            info: 'Up to ~123 min reported; >45 min DHCA avoidance is common.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-monitoring',
            title: 'Monitoring',
            value: 'NIRS, TCD',
            unit: '',
            info: 'Target rSO₂ 90–95%; TCD velocity 18–25 cm/sec; EEG for seizures.',
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
          value: '100–500',
          unit: 'mL/min',
          notes: 'Prefer 150–300',
          info: 'Max 500 mL/min; adjust based on pressure.',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'rcp-monitoring',
          title: 'Monitoring',
          value: 'NIRS, EEG',
          unit: '',
          notes: 'TCD optional',
          info: 'rScO₂ >60–70% bilateral; EEG for burst suppression/ischemia.',
          lastReviewed: '2024-11-15'
        }
      ]
    },
    {
      id: 'tca',
      label: 'HCA Safety Time',
      headerTitle: 'HCA Safety Time by Temperature (Conservative Estimates)',
      tableRows: [
        {
          id: 'hca-28-30',
          temperature: '28–30 (Mild–Moderate)',
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
          temperature: '20–24 (Low–Moderate)',
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
      ],
      noteLines: [
        'Varies by center, patient factors (age, comorbidities), neuromonitoring (NIRS rSO₂ >50–60%, EEG), and use of ACP/RCP.',
        'Always minimize circulatory arrest time.',
        'Cooling time: at least 20–50 min; Rewarming: ≤0.5°C/min recommended.',
        'Reference: 2024 EACTS/EACTAIC/EBCP Guidelines (conservative estimates).',
        'Follow institutional protocols and patient monitoring; educational use only.'
      ]
    }
  ]
};
