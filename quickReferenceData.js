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
 */

/** @type {{tabs: QuickReferenceTab[]}} */
window.quickReferenceData = {
  tabs: [
    {
      id: 'acp',
      label: 'ACP',
      cards: [
        {
          id: 'acp-flow-standard',
          title: 'Flow rate',
          value: '8–12',
          unit: 'mL/kg/min',
          notes: 'Adult ACP target',
          info: 'High-flow may increase cerebral edema risk; titrate with monitoring.',
          lastReviewed: '2024-11-15',
          range: { min: 8, max: 12 }
        },
        {
          id: 'acp-pressure',
          title: 'Perfusion pressure',
          value: '40–60',
          unit: 'mmHg',
          info: 'Use radial artery pressure reference.',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'acp-temp',
          title: 'Perfusate temp',
          value: '23–28',
          unit: '°C',
          notes: 'Moderate hypothermia',
          info: 'Moderate hypothermia is often favored over deep for neurologic outcomes.',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'acp-ph',
          title: 'pH management',
          value: 'Alpha-stat',
          unit: '',
          info: 'Preserves cerebral autoregulation; reduces embolization risk.',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'acp-duration',
          title: 'Duration',
          value: 'Up to 80',
          unit: 'min (elective)',
          info: 'If >40–50 min, consider bilateral ACP.',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'acp-monitoring',
          title: 'Monitoring',
          value: 'NIRS (rSO₂), EEG',
          unit: '',
          info: 'Confirm left-right balance with bilateral NIRS.',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'acp-hct',
          title: 'Hct',
          value: '25–30',
          unit: '%',
          lastReviewed: '2024-11-15'
        }
      ]
    },
    {
      id: 'rcp',
      label: 'RCP',
      cards: [
        {
          id: 'rcp-svc-pressure',
          title: 'SVC Pressure limit',
          value: '≤ 25',
          unit: 'mmHg',
          notes: 'Pressure-first strategy',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'rcp-flow',
          title: 'Typical adult flow',
          value: '300–500',
          unit: 'mL/min',
          notes: 'Adjust to keep SVC pressure ≤25',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'rcp-note',
          title: 'Note',
          value: 'Titrate to monitoring response (NIRS/EEG)',
          unit: '',
          lastReviewed: '2024-11-15'
        }
      ]
    },
    {
      id: 'tca',
      label: 'TCA Safety Time',
      cards: [
        {
          id: 'tca-28c',
          title: '28°C',
          value: '10–20',
          unit: 'min (conservative)',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'tca-18c',
          title: '18°C',
          value: '~30',
          unit: 'min (conservative)',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'tca-note',
          title: 'Note',
          value: 'Varies by center, monitoring, and use of ACP/RCP',
          unit: '',
          lastReviewed: '2024-11-15'
        }
      ]
    }
  ]
};
