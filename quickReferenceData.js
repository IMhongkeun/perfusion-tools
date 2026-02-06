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
          title: 'Flow rate (general)',
          value: '10–15',
          unit: 'mL/kg/min',
          notes: 'General recommendation',
          lastReviewed: '2024-11-15',
          range: { min: 10, max: 15 }
        },
        {
          id: 'acp-flow-nirs',
          title: 'Flow rate (NIRS monitoring)',
          value: '40–60',
          unit: 'mL/kg/min',
          notes: 'Used in select studies with NIRS monitoring',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'acp-pressure',
          title: 'Perfusion pressure',
          value: '40–70',
          unit: 'mmHg',
          lastReviewed: '2024-11-15'
        },
        {
          id: 'acp-temp',
          title: 'Perfusate temp',
          value: '20–28',
          unit: '°C',
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
