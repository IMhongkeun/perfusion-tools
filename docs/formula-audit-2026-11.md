# PerfusionTools 수식·계수 검증 감사 (2026-11)

- 기준 커밋: `main` @ `1c1623b` (2026-11-10 기준)
- 감사 브랜치: `audit/formula-verification-2026-11`
- 성격: **감사 전용.** 수식, 계수, 단위, 임계값, 기본값, 참조 데이터, UI는 변경하지 않았다. 이 문서 한 개만 추가했다.
- 실행 환경: Node.js v22, `npm ci && npm run build && TZ=UTC npm test` (작업 전·후 모두 통과)

## 0. 읽는 법

### 판정

| 기호 | 의미 |
|---|---|
| ✅ 일치 | 1차 출처(또는 수학적 정의)와 코드가 일치 |
| ❌ 불일치 | 1차 출처와 코드가 다름 |
| ⚠️ 표기 불일치 | 계산은 의도대로 동작하지만 화면 표기·단위·설명이 코드와 다름 |
| 🔶 관행 차이 | 단일 정답이 없는 임상 선택. 근거 범위를 적음 |
| ❓ 출처 확인 불가 | 1차 출처 원문에 접근하지 못했거나 출처 자체가 특정되지 않음 |

심각도: **High**(임상 결정에 영향 가능) · **Medium** · **Low**(표기·문구)

### 이 감사의 한계 (먼저 읽을 것)

1. **1차 출처 접근 제한.** 원문을 직접 읽어 계수를 확인한 것은 Lopez 2017(PMC 전문), Haycock 1978(초록에 식 포함), de Somer 2011(전문), Ranucci 2018 GIFT(저자 수락본), STS/SCA/AmSECT 2018(PMC 전문), El Dsouki 2025(PMC 전문), Lopez 2021 Table 1(PMC 표 페이지), Levy 2024·Vienne 2018·McCullough 1999(초록)이다. 그 외는 유료이거나 스캔본이라 원문 대조를 하지 못했다. 그런 항목은 계수를 기억으로 채우지 않고 ❓로 두었으며, 피어리뷰 2차 문헌이나 표준 문서에 인용된 식과 일치하는지만 "2차 일치"로 따로 적었다. **"2차 일치"는 검증 완료가 아니다.**
2. **웹 원문은 텍스트 추출 도구로 읽었다.** 표의 숫자는 추출 결과를 그대로 옮겨 코드와 기계 비교했지만, 추출 과정의 오독 가능성이 0은 아니다. Lopez 2017 Table 2는 24개 구조물 × 4개 값이 전부 일치해 우연 일치 가능성은 낮다.
3. **배포본은 확인하지 못했다.** 이 감사는 저장소 `main` 소스 기준이다. 운영 사이트(perfusiontools.com)에 같은 커밋이 배포되어 있는지는 확인하지 않았다.
4. **worked example의 "기대값"** 은 출처 식을 감사자가 별도로 다시 구현해 계산한 값이다. 실제값은 `main.js`·`lib/phn.js`의 운영 코드를 Node `vm`으로 잘라 실행한 결과다(기존 `tests/*.test.js`와 같은 방식). 실행 스크립트는 저장소 밖(`/tmp`)에 두었고 커밋하지 않았다. 총 159개 비교 행을 실행했다.

### 판정 집계

| 판정 | 개수 |
|---|---|
| ✅ 일치 | 25 |
| ❌ 불일치 | 0 |
| ⚠️ 표기 불일치 | 9 |
| 🔶 관행 차이 | 12 |
| ❓ 출처 확인 불가 | 20 |
| 합계 | 66 |

심각도: High 1 · Medium 8 · Low 32 (✅ 25건은 심각도 없음)

**출처와 코드가 실제로 다른 것으로 확인된 계수·수식(❌)은 없다.** 다만 ❓ 20건은 "맞다"가 아니라 "확인하지 못했다"는 뜻이다. ❓ 가운데 6건(BSA-1·2·4·5, LBM-1·2)은 원문만 보지 못했을 뿐 2차 문헌의 인용 식과는 일치한다.

---

## 1. High · Medium 항목 (수정 방향은 제안일 뿐이며 코드는 변경하지 않음)

### High

#### QR-2. Quick Reference HCA 안전 시간 표 — 출처 확인 불가, "conservative" 표기가 비교 자료와 맞지 않음

- 위치: `quickReferenceData.js:202-247`, `quick-reference/index.html:491-497`
- 표기: 표 제목 "HCA by Temperature (Conservative Estimates)", 주석 "Reference: 2024 EACTS/EACTAIC/EBCP Guidelines (conservative estimates)".
- 확인 결과:
  - 2024 EACTS/EACTAIC/EBCP CPB 가이드라인 원문에서 이 온도별 시간 표를 확인하지 못했다(원문 미접근). 따라서 출처는 ❓.
  - 온도별 계산 안전 시간을 제시한 1차 자료인 McCullough 1999(Ann Thorac Surg 67:1895-9)의 표(J Nippon Med Sch 2023;90:11 재수록본으로 확인)는 37°C 5분, 30°C 9(8–10)분, 25°C 14(12–15)분, 20°C 21(17–24)분, 15°C 31(25–38)분, 10°C 45(36–62)분이다. 초록은 15°C 예측 안전 시간을 29분으로 적고 있다.

  | 사이트 행 | 사이트 값(분) | McCullough 1999 해당 온도 값(분) |
  |---|---|---|
  | 28–30°C | 10–15 | 30°C: 9 (8–10) |
  | 24–28°C | 15–20 | 25°C: 14 (12–15) |
  | 20–24°C | 20–30 | 20°C: 21 (17–24) |
  | 18–20°C | ~30 (up to 40) | 20°C: 21 (17–24), 15°C: 31 (25–38) |
  | <18°C | 30–45 | 15°C: 31, 10°C: 45 |

  18°C 이상 네 행은 상한(일부는 하한도)이 McCullough의 계산값보다 길다. 임상에서 18–20°C DHCA 30–40분을 허용 범위로 보는 관행은 실제로 있으므로 값 자체를 오류로 판정하지는 않는다. 문제는 **"conservative"라는 표기가 이 비교 자료로는 뒷받침되지 않고, 인용된 가이드라인에서 표를 확인할 수 없다**는 점이다.
- 판정: ❓ 출처 확인 불가 / High (순환정지 허용 시간은 임상 결정에 직접 쓰일 수 있는 수치)
- 제안: (1) 각 행의 출처를 가이드라인 절·표 번호까지 특정해 `references` 필드에 넣는다. (2) 특정되지 않으면 "conservative" 표기를 빼거나 McCullough 계산값을 병기한다. (3) 단독 HCA 기준인지 ACP 병용 기준인지 열을 분리한다.

### Medium

#### GDP-5. 온도 보정 Q₁₀ = 2.2 — 값의 출처가 페이지에 없고, 인용한 알고리즘과 다른 값

- 위치: `main.js:2623` (`GDP_Q10 = 2.2`), `main.js:2655-2659`, `main.js:2677-2678`, `gdp/index.html:527, 642-644, 666`
- 구현: `VO₂ fraction = 2.2^((T−37)/10)`, `Temp-adjusted DO₂ reference = target × fraction`, `Temp-adjusted flow = required flow × fraction`. 식의 형태는 Q₁₀ 정의와 일치한다(✅).
- 출처 대조:
  - Parolari 1999(페이지 인용): CPB 중 전신 Q₁₀ 2.5 ± 1.2.
  - McCullough 1999: 사람 뇌 Q₁₀ 2.3.
  - El Dsouki & Condello 2025(페이지 인용): "Q10 coefficient of 0.6"(10°C 하강당 배율), 정상체온 임계 DO₂i 300. 논문 Table 1의 28°C 189.4, 25°C 162.5는 `300 × 0.6^((37−T)/10)`으로 재현된다. 통상 정의로 환산하면 Q₁₀ ≈ 1.67이다.
- 영향:

  | 온도 | 사이트 (Q₁₀ 2.2) | El Dsouki 방식 (0.6/10°C) | 차이 |
  |---|---|---|---|
  | 32°C | 67.4% | 77.5% | −13% |
  | 28°C | 49.2% (목표 280 → 138) | 63.1% (→ 177) | −22% |
  | 25°C | 38.8% | 54.2% | −28% |

  Q₁₀를 크게 잡을수록 저체온에서 "DO₂i floor"가 낮게 표시된다. 2.2는 문헌 범위 안이지만 인용한 두 문헌 어느 쪽 값도 아니다.
- 판정: 🔶 관행 차이 / Medium (2.2의 출처 자체는 ❓)
- 제안: Q₁₀ 2.2의 근거 문헌을 페이지에 명시한다. "DO₂i floor"라는 열 이름은 검증된 하한처럼 읽힐 수 있으므로 "Q₁₀ 추정 참고값"임이 드러나는 이름을 검토한다. GIFT는 최저 체온 32°C 미만 예상 환자를 제외했다는 점을 한계로 적는 것도 방법이다.

#### GDP-7. 상태 구간(±10%)과 범례 라벨

- 위치: `main.js:2673-2675, 2840-2865`, `gdp/index.html:616-618`
- 구현: 현재 DO₂i가 목표의 90% 미만이면 "Below target", 90–110%이면 **"Borderline"**(초록색 막대, 문구 "Within ±10% of the selected target"), 110% 초과이면 **"Above target"**.
- 문제:
  1. 범례는 "Below / Borderline / Adequate"인데 코드가 내는 세 번째 상태는 "Above target"이다. "Adequate"라는 상태 문구는 코드에 없다.
  2. 목표 280에서 DO₂i 252–279는 목표 미달인데도 "Below target"이 아니라 초록색 "Borderline"으로 표시된다. 목표 260 "(min)" 프리셋에서는 234–259가 같은 처리를 받는다.
  3. ±10% 폭의 출처를 찾지 못했다. GIFT의 개입 목표는 DO₂ ≥ 280 유지였다.
- 판정: ⚠️ 표기 불일치 / Medium
- 제안: 범례와 상태 문구를 하나로 맞추고, 목표 미만 구간의 색·문구를 목표 이상 구간과 구분할지 결정한다. ±10% 기준의 근거를 적거나 "임의 허용폭"임을 명시한다.

#### HEP-3. 비만 자동 체중 전략(ABW 0.4 / 0.3)

- 위치: `main.js:2097-2131`, `heparin/index.html:508-510, 743, 761`
- 구현: auto 모드(기본값)에서 BMI <30 → TBW, 30–39 → `IBW + 0.4 × (TBW − IBW)`, ≥40 → `IBW + 0.3 × (TBW − IBW)`.
- 출처 대조:
  - 페이지가 인용한 Vienne 2018은 비만 환자에서 **IBW 기준 340 IU/kg**을 TBW 기준 300 IU/kg과 비교한 RCT다. ABW 0.4/0.3 계수를 쓴 연구가 아니다.
  - STS/SCA/AmSECT 2018은 비만 환자의 체중 기준을 다루지 않는다.
  - BMI ≥40에서 0.3을 쓰는 근거는 찾지 못했다.
- 영향(실행 결과): 170 cm / 130 kg 남성, 400 U/kg → TBW 52,000 U, auto(ABW 0.3) **34,084 U** (−34%). 165 cm / 110 kg 여성, 300 U/kg → TBW 33,000 U, auto 21,863 U (−34%). 참고로 Vienne 방식(IBW × 340)은 각각 약 22,400 U, 19,400 U다.
- 판정: 🔶 관행 차이 / Medium (0.3 계수의 출처는 ❓)
- 제안: 0.4/0.3 계수의 근거 문헌을 페이지에 추가한다. 근거가 기관 관행이라면 그렇게 적는다. 기본값을 auto로 둘지 TBW로 둘지는 임상 판단 사항이다.

#### Z-3. PHN LVESD 계수 — 2017 논문에 없는 구조물

- 위치: `data/phnCoefficients.js:291-300` (`alpha 0.5, mean 2.675, sd 0.352`), `main.js` 내장 사본 동일
- 확인 결과: Lopez 2017은 "end-systolic and functional measurements … were not included"라고 적고 있고 Table 2에 LVESD가 없다. 코드 주석은 "Lopez et al. JASE 2021 Table 3"을 출처로 든다. Lopez 2021의 측정 항목 목록(Table 2)에 LVESD가 있는 것까지는 확인했으나, 계수가 실린 표는 접근하지 못했다(PMC 봇 차단).
- 판정: ❓ 출처 확인 불가 / Medium
- 제안: Lopez 2021 Table 3(또는 PHN 공식 계산기)과 세 값을 대조한다. 화면 모델명이 "PHN / Lopez 2017"로만 표시되므로 LVESD는 2021 논문에서 왔다는 점을 구조물 설명에 적는 것을 검토한다.

#### Z-7. Detroit(Pettersen 2008) 21개 구조물 계수 — 원문 대조 불가

- 위치: `data/phnCoefficients.js:386-408`, `main.js:8610-8632`
- 확인 결과: 원 논문(JASE 2008;21:922-34)은 유료이고 페이지가 링크한 재수록 PDF도 접근하지 못했다. 21개 × 5개 값(b0–b3, MSE)은 **한 개도 원문과 대조하지 못했다.**
- 간접 확인(검증 아님): 21개 평균 곡선은 BSA 0.2–2.0에서 모두 단조 증가하고, 대동맥판륜 Z=0 값은 BSA 0.25/1.0/2.0에서 7.4/15.6/22.1 mm로 생리적으로 그럴듯하다.
- 판정: ❓ 출처 확인 불가 / Medium
- 제안: 원문 Table 2를 확보해 105개 값을 대조하고, 대조 결과를 `tests/phn.test.js`에 고정한다.

#### Z-8. Detroit 모델의 BSA 공식

- 위치: `main.js:9149-9175` (BSA 공식은 사용자 선택, 기본 Haycock), `z-score/index.html:471-475`
- 확인 결과: Pettersen 2008이 어떤 BSA 공식을 썼는지 원문으로 확인하지 못했다. 2차 자료는 서로 엇갈린다(Haycock이라는 서술과 DuBois라는 서술이 모두 있음). 페이지도 Detroit 쪽 BSA 공식은 밝히지 않는다.
- 판정: ❓ 출처 확인 불가 / Medium
- 제안: 원문 Methods에서 BSA 공식을 확인한 뒤, PHN처럼 "원 모델은 ○○ BSA 사용" 문구를 Detroit 설명에 추가한다.

#### CAN-2. 범위 밖 처리 — 문구는 "외삽 없음", 코드는 제한적 끝점 외삽 허용

- 위치: `main.js:1232-1235, 1250-1258, 1267-1283`, `cannula-pressure-drop/index.html:585, 679`, `main.js:6803`
- 구현: 목표 유량이 마지막 디지타이징 점보다 크더라도, 해당 항목에 `verifiedChartMaxFlowLMin`이 있고 간격이 0.05 L/min 이하이면 마지막 두 점의 기울기로 **선형 외삽**해 `endpoint_adjusted` 상태로 값을 낸다. 화면에는 "≈"와 "Limited estimate … (≤0.05 L/min; verified chart boundary)"가 붙는다.
- 해당 데이터: 224개 중 3개(Medtronic MC2 Two Stage Venous 32/40, 34/46, 36/51 Fr; 마지막 점 5.971 / 5.968 / 5.975 → 6.0 L/min).
- 실행 결과: MC2 32/40 Fr, 6.0 L/min → `endpoint_adjusted`, 11.79 mmHg(마지막 구간 직선 연장값과 일치).
- 문제: 페이지 Methodology는 "reports out of source range rather than extrapolating beyond the source data", FAQ는 "Estimates should not be extrapolated beyond the available manufacturer data range"라고 적는다. 같은 화면의 다른 상태 문구도 "Out of source range. No extrapolation."이다. 수치 영향은 작고 "≈" 표시도 있지만, 문서화된 원칙과 동작이 다르다.
- 판정: ⚠️ 표기 불일치 / Medium
- 제안: Methodology와 FAQ에 "검증된 차트 끝점까지 0.05 L/min 이내는 마지막 구간을 선형 연장한 근사값(≈)으로 표시한다"는 예외를 적거나, 예외 자체를 없앨지 결정한다.

#### QR-1. Quick Reference ACP·RCP 카드 — 카드별 출처 없음

- 위치: `quickReferenceData.js:40-200`
- 확인 결과: 스키마에 `references` 필드가 있지만 채워진 카드가 없다. `lastReviewed`는 전부 `2024-11-15`다. 페이지 본문은 "Annals of Thoracic Surgery, EJCTS, AmSECT"처럼 학술지 이름만 든다. 성인 ACP 8–12 mL/kg/min, 40–60 mmHg, 23–28°C, 소아 40–80 mL/kg/min, RCP SVC 압력 20–30 mmHg, 300–500 mL/min 등은 개별 출처를 특정할 수 없어 대조하지 못했다.
- 판정: ❓ 출처 확인 불가 / Medium
- 제안: 수치 카드마다 `references`(저자·연도·DOI)를 채우고 `lastReviewed`를 갱신한다.

---

## 2. 요약 표

| 계산기 | ID · 항목 | 판정 | 심각도 | 코드 위치 | 출처 |
|---|---|---|---|---|---|
| BSA | BSA-1 Mosteller | ❓ (2차 일치) | Low | `main.js:537-539` | Mosteller 1987 (원문 미접근) |
| BSA | BSA-2 Du Bois | ❓ (2차 일치) | Low | `main.js:540-542` | Du Bois 1916 (원문 미접근) |
| BSA | BSA-3 Haycock | ✅ | – | `main.js:543-545` | Haycock 1978 초록 |
| BSA | BSA-4 Boyd | ❓ (2차 일치) | Low | `main.js:546-551` | Boyd 1935 (원문 미접근) |
| BSA | BSA-5 Gehan–George | ❓ (2차 일치) | Low | `main.js:552-554` | Gehan & George 1970 (원문 미접근) |
| BSA | BSA-6 CI 유량표·mL/kg/min | ✅ | – | `main.js:651-684` | 정의식 |
| BSA | BSA-7 in·lb 환산 | ✅ | – | `main.js:568-585` | NIST SP 811 |
| BSA | BSA-8 비만 보정(BMI 25 기준 BSA) | 🔶 | Low | `main.js:726-739` | 단일 출처 없음 |
| BSA | BSA-9 페이지별 공식 선택지 차이 | ⚠️ | Low | `bsa/index.html:459-463`, `lbm/index.html:466-470` | – |
| LBM | LBM-1 Boer | ❓ (2차 일치) | Low | `main.js:2561-2563` | Boer 1984 (초록에 식 없음) |
| LBM | LBM-2 Hume | ❓ (2차 일치) | Low | `main.js:2564-2567` | Hume 1966 (스캔본) |
| LBM | LBM-3 Lean BSA | 🔶 | Low | `main.js:3301-3302` | 단일 출처 없음 |
| LBM | LBM-4 경계 동작·미사용 코드 | ⚠️ | Low | `main.js:2559-2568, 3238-3271` | – |
| GDP | GDP-1 CaO₂ 상수(1.34, 0.0031) | 🔶 | Low | `main.js:824-827` | de Somer 2011; Ranucci 2018 |
| GDP | GDP-2 용존 O₂ 계수 표기(0.003 대 0.0031) | ✅ | – | `main.js:826`, `gdp/index.html:639, 695-697, 760` | 코드·화면 대조 |
| GDP | GDP-3 DO₂i | ✅ | – | `main.js:829-833` | de Somer 2011 |
| GDP | GDP-4 목표 유량 역산 | ⚠️ | Low | `main.js:2673-2676, 2728-2732` | 대수식 |
| GDP | GDP-5 Q₁₀ = 2.2 | 🔶 | **Medium** | `main.js:2623, 2655-2659` | Parolari 1999; El Dsouki 2025; McCullough 1999 |
| GDP | GDP-6 DO₂i 목표 프리셋 260/280/300/360 | 🔶 | Low | `gdp/index.html:456-459`, `main.js:2627` | de Somer 2011; Ranucci 2018 |
| GDP | GDP-7 상태 구간 ±10%·범례 | ⚠️ | **Medium** | `main.js:2840-2865`, `gdp/index.html:616-618` | 출처 없음 |
| GDP | GDP-8 온도 프리셋 라벨 | 🔶 | Low | `gdp/index.html:551-555` | 분류 체계별 상이 |
| Heparin | HEP-1 초기 용량(250–400 U/kg) | 🔶 | Low | `main.js:2133`, `heparin/index.html:515-518` | STS/SCA/AmSECT 2018; Levy 2024 |
| Heparin | HEP-2 Devine IBW(0.91/cm) | ❓ | Low | `main.js:2062-2071` | Devine 1974 (원문 미접근) |
| Heparin | HEP-3 비만 auto 전략(ABW 0.4/0.3) | 🔶 | **Medium** | `main.js:2109-2121` | Vienne 2018 (IBW 기준) |
| Heparin | HEP-4 Protamine 비율(기본 0.8) | 🔶 | Low | `main.js:2365-2381`, `heparin/index.html:672-675` | STS 2018; EACTS/EACTAIC PBM 2024 |
| Heparin | HEP-5 헤파린 저항 기준(≥500 U/kg, ACT <480) | ✅ | – | `main.js:2357-2363`, `heparin/index.html:613, 713` | Levy 2024 (ISTH SSC) |
| Heparin | HEP-6 범위 문구·U/kg 분모·Capped cue | ⚠️ | Low | `main.js:2142, 2245-2246, 2358, 2420` | – |
| Heparin | HEP-7 비검증 임계값(>40,000 U, ≥400 mg, 체크리스트 점수) | ❓ | Low | `main.js:2136, 2181-2191, 2401` | 출처 없음 |
| Hct | HCT-1 Pre-CPB 희석식 | ✅ | – | `main.js:1887-1909` | 질량 보존 |
| Hct | HCT-2 EBV 계수(70/65/75/80/90) | 🔶 | Low | `main.js:1804-1814` | 교과서 관행 (1차 미확인) |
| Hct | HCT-3 RBC 단위 기본값(300 mL, Hct 60%) | 🔶 | Low | `predicted-hct/index.html:549, 553, 621, 625` | AABB Circular |
| Hct | HCT-4 On-pump·Target 시나리오 | ✅ | – | `main.js:1947-1976, 2019-2054` | 대수식 |
| Hct | HCT-5 Pre-CPB 식 설명과 입력란 차이 | ⚠️ | Low | `main.js:3058-3059`, `predicted-hct/index.html:744-750` | – |
| Z-score | Z-1 PHN 24개 구조물 계수 | ✅ | – | `data/phnCoefficients.js:36-288` | Lopez 2017 Table 2 |
| Z-score | Z-2 PHN 변환식·단위 | ✅ | – | `lib/phn.js:67-87` | Lopez 2017 |
| Z-score | Z-3 PHN LVESD | ❓ | **Medium** | `data/phnCoefficients.js:291-300` | Lopez 2021 (표 미접근) |
| Z-score | Z-4 PHN BSA 공식 | ✅ | – | `z-score/index.html:474, 602` | Lopez 2017 (Haycock) |
| Z-score | Z-5 PHN BSA 범위 0.15–2.5 | ❓ | Low | `data/phnCoefficients.js:331-335` | Lopez 2017에 범위 없음 |
| Z-score | Z-6 Detroit 식 형태·exp 역변환 | ✅ | – | `lib/phn.js:89-109` | Lopez 2021 Table 1 |
| Z-score | Z-7 Detroit 21개 구조물 계수 | ❓ | **Medium** | `data/phnCoefficients.js:386-408` | Pettersen 2008 (원문 미접근) |
| Z-score | Z-8 Detroit BSA 공식 | ❓ | **Medium** | `main.js:9149-9175` | Pettersen 2008 (원문 미접근) |
| Z-score | Z-9 Detroit BSA 상한 2.0 | ✅ | – | `lib/phn.js:8, 164-166` | Lopez 2021 Table 1 |
| Z-score | Z-10 `main.js` 내장 사본 동일성 | ✅ | – | `main.js:8227-8988` | 파일 간 비교 |
| Z-score | Z-11 `PHN_REGRESSION` 표 | ❓ | Low | `data/phnCoefficients.js:303-329` | 출처 미상 (화면 미사용) |
| Priming | PRI-1 튜브 부피식·단위 환산 | ✅ | – | `main.js:3347-3377` | 기하·NIST SP 811 |
| Priming | PRI-2 Oxygenator 프리셋 부피 | ❓ | Low | `priming-volume/index.html:501-508` | 제조사 IFU 미대조 |
| Unit | UNIT-1 압력 환산 | ✅ | – | `main.js:1043-1061` | NIST SP 811 |
| Unit | UNIT-2 유량 환산 | ✅ | – | `main.js:969-981` | 정의식 |
| Unit | UNIT-3 Fr ↔ mm | ✅ | – | `main.js:1126-1140` | French 단위 정의 |
| Unit | UNIT-4 Gauge 표 | ❓ | Low | `main.js:873-880` | ISO 9626 등 (유료) |
| Unit | UNIT-5 튜빙 inch 환산 | ✅ | – | `main.js:1787-1799` | NIST SP 811 |
| Cannula | CAN-1 선형보간만 사용 | ✅ | – | `main.js:1260-1297` | 코드·테스트 |
| Cannula | CAN-2 범위 밖 처리(외삽) | ⚠️ | **Medium** | `main.js:1267-1283` | 페이지 문구와 대조 |
| Cannula | CAN-3 끝점·정확점 허용오차 | ✅ | – | `main.js:1232-1248` | 코드 |
| Cannula | CAN-4 legacy 패널의 비선형 추정 경로 | ⚠️ | Low | `main.js:1302-1382, 1718-1746` | – |
| Cannula | CAN-5 동맥 캐뉼라 >100 mmHg 경고 | ❓ | Low | `main.js:6964-6975, 6993` | 출처 없음 |
| Time | TIME-1 Record 경과 시간·자정 넘김 | ✅ | – | `main.js:57-81, 4317-4325` | 페이지 명세 |
| Time | TIME-2 Live 분 단위 절삭(floor) | ✅ | – | `main.js:3867-3877, 3902-3906` | 코드 주석 |
| Time | TIME-3 Live 모드 설명 문구 | ⚠️ | Low | `timecalc/index.html:566-569` | – |
| Time | TIME-4 이식 총 허혈 시간 | ✅ | – | `main.js:5056-5091` | 코드 주석 |
| Time | TIME-5 허혈 시간 정의·심장 총 허혈 미표시 | 🔶 | Low | `main.js:5255, 5264-5265` | 기관별 정의 |
| Quick Ref | QR-1 ACP·RCP 카드 수치 | ❓ | **Medium** | `quickReferenceData.js:40-200` | 카드별 출처 없음 |
| Quick Ref | QR-2 HCA 온도별 안전 시간 | ❓ | **High** | `quickReferenceData.js:202-247` | McCullough 1999와 비교 |
| Quick Ref | QR-3 MUF 수치 | ❓ | Low | `quickReferenceData.js:248-312` | AmSECT 2019 등 (미접근) |
| Quick Ref | QR-4 냉각 20–50분·재가온 ≤0.5°C/min | ❓ | Low | `quick-reference/index.html:495` | 미접근 |
| Quick Ref | QR-5 ACP·MUF 미니 계산 | ✅ | – | `main.js:5873-5879, 5971-5974` | 정의식 |

데이터 이상치 목록(판정 대상 아님)은 3.9절에 있다.

---

## 3. 계산기별 상세

### 3.1 BSA (`/bsa/`)

**구현 식** (`main.js:536-555`, h = cm, w = kg)

```
Mosteller   : sqrt(h × w / 3600)
DuBois      : 0.007184 × h^0.725 × w^0.425
Haycock     : 0.024265 × h^0.3964 × w^0.5378
Boyd        : 0.0003207 × h^0.3 × (w×1000)^(0.7285 − 0.0188 × log10(w×1000))
GehanGeorge : 0.0235 × h^0.42246 × w^0.51456
```

`computeBSA`는 입력이 유한한 양수가 아니면 0을 반환하고, 알 수 없는 공식 이름은 Mosteller로 처리한다(`main.js:557-561`).

**출처 대조**

| 공식 | 출처 식 | 확인 경로 | 판정 |
|---|---|---|---|
| Haycock | SA (m²) = weight (kg)^0.5378 × height (cm)^0.3964 × 0.024265 | Haycock GB, Schwartz GJ, Wisotsky DH. J Pediatr 1978;93(1):62-66. doi:10.1016/S0022-3476(78)80601-5 초록 | ✅ |
| Mosteller | BSA = (HT[m] × WT[kg] / 36)^0.5, 코드 식과 동치 | 원문(N Engl J Med 1987;317:1098, doi:10.1056/NEJM198710223171717)은 초록 없는 유료 서신. DICOM/HL7 BSA 방법 값 집합의 인용 식과 일치 | ❓ (2차 일치) |
| Du Bois | 0.007184 × W^0.425 × H^0.725 | 원문(Arch Intern Med 1916;17:863-871) 미접근. 2차 자료와 일치 | ❓ (2차 일치) |
| Gehan–George | 0.0235 × height^0.42246 × weight^0.51456 | 원문(Cancer Chemother Rep 1970;54:225-235) 미접근. 피어리뷰 논문(PMC5313586) Table 1의 인용 식과 일치 | ❓ (2차 일치) |
| Boyd | 0.0003207 × H^0.3 × W(g)^(0.7285 − 0.0188 log W(g)) | 원문(1935 단행본) 미접근. 2차 자료와 일치 | ❓ (2차 일치) |

Boyd 비고: DICOM/HL7 값 집합 문구에는 계수가 `0.003207`로 적혀 있다(코드는 `0.0003207`). 코드 값으로 계산하면 170 cm / 70 kg에서 1.835 m²로 다른 공식과 1% 안쪽이고, `0.003207`이면 18.35 m²가 되므로 값 집합 쪽 표기 문제로 보인다. 다만 원문을 보지 못했으므로 ❓를 유지한다. 또한 문헌에는 Boyd 이름의 다른 식(`0.01787 × h^0.5 × w^0.4838`)도 인용된다. 사이트는 체중 의존 지수 식을 쓴다.

**Worked example** (기대값 = 독립 구현, 실제값 = `computeBSA`)

| 입력 | 공식 | 기대값 (m²) | 실제값 (m²) | 차이 |
|---|---|---|---|---|
| 170 cm, 70 kg | Mosteller | 1.8181 | 1.8181 | 0 |
| 170 cm, 70 kg | DuBois / Haycock / Gehan–George / Boyd | 1.8097 / 1.8257 / 1.8313 / 1.8347 | 동일 | 0 |
| 110 cm, 18 kg | Mosteller / DuBois / Haycock / Gehan–George / Boyd | 0.7416 / 0.7411 / 0.7401 / 0.7575 / 0.7552 | 동일 | <1e-15 |
| 52 cm, 3.5 kg | Mosteller / Haycock | 0.2248 / 0.2279 | 동일 | 0 |
| 165 cm, 120 kg | Mosteller / DuBois / Haycock | 2.3452 / 2.2269 / 2.4109 | 동일 | <1e-15 |

페이지의 worked example(170 cm, 70 kg → 1.8181 → CI 2.4에서 4.36 L/min, 62 mL/kg/min)은 코드 결과와 일치한다.

**비고**

- BSA-6: 유량표는 `flow = CI × BSA`(반올림 전 BSA 사용), `mL/kg/min = round(flow × 1000 / weight)`. 정의식과 일치.
- BSA-7: `2.54 cm/in`, `0.45359237 kg/lb`는 정확값.
- BSA-8 (🔶): BMI ≥30이면 `25 × height(m)²`를 기준 체중으로 다시 BSA를 계산해 비교 유량표를 보여 준다(`main.js:726-739`). 페이지가 "comparison reference only; not an automatic flow target"라고 밝히고 있고, 단일 출처가 있는 방법은 아니다. 165 cm / 120 kg 예: 기준 체중 68.06 kg.
- BSA-9 (⚠️): `GehanGeorge`는 코드와 라벨 맵에 있지만 BSA·GDP·Z-score 페이지에서는 선택할 수 없고 LBM 페이지에서만 선택된다. 반대로 Boyd는 LBM 페이지에 없다. `main.js:9162` 주석("Mosteller, DuBois, Haycock, Boyd")과 BSA 페이지 본문("Du Bois, Haycock, and Boyd")은 각 페이지의 선택지와는 맞는다. 페이지 간 일관성 문제일 뿐 계산 오류는 아니다.

### 3.2 LBM (`/lbm/`)

**구현 식** (`main.js:2559-2568`)

```
Boer  남: 0.407 × w + 0.267 × h − 19.2        여: 0.252 × w + 0.473 × h − 48.3
Hume  남: 0.32810 × w + 0.33929 × h − 29.5336  여: 0.29569 × w + 0.41813 × h − 43.2933
Lean BSA = computeBSA(h, LBM, 선택한 BSA 공식)
```

**출처 대조**

- Boer P. Am J Physiol 1984;247(4 Pt 2):F632-6. doi:10.1152/ajprenal.1984.247.4.F632 — PubMed 초록에 식이 없고 전문은 유료. ❓ (여러 2차 자료의 인용 식과는 일치).
- Hume R. J Clin Pathol 1966;19(4):389-391. doi:10.1136/jcp.19.4.389 — PMC(PMC473290)는 스캔 PDF라 식을 텍스트로 확인하지 못함. 초록은 남녀 식의 다중상관계수(0.96, 0.83)만 제시. ❓ (2차 자료 인용 식과는 일치).
- 화면 표기 식(`lbm/index.html:605-615`)은 코드와 일치한다.

**Worked example**

| 입력 | 공식 | 기대값 (kg) | 실제값 (kg) | 차이 |
|---|---|---|---|---|
| 남, 175 cm, 80 kg | Boer / Hume | 60.085 / 56.0902 | 동일 | 0 |
| 여, 160 cm, 55 kg | Boer / Hume | 41.24 / 39.8705 | 동일 | 0 |
| 남, 170 cm, 140 kg | Boer / Hume | 83.17 / 74.0797 | 동일 | 0 |
| 남, 175 cm, 80 kg | Lean BSA (Mosteller, Boer) | 1.709 m² | 1.709 m² | 0 |

**비고**

- LBM-3 (🔶): LBM을 체중 자리에 넣어 BSA를 다시 계산하는 "Lean BSA"는 사이트가 정의한 비교 지표다. 단일 출처가 있는 표준 지표가 아니다. 페이지도 "comparison reference"로 한정한다.
- LBM-4 (⚠️, Low):
  - `formula` 값이 `'Boer'`가 아니면 무엇이든 Hume으로 계산된다(`'James'` 입력 시 Hume 값 반환 확인). 현재 UI 선택지는 두 개뿐이라 영향은 없다.
  - 매우 작은 체격에서는 식이 음수를 낼 수 있고, 음수는 그대로 표시된다(0만 "—" 처리). 페이지는 성인 전용임을 밝히고 있다.
  - `renderLBMFlowTable`(`main.js:3238-3271`)은 "Flows scaled by Mosteller BSA" 문구를 갖고 있으나 대상 DOM(`lbm-ci-tbody`)이 어느 페이지에도 없어 실행되지 않는다. 실제 유량표는 `updateLBM`이 선택한 BSA 공식으로 그린다.

### 3.3 GDP / DO₂i (`/gdp/`)

**구현 식**

```
CaO2  = 1.34 × Hb × clamp(SaO2/100, 0, 1) + 0.0031 × PaO2          (main.js:824-827)
DO2i  = (flow / BSA) × CaO2 × 10                                    (main.js:829-833)
flow  = target × BSA / (CaO2 × 10)                                  (main.js:2728-2732)
VO2 fraction = 2.2^((T − 37)/10),  T는 20–37°C로 clamp              (main.js:2623-2659)
Temp-adjusted DO2 reference = target × VO2 fraction                 (main.js:2677)
Temp-adjusted flow          = required flow × VO2 fraction          (main.js:2678)
구간: lower = round(0.9 × target), upper = round(1.1 × target)      (main.js:2673-2674)
```

**GDP-2. 알려진 확인 항목: 용존 O₂ 계수 0.003 대 0.0031**

| 위치 | 현재 `main` 표기 |
|---|---|
| 코드 `main.js:826` | **0.0031** |
| GDP 페이지 "Formula used" `gdp/index.html:639` | 0.0031 |
| GDP worked example `gdp/index.html:695-697` | 0.0031 (`0.0031 × 200 = 0.62`) |
| GDP FAQ 본문 `gdp/index.html:760` 및 JSON-LD `:366` | 0.0031 |
| 홈페이지 `index.html` | CaO₂ 식 없음 |

- 실제 코드 값은 **0.0031**이고, 현재 `main`에서는 화면 표기가 모두 코드와 일치한다. → ✅
- 이력: GDP 페이지의 0.003 표기는 커밋 `4c33484`(2026-07-26, "Align GDP worked example with runtime CaO2 formula")에서 0.0031로 맞춰졌다. 홈페이지의 0.0031 표기는 커밋 `7322372`(2026-04-30, "Remove combined calculator section bodies from home HTML")에서 섹션과 함께 삭제됐다. `tests/gdp-seo.test.js`가 0.0031 표기를 고정하고 있다.
- 운영 사이트에 아직 0.003이 보인다면 배포본이 이 커밋들보다 앞선 것이다(배포본은 확인하지 못했다).

**GDP-1. CaO₂ 상수 (🔶)**

| 출처 | Hb 결합 상수 | 용존 O₂ 계수 |
|---|---|---|
| 사이트 | 1.34 | 0.0031 |
| de Somer 2011 (Crit Care 15:R192, doi:10.1186/cc10349) Methods | 1.34 | 0.003 |
| Ranucci 2018 GIFT (J Thorac Cardiovasc Surg 156:1918, doi:10.1016/j.jtcvs.2018.04.045) eTable 1 각주, CONNECT 소프트웨어 | 1.36 (Hb = Hct/2.94) | 0.003 |
| 같은 표, M4 장비 식 | 1.34 | 용존 항 없음 |

영향(Hb 8.0, SaO₂ 100%, PaO₂ 200): 사이트 11.34 mL/dL. 1.34/0.003이면 11.32(+0.02, 0.18%), 1.36/0.003이면 11.48(사이트가 −0.14, −1.2%). 280 기준을 만든 임상시험 안에서도 장비마다 상수가 달랐으므로 관행 차이로 분류한다. 280 목표와 엄밀히 비교하려는 사용자에게는 1% 수준의 차이가 날 수 있다.

**GDP-3. DO₂i (✅)**: de Somer 2011의 `DO2 = 10 × pump flow (L/min/m²) × arterial O2 content (mL/100 mL)`와 일치.

**GDP-4. 목표 유량 역산 (⚠️, Low)**: 화면 식은 `(Target DO₂i × BSA) ÷ (CaO₂ × 10)`인데, 코드는 목표 대신 `(round(0.9×target) + round(1.1×target)) / 2`를 쓴다. 프리셋 네 개에서는 목표와 같다. 사용자 지정 목표에서는 반올림 때문에 최대 0.5 mL/min/m² 어긋난다(목표 275 → 275.5 적용, 유량 4.3651 → 4.3730 L/min, +0.18%).

**GDP-6. 목표 프리셋 (🔶)**

- 260 "(min)": de Somer 2011의 임계 nadir DO₂ 262 mL/min/m². 같은 논문이 2005년 선행 연구의 272를 인용.
- 280 "(standard)": GIFT의 개입 목표 ≥280.
- 300 "(high-normal)": El Dsouki 2025가 정상체온 임계값으로 300을 사용.
- 360 "(pediatric)": 근거 문헌을 특정하지 못함(❓).

**GDP-8. 온도 프리셋 라벨 (🔶, Low)**: "28°C deep HT", "32°C moderate HT" 등은 분류 체계에 따라 달라진다. 대동맥궁 수술 HCA 합의문(Annals of Cardiothoracic Surgery 게재)은 profound/deep/moderate/mild 4단계를 쓰는데, 그 경계값과 라벨을 대조하지는 못했다.

**Worked example**

| 입력 | 항목 | 기대값 | 실제값 | 차이 |
|---|---|---|---|---|
| Hb 8.0, SaO₂ 100, PaO₂ 200 (페이지 예제) | CaO₂ | 11.34 | 11.34 | 0 |
| 위 + flow 4.5, BSA 1.8 | DO₂i | 283.5 | 283.5 | 0 |
| Hb 10, SaO₂ 98, PaO₂ 250 | CaO₂ | 13.907 | 13.907 | 0 |
| 위 + flow 4.6, BSA 1.82 | DO₂i | 351.4956 | 351.4956 | 0 |
| target 280, BSA 1.8, CaO₂ 11.34 | Required flow | 4.4444 | 4.4444 | 0 |
| T = 35 / 32 / 28 / 25 / 20°C | VO₂ fraction | 0.8541 / 0.6742 / 0.4918 / 0.3882 / 0.2617 | 동일 | 0 |
| target 280, 28°C | Temp-adjusted DO₂ / flow | 137.71 / 2.1859 | 동일 | 0 |
| target 280 | 구간 하한/상한 | 252 / 308 | 252 / 308 | 일치 |

### 3.4 Heparin / Protamine (`/heparin/`)

**구현 식** (`main.js:2062-2162, 2354-2401`)

```
BMI = w / (h/100)²
IBW(Devine) 남: 50 + 0.91 × (h − 152.4)   여: 45.5 + 0.91 × (h − 152.4)
ABW 0.4 = IBW + 0.4 × (TBW − IBW);  ABW 0.3 = IBW + 0.3 × (TBW − IBW)
auto: BMI <30 → TBW,  30–39 → ABW 0.4,  ≥40 → ABW 0.3
초기 bolus = round(dosing weight × U/kg)          (U/kg 프리셋 250/300/350/400, 기본 300)
누적 전신 UFH = 초기 + 추가 (prime 제외);  U/kg = 누적 / dosing weight;  ≥500이면 cue
Protamine mg = UFH 기준량 / 100 × 비율;  실용 용량 = 25 mg 단위 반올림
UFH 기준량: total(초기+추가+prime) / initial / custom;  비율 0.6 / 0.8(기본) / 0.9 / 1.0 / custom
```

**출처 대조**

- HEP-1 (🔶): STS/SCA/AmSECT 2018(J Extra Corpor Technol 2018;50(1):5-18, PMC5850589)은 체중 기반 bolus를 "reasonable"(Class IIa, Level C)로 권고할 뿐 특정 용량을 정하지 않는다. 본문 예시는 300 IU/kg이고 400 IU/kg 초과 시 rebound를 언급한다. Levy 2024는 통상 bolus를 300–600 U/kg로 요약한다. 250–400 프리셋은 이 범위 안의 기관 선택이다.
- HEP-2 (❓, Low): Devine 1974 원문 미접근. 흔히 인용되는 형태(60인치 초과 1인치당 2.3 kg)를 cm로 바꾸면 2.3/2.54 = 0.9055 kg/cm인데 코드는 0.91을 쓴다. 차이는 175 cm 남성 +0.10 kg, 180 cm 남성 +0.12 kg(약 0.17%)로 용량에 미치는 영향은 무시할 수준이다. 화면 표기(0.91)는 코드와 일치한다.
- HEP-3: 1절 참조.
- HEP-4 (🔶): STS/SCA/AmSECT 2018은 protamine/heparin 비를 2.6 mg/100 U 미만으로 제한하는 것이 reasonable(Class IIa, Level C)하고, 잔여 헤파린 적정 기반 용량 산정이 유익할 수 있다(Class IIa, Level B)고 한다. 2024 EACTS/EACTAIC PBM 가이드라인(Eur J Cardiothorac Surg 2025;67:ezae352, doi:10.1093/ejcts/ezae352)은 1.0 미만 비율을 권고한다고 2차 문헌이 전한다(원문 미접근). 0.6–1.0 선택지와 기본값 0.8은 이 범위 안의 관행이다. 기준량을 total로 볼지 initial로 볼지도 기관별로 다르며 페이지가 이를 설명한다.
- HEP-5 (✅): "500 U/kg 투여 후에도 ACT ≥480초에 도달하지 못함"은 Levy JH 등, J Thromb Haemost 2024;22(4):1249-1257, doi:10.1016/j.jtha.2024.01.001의 제안 정의와 일치한다.

**Worked example**

| 입력 | 항목 | 기대값 | 실제값 | 차이 |
|---|---|---|---|---|
| 남 175 cm / 80 kg, 300 U/kg | BMI / IBW / dosing wt / bolus | 26.12 / 70.566 / 80 (TBW) / 24,000 U | 동일 | 0 |
| 여 165 cm / 110 kg, 300 U/kg | BMI / IBW / dosing wt / bolus | 40.40 / 56.966 / 72.876 (ABW 0.3) / 21,863 U | 동일 | 0 |
| 남 170 cm / 130 kg, 400 U/kg | BMI / dosing wt / bolus | 44.98 / 85.211 (ABW 0.3) / 34,084 U | 동일 | 0 |
| 남 180 cm / 70 kg, 350 U/kg | bolus | 24,500 U | 24,500 U | 0 |
| UFH 24,000 + 5,000 + prime 3,000, total, 0.8 | Protamine / 실용 용량 | 256.0 mg / 250 mg | 동일 | 일치 |
| 위 조건, initial, 1.0 | Protamine | 240.0 mg | 240.0 mg | 일치 |
| UFH 24,000, total, 0.6 | Protamine / 실용 용량 | 144.0 mg / 150 mg | 동일 | 일치 |
| 24,000 + 5,000 U, dosing wt 80 kg | 누적 전신 UFH | 362.5 U/kg | 362.5 U/kg | 일치 |

**비고**

- HEP-6 (⚠️, Low):
  - 오류 문구는 "Height should be 50–250 cm", "Weight should be 20–300 kg"인데 코드는 `> 50 && < 250`, `> 20 && < 300`으로 경계값을 받지 않는다(250 cm 입력 시 결과가 나오지 않음을 확인).
  - 소아 경고 조건 `weight < 20 || height < 120`에서 `weight < 20`은 위 유효 범위 때문에 도달할 수 없다.
  - "Cumulative systemic UFH (U/kg)"의 분모는 TBW가 아니라 **dosing weight**다. 비만 환자에서 auto 모드면 ABW로 나누므로 같은 용량에서 U/kg가 더 크게 나오고 500 U/kg cue가 더 일찍 켜진다. 화면에 분모가 무엇인지 적혀 있지 않다.
  - "Capped cue" 배지(BMI >35이고 BSA >2.5)는 표시만 하며 실제로 값을 제한하지 않는다. Methodology의 "BSA-capped dose sensitivity" 문구에 대응하는 계산은 없다.
  - 25 mg 반올림은 표기상 편의지만 144 → 150 mg(+4%)처럼 올림이 될 수 있다.
- HEP-7 (❓, Low): ">40,000 U" 고용량 표시, "≥400 mg" protamine 경고, 저항 체크리스트 점수(+1~+5, 3점 moderate, 6점 high)는 근거 문헌이 없다. 페이지가 "Non-validated"임을 밝히고 있다.
- 범위 밖 관찰: `timecalc/index.html:583-803`에 숨김 처리된 예전 Heparin 화면(`view-heparin`)이 남아 있다. "validated for adult CPB only", "Flow capped" 같은 현재 화면과 다른 문구가 들어 있다. 숨김 영역이라 계산에는 영향이 없다. 정리 여부는 별도 과제로 남긴다.

### 3.5 Predicted Hct / Target Hct (`/predicted-hct/`)

**구현 식** (`main.js:1887-1909, 1947-1976, 2019-2054`)

```
Pre-CPB:  EBV = coef × weight;  RBC_pt = EBV × Hct/100
          RBC 제품량 = units × mL/unit;  RBC_add = 제품량 × unitHct/100
          V_total = EBV + prime + crystalloid + 제품량 − UF
          Hct = (RBC_pt + RBC_add) / V_total × 100
On-pump:  V = EBV + prime + netIO;  R = V × currentHct/100
          V_final = V + crystalloid + 제품량 − UF;  Hct = (R + RBC_add) / V_final × 100
Target:   RBC only        = (T·V − R) / (P − T)      (T < P일 때)
          RBC + 동량 UF   = (T·V − R) / P
          UF only         = V − R / T
          희석            = R / T − V                 (목표 < 현재)
```

- HCT-1, HCT-4 (✅): 적혈구량 보존과 완전 혼합을 가정한 질량 수지식이다. 외부 계수가 없어 대수적으로 검증했다. Target 식은 결과를 다시 대입해 목표 Hct가 재현되는지 확인했다.
- HCT-2 (🔶): 코드 기본값은 **성인 남 70, 성인 여 65, 소아 75, 영아 80, 신생아 90 mL/kg**이고 알 수 없는 유형은 70으로 처리한다(`main.js:1804-1814`). 화면의 첫 선택지는 성인 남성 70 mL/kg다. 즉 "성인 기본값 65 mL/kg"는 성인 여성 선택 시의 값이며, 화면을 처음 열었을 때의 기본값은 70이다. 이 계수들은 마취·수혈 교과서의 관행값 범위(성인 남 70–75, 성인 여 65, 영아 75–80, 만삭 신생아 85–90, 미숙아 90–100) 안에 있으나, 1차 출처를 특정해 대조하지는 못했다. 계수는 화면에서 직접 고칠 수 있다.
- HCT-3 (🔶): 기본값 300 mL, Hct 60%. AABB 등이 발행한 *Circular of Information for the Use of Human Blood and Blood Components*는 첨가액(AS) RBC의 전형적 Hct를 55–65%, 부피를 약 300–400 mL로 적는다(Circular 문구를 인용한 2차 자료로 확인). 기본값은 이 범위 안이다. 국내 적혈구 제제 규격과는 대조하지 않았다. 값은 화면에서 고칠 수 있다.
- HCT-5 (⚠️, Low): 페이지의 Pre-CPB 식 설명은 "+ Additional crystalloid/colloid added − Ultrafiltration removed"를 포함하지만 Pre-CPB 모드에는 해당 입력란이 없고 코드가 두 값을 0으로 고정한다(`main.js:3058-3059`). 계산 함수 자체는 두 항을 지원한다.

**Worked example**

| 입력 | 항목 | 기대값 | 실제값 | 차이 |
|---|---|---|---|---|
| 성인 남 70 kg, Hct 40, prime 1200 (페이지 예제) | Pre-CPB Hct | 32.1311% | 32.1311% | 0 |
| 성인 여 55 kg, Hct 36, prime 1000, RBC 1단위(300 mL, 60%) | Pre-CPB Hct | 30.0923% | 30.0923% | 0 |
| 신생아 3.5 kg, Hct 45, prime 250, RBC 150 mL(60%) | Pre-CPB Hct | 32.4126% | 32.4126% | 0 |
| V 6600, Hct 24, RBC 1단위, UF 500 | On-pump Hct | 27.5625% | 27.5625% | 0 |
| V 4900, Hct 22, crystalloid 500 | On-pump Hct | 19.9630% | 19.9630% | 0 |
| V 6600, R 1584, 목표 27, 제품 Hct 60 | RBC only / RBC+UF / UF only | 600 / 330 / 733.33 mL | 동일 | 0 |
| 위 조건, 목표 21 | 희석량 | 942.86 mL | 942.86 mL | 0 |

### 3.6 Pediatric Echo Z-score (`/z-score/`)

**구현 식** (`lib/phn.js`, `main.js:8654-8988`에 같은 코드 내장)

```
PHN:     z = (measured_native / BSA^α − mean) / sd
         target_native = (mean + z × sd) × BSA^α        (cm 구조물은 ×10 하여 mm 표시, 관상동맥은 mm 그대로)
Detroit: meanLn = b0 + b1·BSA + b2·BSA² + b3·BSA³
         z = (ln(measured_mm / 10) − meanLn) / sqrt(MSE)
         target_mm = exp(meanLn + z × sqrt(MSE)) × 10
         BSA > 2.0 이면 계산하지 않고 "Out of range"
```

**Z-1, Z-2. PHN (Lopez 2017) — ✅**

Lopez L 등. Circ Cardiovasc Imaging 2017;10(11):e006979. doi:10.1161/CIRCIMAGING.117.006979 (PMC5812349) Table 2의 최종 Z-score 모델과 코드 계수를 기계 비교했다. 24개 구조물의 α, mean, SD, 단위가 **모두 일치**한다.

| 구조물 (코드 키) | α | mean | SD | 단위 |
|---|---|---|---|---|
| MV_AP / MV_LAT | 0.50 | 2.31 / 2.23 | 0.24 / 0.22 | cm |
| TV_AP / TV_LAT | 0.50 | 2.36 / 2.36 | 0.28 / 0.29 | cm |
| ANN / ROOT / STJ / AAO | 0.50 | 1.48 / 2.06 / 1.69 / 1.79 | 0.14 / 0.18 / 0.16 / 0.18 | cm |
| ARCH_PROX / ARCH_DIST / ISTH | 0.50 | 1.53 / 1.36 / 1.25 | 0.23 / 0.19 / 0.18 | cm |
| LMCA / LAD / RCA | 0.45 | 2.95 / 1.90 / 2.32 | 0.57 / 0.34 / 0.55 | **mm** |
| PV_SAX / PV_LAX | 0.50 | 1.91 / 2.01 | 0.24 / 0.28 | cm |
| MPA / RPA / LPA | 0.50 | 1.82 / 1.07 / 1.10 | 0.24 / 0.18 / 0.18 | cm |
| LVEDD | 0.45 | 3.89 | 0.33 | cm |
| LVPWT / LVST | 0.40 | 0.57 / 0.58 | 0.09 / 0.09 | cm |
| LVEDL / LVEDL_EPI | 0.45 | 6.31 / 6.87 | 0.46 / 0.45 | cm |

논문 모델은 지수화 변수 `X / BSA^α`의 평균과 SD로 Z를 구하는 형태이며 코드의 정·역변환과 일치한다. 논문 Table 2에는 면적·용적·질량 항목도 있으나 사이트는 선형 치수 24개(+LVESD)만 구현했다.

**Z-4. PHN의 BSA 공식 — ✅ (작업 지시서의 전제와 다름)**

- 논문 원문: "The Haycock formula was used for all analyses." **PHN 모델의 BSA 공식은 Mosteller가 아니라 Haycock이다.**
- 사이트: 키·몸무게로 BSA를 구할 때 공식은 사용자 선택이고 기본값이 Haycock이다(`z-score/index.html:474`). 페이지 본문도 "The original PHN reference model used Haycock BSA"라고 적는다(`:602`). 기본 동작은 출처와 일치한다.
- 참고: 다른 공식을 고르면 BSA가 달라져 Z도 달라진다. 110 cm / 18 kg에서 Haycock 0.7401, Mosteller 0.7416, Boyd 0.7552 m²다. 52 cm / 3.5 kg에서는 Haycock 0.2279, DuBois 0.2146 m²(−5.8%)로 신생아에서 차이가 커진다.

**Z-5 (❓, Low)**: `PHN_BSA_LIMITS`(0.15–2.5, 2.0 초과 시 외삽 경고)는 Lopez 2017 본문에서 근거 범위를 찾지 못했다. 논문은 전체 BSA 범위를 제시하지 않는다.

**Z-6, Z-9. Detroit 식 형태와 BSA 상한 — ✅**

Lopez L 등. J Am Soc Echocardiogr 2021;34(2):185-192. doi:10.1016/j.echo.2020.09.019 (PMC7870534) Table 1은 Detroit(Pettersen 2008) 모델을 `ln(y) = b + m1×BSA + m2×BSA² + m3×BSA³`, 표본 782명, 연구 대상 "BSA <2 m²"로 요약한다. 같은 방법을 따른 소아 운동선수 대상 연구(PMC6181376)는 Z를 `(ln(측정값) − 기대값) / √MSE`로 적는다. 코드의 식 형태, √MSE 분모, 2.0 상한이 이와 일치한다.

- **log 역변환**: 기대 크기는 `exp(meanLn + z·√MSE)`로 계산한 뒤 cm → mm로 바꾼다. `Math.exp()` 적용 위치와 단위 변환 순서가 맞다. 왕복 검증(Z=−1.5 기대 크기를 다시 넣어 Z 계산)에서 −1.5가 재현됐다(오차 <1e-15).
- 상한: 코드는 `BSA > 2.0`만 막으므로 2.00은 계산하고 2.01부터 `RangeError`를 낸다. 화면 문구("≤ 2.0")와 일치한다.

**Z-7, Z-8, Z-3**: 1절 참조.

**Z-10 (✅)**: `main.js`에 내장된 계수·함수 사본은 `data/phnCoefficients.js`, `lib/phn.js`와 내용이 같다(계수 객체 JSON 비교 일치, 함수는 이름 `validatePositiveNumber` → `validateZScorePositiveNumber`와 주석 한 줄만 다름). 다만 같은 계수가 두 곳에 있으므로 한쪽만 고치면 어긋날 수 있다.

**Z-11 (❓, Low)**: `PHN_REGRESSION`(절편·기울기 표)은 Lopez 2017 Table 2에 없는 형태다. 이 표를 쓰는 디버그 패널(`phn-debug-panel`)이 현재 페이지에 없어 화면에는 나타나지 않는다.

**Worked example**

| 모델 · 구조물 | 입력 | 기대값 | 실제값 | 차이 |
|---|---|---|---|---|
| PHN · Aortic annulus | BSA 0.70, Z=0 | 12.3826 mm | 12.3826 mm | 0 |
| PHN · Aortic annulus | BSA 0.70, 측정 14.0 mm | Z = 1.3809 | 1.3809 | 0 |
| PHN · LMCA (mm 단위 구조물) | BSA 0.70, 측정 3.0 mm | Z = 1.0040 | 1.0040 | 0 |
| PHN · LVEDD | BSA 1.20, Z=+2 | 49.3904 mm | 49.3904 mm | 0 |
| Detroit · AoV annulus | BSA 0.70, Z=0 | 13.1593 mm | 13.1593 mm | 0 |
| Detroit · AoV annulus | BSA 0.70, 측정 14.0 mm | Z = 0.6193 | 0.6193 | <1e-15 |
| Detroit · LVIDd | BSA 1.20, Z=+2 | 51.4639 mm | 51.4639 mm | 0 |
| Detroit · LVIDd | BSA 2.00 / 2.01 | 계산 / RangeError | 계산 / RangeError | 일치 |

Detroit 예제의 기대값은 **코드에 들어 있는 계수**로 식을 다시 계산한 것이다. 식 구현은 확인하지만 계수 자체가 원문과 같다는 증거는 아니다(Z-7).

### 3.7 Priming / Tubing Volume (`/priming-volume/`)

**구현 식** (`main.js:3347-3377`)

```
V(mL) = (π/4) × ID(mm)² × Length(m) × Quantity
길이 환산: cm ÷ 100, ft × 0.3048, in × 0.0254
프리셋 ID: 1/2" 12.7, 3/8" 9.525, 1/4" 6.35, 3/16" 4.7625, 3/32" 2.38125, 1/16" 1.5875 mm
```

- PRI-1 (✅): 원통 부피식이다. mm² × m = 1000 mm³ = 1 mL이므로 단위 환산 계수가 따로 필요 없다는 코드 주석이 맞다. 반지름(cm)과 길이(cm)로 따로 계산한 값과 일치한다. inch = 25.4 mm, ft = 0.3048 m는 정확값이고 프리셋 6개 모두 `inch × 25.4`와 같다.
- PRI-2 (❓, Low): Oxygenator 프리셋(Affinity Fusion 260, CAPIOX FX25 260 / FX15 144 / FX05 43, Inspire 6 184 / 8 219 / 6F 284 / 8F 351 mL)은 제조사 IFU와 대조하지 못했다. 페이지는 "verify against the current IFU"라고 안내한다.

**Worked example**

| 입력 | 기대값 (mL) | 실제값 (mL) | 차이 |
|---|---|---|---|
| ID 12.7 mm (1/2"), 1.5 m, ×1 | 190.0153 | 190.0153 | 0 |
| ID 9.525 mm (3/8"), 2.0 m, ×2 | 285.0230 | 285.0230 | 0 |
| ID 6.35 mm (1/4"), 0.5 m, ×1 | 15.8346 | 15.8346 | 0 |
| ID 4.7625 mm (3/16"), 1.2 m, ×3 | 64.1302 | 64.1302 | 0 |
| 6 ft / 60 in / 150 cm → m | 1.8288 / 1.524 / 1.5 | 동일 | 0 |
| 3/8", 1/2" 의 mL/m | 71.26 / 126.68 | 동일 | 일치 |

### 3.8 Unit Converter (`/unit-converter/`)

**구현** (`main.js:1043-1061`): kPa를 기준 단위로 삼아 `mmHg × 0.133322`, `cmH₂O × 0.735559 × 0.133322`, `psi × 6.89476`, `bar × 100`으로 바꾼 뒤 `kPa × 7.50062 = mmHg`, `mmHg × 1.35951 = cmH₂O`, `kPa ÷ 6.89476 = psi`, `kPa ÷ 100 = bar`.

- UNIT-1 (✅): NIST SP 811 Appendix B.8의 관용 단위 환산값(mmHg = 133.3224 Pa, cmH₂O = 98.0665 Pa, psi = 6.894757 kPa, bar = 100 kPa)을 6자리로 반올림한 계수와 일치한다(NIST 표 자체가 아니라 같은 값을 실은 계측 표준 환산표로 대조). 6자리 반올림으로 생기는 연쇄 오차는 최대 2.5 × 10⁻⁶(상대)이다.
- UNIT-2 (✅): `mL/min = L/min × 1000`, `mL/kg/min = mL/min ÷ kg`.
- UNIT-3 (✅): `mm = Fr ÷ 3`. French(Charrière) 단위의 정의다. 표준 문서 원문을 따로 대조하지는 않았다.
- UNIT-4 (❓, Low): Gauge 표(14G 2.10, 16G 1.65, 18G 1.27, 20G 0.90, 22G 0.70, 24G 0.55 mm)는 출처가 코드에 없고, 대조할 표준(ISO 9626 등)은 유료라 확인하지 못했다. 한 가지 확인이 필요한 점: 화면 제목은 "Cannula / Catheter Size"인데, gauge → 외경 대응은 주사침 규격과 말초 정맥 카테터 규격이 서로 다르다. 이 표가 어느 쪽을 따른 것인지 밝혀 둘 필요가 있다. 페이지는 "approximate reference"라고 표시한다.
- UNIT-5 (✅): `mm = inch × 25.4`, `Fr-equivalent = mm × 3`.

**Worked example** (기대값은 Pa 기준 정확 계수로 계산)

| 입력 | 기대값 | 실제값 | 차이 |
|---|---|---|---|
| 80 mmHg | 10.67 kPa, 108.8 cmH₂O, 1.55 psi, 0.11 bar | 동일 | 일치 |
| 300 mmHg | 40.00 kPa, 407.9 cmH₂O, 5.80 psi, 0.40 bar | 동일 | 일치 |
| 20 cmH₂O | 14.7 mmHg, 1.96 kPa | 동일 | 일치 |
| 4 bar | 3000.2 mmHg, 58.02 psi | 동일 | 일치 |
| 50 psi | 3515.3 cmH₂O (정확값 3515.35) | 3515.4 cmH₂O | +0.1 (반올림 경계, 0.003%) |
| 4.5 L/min, 70 kg | 4500 mL/min, 64.29 mL/kg/min | 동일 | 일치 |
| 24 Fr | 8.00 mm | 8.00 mm | 일치 |
| 6.35 mm | 19.05 Fr | "19.0 Fr" 표시 | 부동소수점 반올림(19.0499…) |

### 3.9 Cannula Pressure Drop (`/cannula-pressure-drop/`)

**구현** (`main.js:1232-1300`)

1. 목표 유량이 최소 유량보다 작으면 `out_of_range`, 값 없음.
2. 최대 유량보다 크면 `out_of_range`. 단, CAN-2의 끝점 예외가 있다.
3. 원자료 점과 `|Δflow| ≤ 1e-6 L/min`이면 `exact`로 그 점의 값을 그대로 낸다(보간보다 우선).
4. 그 외에는 인접한 두 점 사이 **선형보간**: `left + (right − left) × (Q − Q_left)/(Q_right − Q_left)`.

- CAN-1 (✅): 현재 페이지의 조회·비교·차트 탐색은 모두 `interpolatePressureDropForEntry`를 거친다(`main.js:6930, 6981, 7390, 7423`). 차트 선도 원자료 점을 직선으로 잇는다(`main.js:1467`). 비선형 모델은 쓰이지 않는다.
- CAN-2 (⚠️, Medium): 1절 참조.
- CAN-3 (✅): 정확점 허용오차 `1e-6`, 끝점 간격 상한 `0.05 L/min`, 끝점 비교 여유 `1e-9`. 간격이 0.05를 넘으면 예외가 적용되지 않는다(4.06 L/min 가정 시 `out_of_range` 확인).
- CAN-4 (⚠️, Low): `updatePressureDropReference`(`main.js:1682-1767`)는 `interpolationMode !== 'linear'`인 항목에서 보간값을 power-law 적합 또는 단조 3차 스플라인 추정으로 **대체**하도록 되어 있고, 현재 224개 항목 모두 `interpolationMode`가 없다. 이 함수가 요구하는 DOM(`pressure-drop-manufacturer` 등)이 어느 페이지에도 없어 지금은 실행되지 않는다. 예전 패널이 다시 연결되면 "선형보간만 사용" 원칙이 깨진다.
- CAN-5 (❓, Low): 동맥 캐뉼라에서 추정값이 100 mmHg를 넘으면 "High arterial pressure drop (>100 mmHg)" 경고를 낸다. 100 mmHg 기준의 출처는 코드와 페이지에 없다.

**Worked example**

| 입력 | 기대값 | 실제값 | 차이 |
|---|---|---|---|
| 점 (1,10), (2,30), (4,110), Q=3 | 70, interpolated | 70, interpolated | 0 |
| 같은 점, Q=2 / Q=2.0000005 | 30, exact / exact | 동일 | 일치 |
| 같은 점, Q=0.5 / Q=4.01 | out_of_range, 값 없음 | 동일 | 일치 |
| 같은 점, 검증 끝점 4.03, Q=4.03 | 111.2, endpoint_adjusted | 동일 | <1e-13 |
| 같은 점, 검증 끝점 4.06, Q=4.06 | out_of_range | out_of_range | 일치 |
| 실데이터 MC2 32/40 Fr, 4·5번째 점의 중간 유량 | 두 점 평균 0.5 mmHg | 0.5 | <1e-15 |
| 실데이터 MC2 32/40 Fr, 6.0 L/min | 마지막 구간 직선 연장 11.7926 | 11.7926, endpoint_adjusted | 0 |

**데이터 이상치 목록 (재디지타이징하지 않음, 원자료 검토 대상만 나열)**

데이터: 224개 항목, 231개 시리즈(`data/cannula-pressure-drop.json`).

1. `npm run audit:cannula-data` 결과: HIGH 0, **MEDIUM 4**, LOW 0. 네 건 모두 같은 곡선이다.
   - Medtronic DLP Pediatric One-piece Arterial Cannula **6 Fr** (order 77006, 77106, 77206, 77306): 0.285 L/min 부근에서 인접 구간 기울기가 급변(slope-whiplash).
2. 유량이 늘 때 |ΔP|가 줄어드는 구간이 있는 시리즈 5개(이번 감사에서 추가로 확인). 모두 0.1–0.2 mmHg 수준의 역전이다.
   - Getinge / Maquet Avalon Elite Bi-Caval Dual-Lumen 27 Fr — Infusion (0.2 mmHg), Drainage (0.1 mmHg)
   - Getinge / Maquet Avalon Elite Bi-Caval Dual-Lumen 31 Fr — Infusion (0.1 mmHg), Drainage (0.1 mmHg)
   - Medtronic Bio-Medicus NextGen Pediatric Arterial Cannula 14 Fr (0.1 mmHg)
3. 참고: `testMedium`이 "Manufacturer graph; medium not specified"인 항목이 83개다. 물 기준 곡선과 섞어 비교할 때 해석에 영향을 줄 수 있다.

### 3.10 Time Calculator (`/timecalc/`)

**구현**

```
Record:     diff = end − start;  end < start 이면 end + 1440        (main.js:4317-4325)
            표시 "N min" 또는 "N min (Hhr MMmin)"                    (main.js:75-81)
Live:       HH:MM:SS = floor(ms/1000) 기준;  charting min = floor(ms / 60000), 1분 미만은 "<1 min"
                                                                     (main.js:3867-3877)
Transplant: elapsed = end ≥ start ? end − start : end + 1440 − start (main.js:5056-5064)
            total ischemic = cold(ACC→ice out) + warm(ice out→reperfusion), 합이 1440분 이상이면 null
                                                                     (main.js:5082-5091)
```

- TIME-1 (✅): 페이지 "Core calculation" 설명과 일치한다. 시작과 종료가 같으면 0분이다. 24시간 이상 구간은 지원하지 않으며 페이지가 이를 밝힌다.
- TIME-2 (✅): Live 모드는 경과 ms를 60,000으로 나눠 **내림**한다. 4분 59.9초는 "4 min"이다. 복사용 요약도 같은 내림 기준을 쓴다(`main.js:3902-3906`).
- TIME-3 (⚠️, Low): 페이지의 "Validation and rounding"은 "Seconds are not supported", "All durations are exact in minutes; no additional rounding is applied"라고만 적는다. Record 모드에는 맞지만 Live 모드는 초를 표시하고 분을 내림한다. 그 결과 Live 모드에서는 화면의 시작·종료 시각(HH:MM) 차이와 표시된 분 수가 1분 다를 수 있다. 예: 10:00:50 시작, 10:05:10 종료 → 시각은 10:00–10:05(5분 차이), 경과는 4분 20초 → "4 min". 차팅 시 어느 값을 기준으로 삼는지 설명이 없다.
- TIME-4 (✅): 폐 이식의 총 허혈 시간은 cold + warm이고, 두 구간이 각각 자정을 한 번 넘는 경우까지 처리한다. 합이 24시간 이상이면 입력 순서 오류와 구분할 수 없으므로 표시하지 않는다(코드 주석대로 동작).
- TIME-5 (🔶, Low): cold = donor ACC → ice out, warm = ice out → reperfusion(심장은 recipient ACC release)이라는 정의는 기관과 등록 사업에 따라 다를 수 있다. 심장 이식 요약에는 총 허혈 시간 줄이 없고 폐 이식에만 있다(`main.js:5255` 대 `5264-5265`).

**Worked example**

| 모드 | 입력 | 기대값 | 실제값 |
|---|---|---|---|
| Record | 10:15 → 12:20 | 125 min (2hr 05min) | 일치 |
| Record | 23:40 → 00:25 (자정 넘김) | 45 min | 일치 |
| Record | 0930 → 1005 (4자리 입력) | 35 min | 일치 |
| Record | 24:00, 12:60 | 거부(null) | 일치 |
| Live | 299,900 ms | 00:04:59 (4 min) | 일치 |
| Live | 59,000 ms / 3,601,000 ms | 00:00:59 (<1 min) / 01:00:01 (60 min) | 일치 |
| Transplant | 22:10 → 01:35 | 205분 | 일치 |
| Transplant | ACC 22:10, ice out 01:35, reperfusion 02:50 | 총 허혈 280분 = 280 min (4hr 40min) | 일치 |
| Transplant | ACC 10:00, ice out 09:00, reperfusion 10:30 (합 ≥ 24 h) | 표시 안 함(null) | 일치 |

### 3.11 Quick Reference (`/quick-reference/`)

- QR-1, QR-2: 1절 참조.
- QR-3 (❓, Low): MUF 수치(소아 10–20 mL/kg/min, 성인 150–300 mL/min, 10–20분, 목표 Hct 소아 ≥35–40% / 성인 ≥30–35%)는 페이지가 "AmSECT Pediatric & Congenital Standards and Guidelines (2019, section 16.1)"과 2024 EACTS 가이드라인을 든다. 두 문서 모두 접근하지 못했다.
- QR-4 (❓, Low): "Cooling time: at least 20–50 min; Rewarming: ≤0.5°C/min"은 출처 문구 없이 HCA 주석에 들어 있다. 대조하지 못했다.
- QR-5 (✅): ACP 유량 범위 `(mL/kg/min) × kg`, L/min 환산 `÷ 1000`, 소아 MUF 범위 `10–20 × kg`는 산술적으로 맞다. 범위 값은 카드 데이터에서 그대로 가져온다.

---

## 4. 검증하지 못한 항목과 그 이유

| 항목 | 못한 이유 | 다음에 필요한 것 |
|---|---|---|
| Mosteller 1987, Du Bois 1916, Boyd 1935, Gehan & George 1970 원문 계수 | 유료·단행본·초록 없음 | 원문 확보 후 계수 대조. Boyd는 계수 자릿수(0.0003207) 확인 |
| Boer 1984, Hume 1966 원문 식 | 초록에 식 없음, PMC는 스캔 이미지 | 원문 PDF 육안 대조 |
| Devine 1974 IBW 원식 | 원문 미접근 | 2.3 kg/inch 표현과 0.91 kg/cm 반올림 확인 |
| Pettersen 2008 계수 105개, BSA 공식, 연령·BSA 범위 원문 표현 | 유료, 재수록 PDF 접근 차단 | 원문 Table 2와 Methods |
| Lopez 2021 Table 3의 LVESD 계수 | PMC 본문 봇 차단 (Table 1 페이지만 열림) | 본문 또는 PHN 공식 계산기 |
| PHN BSA 유효 범위 0.15–2.5 | 2017 논문에 전체 범위 없음 | 보충 자료 또는 PHN 계산기 문서 |
| 2024 EACTS/EACTAIC/EBCP CPB 가이드라인의 HCA·ACP·MUF·protamine·DO₂ 권고 | 원문 미접근 | 가이드라인 원문의 절·표 번호 |
| 2024 EACTS/EACTAIC PBM 가이드라인의 protamine 비율 권고 문구 | 원문 미접근 (2차 문헌으로만 확인) | 원문 권고 문구와 등급 |
| AmSECT Pediatric & Congenital Standards 2019 | 미접근 | 16.1절 원문 |
| EBV 계수의 1차 출처 | 교과서 관행값으로만 확인 | 인용할 교과서·논문 지정 |
| 국내 적혈구 제제의 단위 부피·Hct | 조사하지 않음 | 대한적십자사 제제 규격 |
| Oxygenator 프리셋 8종 prime volume | 제조사 IFU 미대조 | 각 제품 현행 IFU 문서 번호 |
| Gauge ↔ mm 표 | ISO 9626 등 유료 | 표준 원문, 주사침·카테터 규격 구분 |
| NIST SP 811 표 원문 | 같은 값을 실은 계측 환산표로 대조 | (값은 정의 상수라 위험 낮음) |
| 동맥 캐뉼라 100 mmHg 경고 기준, GDP ±10% 구간, 360 소아 목표, Q₁₀ 2.2, ABW 0.3 계수 | 코드·페이지에 출처 없음 | 근거 문헌 지정 또는 "기관 관행" 명시 |
| 캐뉼라 압력-유량 곡선의 원자료 대비 정확도 | 감사 범위 밖(재디지타이징 금지) | 3.9절 목록 9개 시리즈의 원본 차트 재검토 |
| 운영 사이트 배포본 | 접근하지 않음 | 배포 커밋과 `main` 일치 여부 확인 |
| UI 렌더링 결과 | 브라우저 실행 없이 함수 단위로 검증 | 필요 시 브라우저에서 표시값 확인 |

## 5. 참고 문헌 (이번 감사에서 실제로 열어 본 것)

1. Haycock GB, Schwartz GJ, Wisotsky DH. Geometric method for measuring body surface area. J Pediatr. 1978;93(1):62-66. doi:10.1016/S0022-3476(78)80601-5 (초록)
2. Lopez L, Colan S, Stylianou M, et al. Relationship of echocardiographic Z scores adjusted for body surface area to age, sex, race, and ethnicity. Circ Cardiovasc Imaging. 2017;10(11):e006979. doi:10.1161/CIRCIMAGING.117.006979 (PMC5812349 전문)
3. Lopez L, Frommelt PC, Colan SD, et al. Pediatric Heart Network echocardiographic Z scores: comparison with other published models. J Am Soc Echocardiogr. 2021;34(2):185-192. doi:10.1016/j.echo.2020.09.019 (PMC7870534, Table 1)
4. Pettersen MD, Du W, Skeens ME, Humes RA. Regression equations for calculation of z scores of cardiac structures. J Am Soc Echocardiogr. 2008;21(8):922-934. doi:10.1016/j.echo.2008.02.006 (초록만)
5. Comparison of echocardiographic linear dimensions for male and female child and adolescent athletes with published pediatric normative data. PMC6181376 (Pettersen 방식의 Z 식 서술)
6. de Somer F, Mulholland JW, Bryan MR, et al. O₂ delivery and CO₂ production during cardiopulmonary bypass as determinants of acute kidney injury. Crit Care. 2011;15(4):R192. doi:10.1186/cc10349 (전문)
7. Ranucci M, Johnson I, Willcox T, et al. Goal-directed perfusion to reduce acute kidney injury: a randomized trial. J Thorac Cardiovasc Surg. 2018;156(5):1918-1927.e2. doi:10.1016/j.jtcvs.2018.04.045 (저자 수락본)
8. Parolari A, Alamanni F, Gherli T, et al. Cardiopulmonary bypass and oxygen consumption: oxygen delivery and hemodynamics. Ann Thorac Surg. 1999;67(5):1320-1327. doi:10.1016/S0003-4975(99)00261-1 (본문 발췌)
9. El Dsouki Y, Condello I. A temperature-adjusted algorithm for predicting critical indexed oxygen delivery (DO₂i) during cardiopulmonary bypass. Cureus. 2025;17(7):e87089. doi:10.7759/cureus.87089 (PMC12221110 전문)
10. McCullough JN, Zhang N, Reich DL, et al. Cerebral metabolic suppression during hypothermic circulatory arrest in humans. Ann Thorac Surg. 1999;67(6):1895-1899 (초록; 표는 J Nippon Med Sch 2023;90:11 재수록본)
11. Shore-Lesserson L, Baker RA, Ferraris V, et al. STS/SCA/AmSECT clinical practice guidelines: anticoagulation during cardiopulmonary bypass. J Extra Corpor Technol. 2018;50(1):5-18 (PMC5850589 전문). Ann Thorac Surg. 2018;105:650-662. doi:10.1016/j.athoracsur.2017.09.061
12. Levy JH, Sniecinski RM, Maier CL, et al. Finding a common definition of heparin resistance in adult cardiac surgery. J Thromb Haemost. 2024;22(4):1249-1257. doi:10.1016/j.jtha.2024.01.001 (초록)
13. Vienne M, Haas E, Wipf T, et al. Adjusted calculation model of heparin management during cardiopulmonary bypass in obese patients. Eur J Anaesthesiol. 2018;35(8):613-620. doi:10.1097/EJA.0000000000000784 (초록)
14. AABB, American Red Cross, America's Blood Centers, Armed Services Blood Program. Circular of Information for the Use of Human Blood and Blood Components (문구 인용본으로 확인)
15. NIST Special Publication 811, Guide for the Use of the International System of Units (SI), Appendix B.8 (환산 계수)
