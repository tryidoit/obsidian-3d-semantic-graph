# Obsidian 3D Semantic Graph

> 볼트를 3D 시맨틱 우주로 — 의미가 비슷한 노트들이 서로 모여 클러스터를 이룹니다.

![753개 노트 볼트의 3D 시맨틱 그래프, 폴더별 색상](images/graph-overview.png)

Obsidian 플러그인(데스크톱 및 iOS/iPadOS 지원)으로, 노트를 인터랙티브 3D 공간에 시각화합니다. OpenAI 임베딩 또는 검증된 업로드 벡터를 UMAP/PCA로 3차원에 투영하여 의미적으로 가까운 노트를 가깝게 배치합니다. 임베딩이 없으면 폴더 기반 클러스터 구형 레이아웃과 ConvexHull 클러스터 영역을 표시합니다.

[English](../README.md)

> **포크 추가 기능:** iOS/iPadOS 지원, 볼트 내부 `_semantic-graph/` 폴더에 데이터 저장(iCloud 등으로 동기화), Claude Desktop MCP 서버(`mcp/server.mjs`). 자세한 내용은 [영문 README](../README.md#claude-desktop-integration)를 참고하세요.

## 주요 기능

- **의미 기반 3D 배치** — OpenAI 임베딩 또는 업로드 벡터를 UMAP/PCA로 3D 좌표에 투영
- **시맨틱 검색** — 툴바에서 의미로 검색하면 상위 매칭 노트가 그래프에서 하이라이트되고 카메라가 1위 결과로 날아감
- **자동 라벨 시맨틱 클러스터** — 임베딩 유사도(k-means)로 클러스터 영역을 묶고 노트 제목·태그에서 주제 라벨을 자동 생성 (예: "관측 · 우주 · 천문학"); 폴더 기준으로 전환 가능
- **프로바이더 확장 구조** — 현재 OpenAI 생성, Anthropic/Claude 예약 어댑터, 향후 프로바이더를 위한 capability 기반 인터페이스
- **인사이트 패널** — 링크 제안(의미적으로 가깝지만 연결되지 않은 노트 쌍을 코사인 유사도 + 공유 태그/같은 폴더/공통 링크 신호로 랭킹, 점선으로 표시, 원클릭 링크 삽입), 중복 의심 노트, 고아 노트, 클러스터별 MOC(Map of Content) 생성
- **시맨틱 이웃 사이드바** — 활성 노트의 의미적 이웃을 미니 3D 뷰와 유사도 순위 리스트로 표시
- **타임라인 재생** — 노트 생성일 기준으로 vault의 성장 과정을 애니메이션으로 재생 (기본은 파일 생성 시각, 설정에서 frontmatter `created` / `date created` 기준으로 변경 가능)
- **인터랙티브 HTML 내보내기** — 현재 그래프를 HTML 파일로 다운로드하고 Obsidian 딥링크 제공(렌더러 CDN 로드에 인터넷 필요)
- **한국어/영어 UI** — 언어 설정(자동 / English / 한국어), 자동은 Obsidian 앱 언어를 따름
- **클러스터 구형 폴백** — 임베딩 없이도 폴더 기반 클러스터 레이아웃과 색상 그룹 표시
- **ConvexHull 클러스터 영역** — 시맨틱 또는 폴더 클러스터를 감싸는 반투명 3D 볼록 껍질 (On / Hover / Off 전환)
- **노트 링크** — Obsidian의 실제 resolved links 기반 연결선, 툴바에서 토글 가능
- **노드 색상** — 폴더 또는 첫 번째 태그 기준 색상 지정
- **업로드 벡터** — API 임베딩 대신 커스텀 벡터 JSON 파일 가져오기/내보내기
- **진입 애니메이션** — 그래프를 열 때 노드가 중심에서 퍼져나가고 카메라가 날아들어옴 (설정에서 끄기 가능, OS 모션 축소 설정 존중)
- **외관 설정** — 라이트/다크 테마, 그리드, 자동 회전, 노드 크기, 투명도, 드래그 감도
- **결정적 시드** — 동일한 시드로 동일한 그래프 레이아웃 재현
- **빠른 재열기** — 내용 해시와 계산된 레이아웃을 캐시해 변경 없는 vault에서는 재임베딩과 UMAP/PCA를 모두 건너뜀
- **임베딩 캐시** — 변경되지 않은 노트의 벡터를 재사용하여 API 호출 최소화
- **제외 폴더** — 지정한 폴더를 그래프 및 임베딩 생성에서 모두 제외

## 스크린샷

시맨틱 클러스터 근접 뷰 — 색상은 최상위 폴더이며, 임베딩 기반 배치가 폴더를 넘어 관련 주제를 서로 끌어당깁니다:

![시맨틱 클러스터 근접 뷰](images/graph-clusters.png)

## 동작 방식

1. 설정에서 제외한 폴더를 빼고 vault의 마크다운 파일을 읽습니다.
2. 각 노트를 노드로 만들고, Obsidian의 resolved links로 연결선을 생성합니다.
3. OpenAI API 키나 업로드 벡터가 있으면 임베딩을 UMAP/PCA로 3D 좌표에 투영합니다.
4. 둘 다 없으면 폴더 기반 클러스터 구형 레이아웃과 ConvexHull 영역을 사용합니다.

### 임베딩 프로바이더 지원 범위

- **OpenAI** — 노트 및 검색 쿼리 임베딩을 완전히 지원합니다.
- **Anthropic (Claude)** — 비활성 예약 어댑터로 표시됩니다. Anthropic은 현재 네이티브 임베딩 API가 없으므로, 플러그인은 노트 내용을 제3자 서비스로 암묵적으로 보내지 않습니다.
- **외부/로컬 모델** — 이번 범위에서는 제외했습니다. 그래프·검색·설정 로직을 바꾸지 않고 추가할 수 있도록 capability와 어댑터 경계를 마련했습니다.

업로드 벡터는 프로바이더 생성과 별개로 사용할 수 있습니다. 업로드 벡터의 시맨틱 검색은 쿼리 임베딩에 쓰는 OpenAI 프로바이더·모델 메타데이터가 일치할 때만 활성화됩니다.

## 설치

Obsidian **1.11.0 이상** 필요 (데스크톱, iOS, iPadOS).

### 커뮤니티 플러그인

**설정 → 커뮤니티 플러그인**에서 **3D Semantic Graph**를 검색해 설치합니다.

### 소스에서 빌드

```bash
git clone https://github.com/KHR0907/obsidian-3d-semantic-graph.git
cd obsidian-3d-semantic-graph
npm ci
npm run check
```

`npm run check`는 타입 검사, 린트, 테스트, 프로덕션 빌드를 차례로 실행합니다. 빌드 후 런타임 파일만 아래 플러그인 디렉터리에 복사합니다.

```
<your-vault>/.obsidian/plugins/3d-semantic-graph/
├── main.js
├── manifest.json
└── styles.css
```

디렉터리가 없다면 먼저 생성합니다. 그다음 Obsidian을 다시 시작하고 **설정 → 커뮤니티 플러그인**에서 **3D Semantic Graph**를 활성화합니다. 수동 설치본을 업데이트할 때도 같은 세 파일만 교체하고 Obsidian을 재시작하면 되며, 플러그인 데이터와 임베딩 캐시는 그대로 유지됩니다.

## 개발

```bash
npm run dev    # watch 모드
npm run build  # 프로덕션 빌드
npm run check  # 타입 검사, 린트, 테스트, 프로덕션 빌드
```

배포 파일은 `main.js`, `manifest.json`, `styles.css` 세 개입니다. 개발 의존성과 소스 파일은 vault에 복사할 필요가 없습니다.

## 사용 방법

1. **설정 → 3D Semantic Graph**에서 OpenAI 임베딩을 설정하거나 벡터를 업로드합니다(선택).
2. 리본 아이콘이나 **Open 3D Semantic Graph** 명령으로 그래프를 엽니다.
3. **툴바 컨트롤:**
   - **Refresh** — 그래프 전체 재빌드
   - **Reset Camera** — 초기 카메라 앵글로 복귀
   - **Search** — 시맨틱 검색; Enter로 상위 매칭 하이라이트 + 1위 결과로 카메라 이동, 결과 클릭 시 해당 노드로 이동, 더블클릭 시 노트 열기, Esc로 해제
   - **Links** — 연결선 표시/숨김 전환
   - **Grid** — XZ 그리드 표시/숨김 전환
   - **Clusters** — 클러스터 영역 모드 순환 (On → Hover → Off)
   - **Insights** — 인사이트 패널 열기 (링크 제안, 중복, 고아 노트, MOC)
   - **Timeline** — 노트 생성일 기준 vault 성장 재생
   - **Export HTML** — 인터랙티브 HTML 스냅샷 다운로드(열 때 인터넷 필요)
4. 노드를 클릭하면 선택됩니다. Shift+클릭으로 해당 노트를 엽니다.
5. **Open semantic neighbors** 명령으로 사이드바를 열면 활성 노트의 의미적 이웃을 볼 수 있습니다.

## 설정 항목

| 설정 | 설명 | 기본값 |
| --- | --- | --- |
| Language | 플러그인 UI 언어 (자동 / English / 한국어) | `auto` |
| Embedding Provider | OpenAI 또는 비활성 Anthropic/Claude 예약 항목 | `openai` |
| API Key | OpenAI API 키 | 비어 있음 |
| Embedding Model | 선택한 프로바이더의 임베딩 모델 | `text-embedding-3-large` |
| Suggested Links | 인사이트 패널의 링크 제안 최대 개수 | `20` |
| Neighbor Count | 시맨틱 이웃 사이드바 노트 수 | `10` |
| Custom Vector JSON | API 임베딩 대신 사용할 벡터 JSON 업로드/내보내기 | 비어 있음 |
| Projection Method | UMAP 또는 PCA 차원 축소 방식 | `umap` |
| Layout Seed | 결정적 레이아웃을 위한 시드 | 랜덤 |
| Timeline Date Source | 타임라인 날짜 기준: 파일 생성 시각 또는 frontmatter `created` | `ctime` |
| Node Color By | 폴더 또는 첫 번째 태그 기준 색상 지정 | `folder` |
| Show Links | 노트 간 연결선 표시 | Off |
| Show Grid | XZ 평면 그리드 표시 | On |
| Show Clusters | ConvexHull 클러스터 영역 표시 모드 | `hover` |
| Cluster Grouping | 클러스터 영역 그룹 기준: 시맨틱(자동 라벨) 또는 폴더 | `semantic` |
| Scene Theme | 자동(앱 테마 따라가기), 다크, 라이트 배경 | `auto` |
| Node Opacity | 노드 투명도 (0.15–1.0) | `1.0` |
| Node Size | 노드 크기 배율 (0.4–2.0) | `1.5` |
| Drag Sensitivity | 카메라 회전 감도 (0.2–3.0) | `1.0` |
| Auto Orbit Speed | 유휴 상태 자동 회전 속도 (`0`이면 비활성화) | `0.2` |
| Entry Animation | 그래프를 열 때 노드 확산 + 카메라 진입 애니메이션 | 켬 |
| Exclude Folders | 제외할 폴더 목록(쉼표 구분) | 비어 있음 |
| Number of Neighbors | UMAP 로컬/전역 균형 (5–50) | `40` |
| Minimum Distance | UMAP 군집 거리 (0–0.99) | `0.80` |

## 캐시

- `embeddings-cache.json` — 노트 벡터; 임베딩 모델이 바뀌거나 노트 내용이 바뀌면 자동 무효화
- `embeddings-hashes.json` — 45MB급 벡터 캐시를 파싱하지 않고 vault 변경 여부를 검증하는 경량 내용 해시 인덱스
- `layout-cache.json` — 계산된 3D 좌표와 시맨틱 클러스터; 변경이 없으면 재사용되어 재열기 시 UMAP/PCA를 통째로 건너뜀

세 파일 모두 플러그인 디렉터리에 저장되며 오래되면 자동으로 재생성됩니다.

## 개인정보 및 벡터 형식

OpenAI 생성을 활성화하면 정리된 노트 본문과 시맨틱 검색어가 선택한 OpenAI 임베딩 모델로 전송됩니다. API 키는 Obsidian의 로컬 플러그인 설정에 저장되고, 임베딩·레이아웃 캐시는 로컬 플러그인 디렉터리에 남습니다. 업로드 벡터는 유한한 숫자, 일관된 차원, 현재 그래프에 실제로 존재하는 경로인지 검증한 뒤 사용합니다.

내보낸 JSON에는 `provider`, `model`, `dimensions` 메타데이터와 vault 기준 Markdown 경로를 키로 하는 `entries`가 포함됩니다. 벡터 내보내기는 파일 다운로드만 수행하며 vault의 노트를 생성하거나 덮어쓰지 않습니다.

메모리와 UI 작업량을 제한하기 위해 쌍별 인사이트는 임베딩 노트 3,000개까지 계산하고 중복 결과 수도 제한합니다.

## 기술 스택

- [3d-force-graph](https://github.com/vasturiano/3d-force-graph) — 3D 그래프 렌더링
- [Three.js](https://threejs.org/) — WebGL 씬, ConvexGeometry로 클러스터 껍질 생성
- [umap-js](https://github.com/PAIR-code/umap-js) — UMAP 차원 축소
- [esbuild](https://esbuild.github.io/) — 번들러
- Obsidian `requestUrl` API를 통한 OpenAI 임베딩

## 라이선스

MIT
