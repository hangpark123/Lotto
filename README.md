# Lotto

동행복권 계정으로 로그인해서 구매/조회/가상계좌/번호 관리를 할 수 있는 개인용 웹 프로젝트입니다.

## 주요 기능

- 로그인/로그아웃, 세션 유지
- 대시보드 잔액 조회
- 온라인 로또 구매 한도 표시
  - 이번주 구매 가능 금액(주간 5,000원 기준)
- 로또 구매
  - 수동 입력
  - 자동 번호
  - AI 추천
  - 최대 5게임 동시 구매
- 구매 내역 조회
  - 최대 1개월 범위 조회
  - 시작일 변경 시 종료일 자동 보정
- 개인별 가상계좌 발급/조회
- 나의 지정번호 저장/불러오기/삭제 (계정별)
- 최근 회차 확인
  - 이전/다음 회차 넘기기
  - 당첨번호 + 보너스번호
  - 등수별 당첨금/당첨게임 수/당첨기준

## 기술 스택

- Backend: FastAPI, Uvicorn
- Frontend: HTML, CSS, Vanilla JavaScript
- Storage: SQLite (`web/backend/app_data.sqlite3`)

## 실행 방법 (Windows PowerShell)

```powershell
cd C:\Project\dhlottery-api-main
python -m venv venv
.\venv\Scripts\Activate.ps1

# Windows cp949 환경에서 pip 인코딩 오류 방지
$env:PYTHONUTF8="1"

pip install -r web/backend/requirements-web.txt
python web/backend/server.py
```

서버 실행 후 접속:

- 로컬: `http://localhost:8001`
- 내부망: 실행 로그에 출력되는 `http://<내부 IP>:8001`

## 포트/호스트 변경

```powershell
$env:WEB_HOST="0.0.0.0"
$env:WEB_PORT="8002"
python web/backend/server.py
```

## 내부망 접속이 안 될 때

Windows 방화벽에서 해당 포트 허용:

```powershell
netsh advfirewall firewall add rule name="DHLottery Web 8001" dir=in action=allow protocol=TCP localport=8001 profile=private
```

## 핵심 API

- `POST /api/login`
- `POST /api/logout`
- `GET /api/session`
- `GET /api/balance`
- `POST /api/buy-lotto645`
- `POST /api/buy-list`
- `GET /api/weekly-purchase-limit`
- `POST /api/assign-virtual-account`
- `GET /api/virtual-account`
- `GET /api/my-lotto-numbers`
- `POST /api/my-lotto-numbers`
- `DELETE /api/my-lotto-numbers/{number_id}`
- `GET /api/lotto-draws?limit=80`
- `GET /api/last-draw`

## 프로젝트 구조

```text
web/
  backend/
    server.py
    api_wrapper.py
    ai_service.py
    requirements-web.txt
    app_data.sqlite3
  frontend/
    index.html
    app.js
    style_clean.css
src/
  dhapi/
tests/
```

## 참고/주의

- 비공식 API 기반 프로젝트입니다.
- 개인 학습/개인 사용 목적에 맞게 사용하세요.
- 외부 서비스 정책 변경에 따라 일부 기능이 동작하지 않을 수 있습니다.

