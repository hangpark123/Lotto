# 동행복권 웹 애플리케이션

동행복권 비공식 API를 웹 브라우저에서 사용할 수 있는 풀스택 웹 애플리케이션입니다.

## 기능

- 🔐 로그인 / 로그아웃
- 💰 예치금 현황 조회
- 🎫 로또6/45 구매 (자동/반자동/수동)
- 📜 구매 내역 조회
- 🏦 개인별 가상계좌 할당/조회

## 기술 스택

### 백엔드
- **FastAPI**: 고성능 Python 웹 프레임워크
- **Uvicorn**: ASGI 서버
- **기존 dhapi 로직**: 동행복권 사이트 통신

### 프론트엔드
- **Vanilla JavaScript**: 가볍고 빠른 SPA
- **CSS3**: 모던 디자인 시스템 (다크 모드, 그라데이션, 애니메이션)
- **Google Fonts (Inter)**: 프리미엄 타이포그래피

## 설치 및 실행

### 1. 의존성 설치

```bash
cd web/backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux
pip install -r requirements-web.txt
```

### 2. 서버 실행

```bash
python server.py
```

서버가 `http://localhost:8001`에서 실행됩니다.
필요하면 환경변수로 바인딩 주소/포트를 지정할 수 있습니다.

```powershell
$env:WEB_HOST="0.0.0.0"
$env:WEB_PORT="8001"
python server.py
```

### 3. 브라우저에서 접속

```
http://localhost:8001
```

## API 문서

서버 실행 후 다음 URL에서 자동 생성된 API 문서를 확인할 수 있습니다:

- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

## API 엔드포인트

### 인증
- `POST /api/login` - 로그인
- `POST /api/logout` - 로그아웃
- `GET /api/session` - 세션 확인

### 로또
- `POST /api/buy-lotto645` - 로또6/45 구매
- `GET /api/balance` - 예치금 현황 조회
- `POST /api/buy-list` - 구매 내역 조회
- `POST /api/assign-virtual-account` - 가상계좌 할당
- `GET /api/virtual-account` - 로그인 사용자 기준 가상계좌 조회

## 프로젝트 구조

```
web/
├── backend/
│   ├── server.py              # FastAPI 메인 서버
│   ├── api_wrapper.py         # LotteryClient 래퍼
│   └── requirements-web.txt   # Python 의존성
└── frontend/
    ├── index.html             # 메인 HTML
    ├── style.css              # 디자인 시스템
    └── app.js                 # JavaScript 로직
```

## 보안 고려사항

- 세션은 메모리 기반으로 관리됩니다 (서버 재시작 시 초기화)
- 프로덕션 환경에서는 Redis 등을 사용한 세션 스토어 권장
- HTTPS 사용 권장
- CORS 설정을 프로덕션 도메인으로 제한 필요

## 배포

### 로컬 네트워크 배포

```bash
# 0.0.0.0으로 바인딩하여 같은 네트워크의 다른 기기에서 접속 가능
python server.py
```

다른 기기에서 `http://<서버IP>:8001`으로 접속

Windows 방화벽에 막히면 관리자 PowerShell에서 다음 명령 실행:

```powershell
netsh advfirewall firewall add rule name="DHLottery Web 8001" dir=in action=allow protocol=TCP localport=8001 profile=private
```

### 프로덕션 배포

1. **환경 변수 설정**
   ```bash
   export PYTHONPATH="${PYTHONPATH}:/path/to/dhlottery-api-main/src"
   ```

2. **Uvicorn으로 실행**
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
   ```

3. **Nginx 리버스 프록시 설정 (선택사항)**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:8001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 라이선스

MIT License - 원본 프로젝트의 라이선스를 따릅니다.

## 주의사항

⚠️ 이 프로젝트는 **비공식** 동행복권 API입니다. 동행복권 공식 서비스가 아니며, 개인적인 용도로만 사용하시기 바랍니다.
