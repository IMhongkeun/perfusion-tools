# Perfusion Tools – Pediatric Echo Normal Size Predictor (PHN)

## Project purpose
This update adds a **mobile-friendly PHN inverse predictor** to the existing static Perfusion Tools app.

- Input: BSA (m²)
- Output: predicted normal size range for six pediatric echo structures at **Z = -2, 0, +2**
- Display unit: **mm** (2 decimal places)
- Internal calculation unit: **cm**
- Optional BSA helper: Haycock formula from height/weight

## Calculation model (fixed for v1)
PHN indexed mean/SD inverse predictor is used as the primary model.

- Inverse formula:
  - `raw_cm(z) = (mean + z * sd) * (BSA ** alpha)`
- Forward formula (for measured value option):
  - `z = ((measured_cm / (BSA ** alpha)) - mean) / sd`
- Display conversion:
  - `display_mm = raw_cm * 10`

> Raw regression equations are included **only for developer sanity comparison**, not as the primary prediction engine.

## Included structures (v1)
- Aortic annulus (ANN)
- Tricuspid valve lateral diameter (TV_LAT)
- Mitral valve lateral diameter (MV_LAT)
- Main pulmonary artery (MPA)
- Left pulmonary artery (LPA)
- Right pulmonary artery (RPA)

## Coefficient source handling
- PHN indexed mean/SD + alpha coefficients are stored in `data/phnCoefficients.js`.
- Raw regression reference coefficients are stored in the same file for debug-only comparison.

## Safety / warning behavior
- Reference BSA range badge warnings: **0.15–2.50 m²**
- Additional warning for **BSA > 2.0 m²** (pediatric extrapolation caution)
- Invalid BSA/height/weight/measured values trigger conservative error handling.
- Negative Z=-2 raw values are not altered in core math; UI display clamps via helper.

## Medical disclaimer
- Pediatric Heart Network normal echo z-score model based reference tool.
- Pediatric/adolescent reference use.
- Does not replace surgical/interventional clinical decision-making.
- Use extrapolation caution at high BSA.
- Not an adult reference tool.

## How to run
```bash
npm test
```
(Static app can be opened directly in browser via `index.html`.)

## Tests included
- Inverse formula exactness checks against `value_mm = (mean + z*sd) * BSA^alpha * 10`
- Snapshot-style output generation for BSA: 0.5, 1.0, 1.5, 2.0
- Forward/inverse round-trip checks (z≈0, z≈+2, z≈-2)
- Invalid input and BSA warning checks

## Example outputs (mm)
### BSA 0.50
| Structure | Z=-2 | Z=0 | Z=+2 |
|---|---:|---:|---:|
| Aortic annulus | 8.49 | 10.47 | 12.45 |
| Tricuspid valve (lateral) | 12.59 | 16.69 | 20.79 |
| Mitral valve (lateral) | 12.66 | 15.77 | 18.88 |
| Main pulmonary artery | 9.48 | 12.87 | 16.26 |
| Left pulmonary artery | 5.23 | 7.78 | 10.32 |
| Right pulmonary artery | 5.02 | 7.57 | 10.11 |

### BSA 1.00
| Structure | Z=-2 | Z=0 | Z=+2 |
|---|---:|---:|---:|
| Aortic annulus | 12.00 | 14.80 | 17.60 |
| Tricuspid valve (lateral) | 17.80 | 23.60 | 29.40 |
| Mitral valve (lateral) | 17.90 | 22.30 | 26.70 |
| Main pulmonary artery | 13.40 | 18.20 | 23.00 |
| Left pulmonary artery | 7.40 | 11.00 | 14.60 |
| Right pulmonary artery | 7.10 | 10.70 | 14.30 |

### BSA 1.50
| Structure | Z=-2 | Z=0 | Z=+2 |
|---|---:|---:|---:|
| Aortic annulus | 14.70 | 18.13 | 21.56 |
| Tricuspid valve (lateral) | 21.80 | 28.90 | 36.01 |
| Mitral valve (lateral) | 21.92 | 27.31 | 32.70 |
| Main pulmonary artery | 16.41 | 22.29 | 28.17 |
| Left pulmonary artery | 9.06 | 13.47 | 17.88 |
| Right pulmonary artery | 8.70 | 13.10 | 17.51 |

## Extension notes
- To add new structures, append coefficient rows in `data/phnCoefficients.js` and add a key to `PHN_STRUCTURE_ORDER`.
- Measured-value forward z-score UI and logic are already wired and can be expanded with structure-specific validation if needed.
