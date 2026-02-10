"""
동행복권 웹 API 서버
FastAPI 기반 REST API
"""
import uuid
import re
import os
import socket
import sqlite3
import json
import datetime as dt
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import requests

from api_wrapper import APIWrapper
from ai_service import ai_service

# FastAPI 앱 생성
app = FastAPI(
    title="동행복권 웹 API",
    description="동행복권 비공식 웹 API (AI 기능 포함)",
    version="1.2.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 세션 스토어 (메모리 기반 - 프로덕션에서는 Redis 등 사용 권장)
sessions: Dict[str, Dict] = {}
# 사용자별 가상계좌 저장소 (메모리 기반)
virtual_accounts_by_user: Dict[str, Dict[str, Any]] = {}
WEEKLY_ONLINE_LIMIT_KRW = 5000
LOTTO_GAME_PRICE_KRW = 1000
MAX_SAVED_NUMBERS_PER_USER = 30
MAX_SAVED_NAME_LENGTH = 30
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
APP_DB_PATH = BASE_DIR / "app_data.sqlite3"

# Pydantic 모델
class LoginRequest(BaseModel):
    username: str
    password: str

class LottoTicket(BaseModel):
    numbers: str = ""  # 빈 문자열이면 자동

class BuyLottoRequest(BaseModel):
    tickets: List[LottoTicket]

class BuyListRequest(BaseModel):
    start_date: Optional[str] = None  # YYYYMMDD
    end_date: Optional[str] = None

class VirtualAccountRequest(BaseModel):
    amount: int


class MyLottoNumberRequest(BaseModel):
    numbers: List[int]
    name: Optional[str] = None


# 유틸리티 함수
def get_session(session_id: str):
    """세션 조회"""
    if session_id not in sessions:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    
    session = sessions[session_id]
    
    # 세션 만료 확인 (24시간)
    if datetime.now() > session["expires_at"]:
        del sessions[session_id]
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다. 다시 로그인해주세요.")
    
    return session


def is_valid_virtual_account_number(account: Optional[str]) -> bool:
    if not account:
        return False
    value = re.sub(r"\s+", "", str(account))
    if not re.fullmatch(r"[0-9][0-9\-]*[0-9]", value):
        return False
    digits = re.sub(r"\D", "", value)
    if len(digits) < 10 or len(digits) > 16:
        return False
    if re.fullmatch(r"1[5-9][0-9]{2}-?[0-9]{4}", value):
        return False
    if re.fullmatch(r"0\d{1,2}-(?:\d{3,4})-\d{4}", value):
        return False
    return True


def _current_week_range_yyyymmdd(now: Optional[datetime] = None) -> tuple[str, str, str, str]:
    base_date = (now or datetime.now()).date()
    week_start = base_date - timedelta(days=base_date.weekday())
    week_end = week_start + timedelta(days=6)
    return (
        week_start.strftime("%Y%m%d"),
        week_end.strftime("%Y%m%d"),
        week_start.isoformat(),
        week_end.isoformat(),
    )


def _extract_int(value: Any) -> int:
    if value is None:
        return 0
    digits = re.sub(r"[^\d]", "", str(value))
    return int(digits) if digits else 0


def _compute_weekly_spent_from_buy_list(data: Any) -> int:
    if not isinstance(data, list):
        return 0

    spent = 0
    for table in data:
        if not isinstance(table, dict):
            continue
        rows = table.get("rows", [])
        if not isinstance(rows, list):
            continue

        for row in rows:
            if not isinstance(row, list) or len(row) < 5:
                continue
            quantity = _extract_int(row[4])
            if quantity <= 0:
                continue
            spent += quantity * LOTTO_GAME_PRICE_KRW

    return spent


def _db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(APP_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_app_db() -> None:
    with _db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS my_lotto_numbers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                name TEXT,
                numbers TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_my_lotto_numbers_user ON my_lotto_numbers (username, id DESC)"
        )
        conn.commit()


def _normalize_lotto_numbers(numbers: List[int]) -> List[int]:
    if len(numbers) != 6:
        raise ValueError("번호는 정확히 6개여야 합니다.")
    normalized = sorted({int(n) for n in numbers})
    if len(normalized) != 6:
        raise ValueError("중복 없는 번호 6개를 입력해주세요.")
    if any(n < 1 or n > 45 for n in normalized):
        raise ValueError("번호는 1~45 범위여야 합니다.")
    return normalized


def _serialize_numbers(numbers: List[int]) -> str:
    return ",".join(str(n) for n in numbers)


def _deserialize_numbers(numbers: str) -> List[int]:
    return [int(v) for v in str(numbers).split(",") if str(v).strip()]


def _list_my_lotto_numbers(username: str, limit: int = MAX_SAVED_NUMBERS_PER_USER) -> List[Dict[str, Any]]:
    with _db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, username, name, numbers, created_at
            FROM my_lotto_numbers
            WHERE username = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (username, max(1, int(limit))),
        ).fetchall()

    items: List[Dict[str, Any]] = []
    for row in rows:
        try:
            numbers = _normalize_lotto_numbers(_deserialize_numbers(row["numbers"]))
        except (TypeError, ValueError):
            continue
        items.append(
            {
                "id": int(row["id"]),
                "username": row["username"],
                "name": row["name"] or None,
                "numbers": numbers,
                "created_at": row["created_at"],
            }
        )
    return items


def _insert_my_lotto_numbers(username: str, numbers: List[int], name: Optional[str]) -> Dict[str, Any]:
    normalized = _normalize_lotto_numbers(numbers)
    normalized_name = (name or "").strip()
    if len(normalized_name) > MAX_SAVED_NAME_LENGTH:
        raise ValueError(f"번호 이름은 최대 {MAX_SAVED_NAME_LENGTH}자까지 입력할 수 있습니다.")

    created_at = datetime.now().isoformat(timespec="seconds")
    with _db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO my_lotto_numbers (username, name, numbers, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                username,
                normalized_name or None,
                _serialize_numbers(normalized),
                created_at,
            ),
        )

        conn.execute(
            """
            DELETE FROM my_lotto_numbers
            WHERE username = ?
              AND id NOT IN (
                SELECT id FROM my_lotto_numbers
                WHERE username = ?
                ORDER BY id DESC
                LIMIT ?
              )
            """,
            (username, username, MAX_SAVED_NUMBERS_PER_USER),
        )
        conn.commit()

    return {
        "id": int(cursor.lastrowid),
        "username": username,
        "name": normalized_name or None,
        "numbers": normalized,
        "created_at": created_at,
    }


def _delete_my_lotto_numbers(username: str, number_id: int) -> bool:
    with _db_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM my_lotto_numbers WHERE id = ? AND username = ?",
            (int(number_id), username),
        )
        conn.commit()
        return cursor.rowcount > 0


def _current_selling_round(now: Optional[datetime] = None) -> int:
    first_round_date = dt.date(2002, 12, 7)
    today = (now or datetime.now()).date()
    days_until_saturday = (5 - today.weekday()) % 7
    this_saturday = today + timedelta(days=days_until_saturday)
    days_diff = (this_saturday - first_round_date).days
    return 1 + (days_diff // 7)


_last_draw_cache: Dict[str, Any] = {"fetched_at": None, "data": None}
_draw_history_cache: Dict[str, Any] = {"fetched_at": None, "items": []}


def _decode_json_response(resp: Any) -> Optional[Dict[str, Any]]:
    if not resp or getattr(resp, "status_code", 0) != 200:
        return None

    content_type = (resp.headers.get("Content-Type") or "").lower()
    if "application/json" in content_type:
        try:
            payload = resp.json()
        except ValueError:
            return None
    else:
        text = (getattr(resp, "text", "") or "").strip()
        if not text.startswith("{"):
            return None
        try:
            payload = json.loads(text)
        except (TypeError, ValueError):
            return None

    return payload if isinstance(payload, dict) else None


def _request_json_endpoint(
    url: str,
    *,
    client: Optional[Any] = None,
    params: Optional[Dict[str, Any]] = None,
    referer: Optional[str] = None,
    timeout: int = 8,
) -> Optional[Dict[str, Any]]:
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": referer or "https://www.dhlottery.co.kr/",
    }

    try:
        if client is not None and hasattr(client, "_get_with_wait_retry"):
            resp = client._get_with_wait_retry(
                url,
                params=params,
                headers=headers,
                timeout=timeout,
                max_attempts=8,
                wait_seconds=1,
            )
        elif client is not None and hasattr(client, "_session"):
            resp = client._session.get(url, params=params, headers=headers, timeout=timeout)
        else:
            resp = requests.get(url, params=params, headers=headers, timeout=timeout)
    except Exception:
        return None

    return _decode_json_response(resp)


def _request_lotto_number_payload(round_no: int, client: Optional[Any] = None) -> Optional[Dict[str, Any]]:
    return _request_json_endpoint(
        "https://www.dhlottery.co.kr/common.do",
        client=client,
        params={"method": "getLottoNumber", "drwNo": round_no},
        referer="https://www.dhlottery.co.kr/lt645/result",
    )


def _normalize_draw_date_yyyymmdd(raw: Any) -> str:
    value = re.sub(r"[^\d]", "", str(raw or ""))
    if len(value) == 8:
        return f"{value[0:4]}-{value[4:6]}-{value[6:8]}"
    return str(raw or "")


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        digits = re.sub(r"[^\d\-]", "", str(value or ""))
        if not digits or digits == "-":
            return default
        try:
            return int(digits)
        except ValueError:
            return default


def _build_draw_rank_rows(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    criteria = {
        1: "6개번호 일치",
        2: "5개번호 일치 + 보너스번호 일치",
        3: "5개번호 일치",
        4: "4개번호 일치",
        5: "3개번호 일치",
    }

    auto_cnt = max(0, _as_int(item.get("winType1"), 0))
    manual_cnt = max(0, _as_int(item.get("winType2"), 0))
    semi_auto_cnt = max(0, _as_int(item.get("winType3"), 0))
    remark = ""
    if _as_int(item.get("winType0"), 0) == 0 and (auto_cnt > 0 or manual_cnt > 0 or semi_auto_cnt > 0):
        remark = f"자동{auto_cnt} / 수동{manual_cnt} / 반자동{semi_auto_cnt}"

    rows: List[Dict[str, Any]] = []
    for rank in range(1, 6):
        row = {
            "rank": rank,
            "total_prize_amount": max(0, _as_int(item.get(f"rnk{rank}SumWnAmt"), 0)),
            "winner_count": max(0, _as_int(item.get(f"rnk{rank}WnNope"), 0)),
            "prize_per_winner": max(0, _as_int(item.get(f"rnk{rank}WnAmt"), 0)),
            "criteria": criteria.get(rank, ""),
            "remark": remark if rank == 1 else "",
        }
        rows.append(row)
    return rows


def _normalize_draw_history_item(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(item, dict):
        return None

    try:
        numbers = [
            _as_int(item.get("tm1WnNo")),
            _as_int(item.get("tm2WnNo")),
            _as_int(item.get("tm3WnNo")),
            _as_int(item.get("tm4WnNo")),
            _as_int(item.get("tm5WnNo")),
            _as_int(item.get("tm6WnNo")),
        ]
        if any(n <= 0 for n in numbers):
            return None

        return {
            "round": _as_int(item.get("ltEpsd")),
            "draw_date": _normalize_draw_date_yyyymmdd(item.get("ltRflYmd")),
            "numbers": numbers,
            "bonus": _as_int(item.get("bnsWnNo")),
            "winner_summary": {
                "total_sales_amount": max(0, _as_int(item.get("wholEpsdSumNtslAmt"), 0)),
                "total_winner_count": max(0, _as_int(item.get("sumWnNope"), 0)),
                "first_auto": max(0, _as_int(item.get("winType1"), 0)),
                "first_manual": max(0, _as_int(item.get("winType2"), 0)),
                "first_semi_auto": max(0, _as_int(item.get("winType3"), 0)),
            },
            "ranks": _build_draw_rank_rows(item),
        }
    except Exception:
        return None


def _fetch_draw_history_items(client: Optional[Any] = None) -> List[Dict[str, Any]]:
    payload = _request_json_endpoint(
        "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do",
        client=client,
        params={"srchLtEpsd": "all"},
        referer="https://www.dhlottery.co.kr/lt645/result",
    )
    if not payload:
        return []

    raw_items = payload.get("data", {}).get("list", [])
    if not isinstance(raw_items, list):
        return []

    normalized_items = []
    for raw in raw_items:
        normalized = _normalize_draw_history_item(raw)
        if normalized and normalized.get("round", 0) > 0:
            normalized_items.append(normalized)

    normalized_items.sort(key=lambda row: row.get("round", 0), reverse=True)
    return normalized_items


def _fetch_recent_draws(client: Optional[Any] = None, limit: int = 30) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(int(limit or 30), 200))

    cached_at = _draw_history_cache.get("fetched_at")
    cached_items = _draw_history_cache.get("items") or []
    if (
        isinstance(cached_at, datetime)
        and isinstance(cached_items, list)
        and cached_items
        and (datetime.now() - cached_at).total_seconds() < 300
    ):
        return cached_items[:safe_limit]

    items = _fetch_draw_history_items(client=client)
    if items:
        _draw_history_cache["fetched_at"] = datetime.now()
        _draw_history_cache["items"] = items
        return items[:safe_limit]

    if isinstance(cached_items, list) and cached_items:
        return cached_items[:safe_limit]

    raise RuntimeError("회차별 당첨번호를 가져오지 못했습니다.")


def _try_fetch_latest_draw_from_result_page(client: Optional[Any] = None) -> Optional[Dict[str, Any]]:
    try:
        recent = _fetch_recent_draws(client=client, limit=1)
        return recent[0] if recent else None
    except RuntimeError:
        return None


def _fetch_last_draw_info(client: Optional[Any] = None) -> Dict[str, Any]:
    cached_at = _last_draw_cache.get("fetched_at")
    cached_data = _last_draw_cache.get("data")
    if isinstance(cached_at, datetime) and cached_data and (datetime.now() - cached_at).total_seconds() < 60:
        return cached_data

    latest_draw = _try_fetch_latest_draw_from_result_page(client=client)
    if latest_draw:
        _last_draw_cache["fetched_at"] = datetime.now()
        _last_draw_cache["data"] = latest_draw
        return latest_draw

    start_round = _current_selling_round() - 1
    if start_round < 1:
        raise RuntimeError("회차 계산에 실패했습니다.")

    for round_no in range(start_round, max(0, start_round - 20), -1):
        try:
            payload = _request_lotto_number_payload(round_no, client=client)
            if not payload:
                continue
            if payload.get("returnValue") != "success":
                continue

            data = {
                "round": int(payload.get("drwNo")),
                "draw_date": payload.get("drwNoDate"),
                "numbers": [
                    int(payload.get("drwtNo1")),
                    int(payload.get("drwtNo2")),
                    int(payload.get("drwtNo3")),
                    int(payload.get("drwtNo4")),
                    int(payload.get("drwtNo5")),
                    int(payload.get("drwtNo6")),
                ],
                "bonus": int(payload.get("bnusNo")),
            }
            _last_draw_cache["fetched_at"] = datetime.now()
            _last_draw_cache["data"] = data
            return data
        except (ValueError, TypeError):
            continue

    raise RuntimeError("직전 회차 번호를 가져오지 못했습니다.")


_init_app_db()


# API 엔드포인트
@app.post("/api/login")
async def login(request: LoginRequest, response: Response):
    """로그인"""
    result = APIWrapper.login(request.username, request.password)
    
    if not result["success"]:
        raise HTTPException(status_code=401, detail=result["message"])
    
    # 세션 생성
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "client": result["client"],
        "endpoint": result["endpoint"],
        "username": request.username,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(hours=24)
    }
    
    # 쿠키에 세션 ID 설정
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        max_age=86400,  # 24시간
        samesite="lax"
    )
    
    return {
        "success": True,
        "message": "로그인 성공",
        "session_id": session_id,
        "username": request.username
    }


@app.post("/api/logout")
async def logout(request: Request, response: Response):
    """로그아웃"""
    session_id = request.cookies.get("session_id")
    
    if session_id and session_id in sessions:
        del sessions[session_id]
    
    response.delete_cookie("session_id")
    
    return {"success": True, "message": "로그아웃 되었습니다."}


@app.get("/api/session")
async def check_session(request: Request):
    """세션 확인"""
    session_id = request.cookies.get("session_id")
    
    if not session_id or session_id not in sessions:
        return {"authenticated": False}
    
    session = sessions[session_id]
    
    # 세션 만료 확인
    if datetime.now() > session["expires_at"]:
        del sessions[session_id]
        return {"authenticated": False}
    
    return {
        "authenticated": True,
        "username": session["username"]
    }


@app.post("/api/buy-lotto645")
async def buy_lotto645(request: BuyLottoRequest, req: Request):
    """로또6/45 구매"""
    session_id = req.cookies.get("session_id")
    session = get_session(session_id)
    
    # 티켓 데이터 변환
    tickets_data = [{"numbers": ticket.numbers} for ticket in request.tickets]
    
    result = APIWrapper.buy_lotto645(
        session["client"],
        session["endpoint"],
        tickets_data
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@app.get("/api/balance")
async def get_balance(request: Request):
    """예치금 현황 조회"""
    session_id = request.cookies.get("session_id")
    session = get_session(session_id)
    
    result = APIWrapper.show_balance(
        session["client"],
        session["endpoint"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@app.post("/api/buy-list")
async def get_buy_list(request: BuyListRequest, req: Request):
    """구매 내역 조회"""
    session_id = req.cookies.get("session_id")
    session = get_session(session_id)
    
    result = APIWrapper.show_buy_list(
        session["client"],
        session["endpoint"],
        request.start_date,
        request.end_date
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@app.get("/api/weekly-purchase-limit")
async def get_weekly_purchase_limit(request: Request):
    """이번주(월~일) 온라인 구매 한도 대비 잔여 금액 조회"""
    session_id = request.cookies.get("session_id")
    session = get_session(session_id)

    start_yyyymmdd, end_yyyymmdd, week_start, week_end = _current_week_range_yyyymmdd()
    result = APIWrapper.show_buy_list(
        session["client"],
        session["endpoint"],
        start_yyyymmdd,
        end_yyyymmdd,
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    week_purchased_amount = _compute_weekly_spent_from_buy_list(result.get("data"))
    week_remaining_amount = max(0, WEEKLY_ONLINE_LIMIT_KRW - week_purchased_amount)

    return {
        "success": True,
        "week_start": week_start,
        "week_end": week_end,
        "weekly_limit_amount": WEEKLY_ONLINE_LIMIT_KRW,
        "week_purchased_amount": week_purchased_amount,
        "week_remaining_amount": week_remaining_amount,
    }


@app.post("/api/assign-virtual-account")
async def assign_virtual_account(request: VirtualAccountRequest, req: Request):
    """가상계좌 할당"""
    session_id = req.cookies.get("session_id")
    session = get_session(session_id)
    
    result = APIWrapper.assign_virtual_account(
        session["client"],
        session["endpoint"],
        request.amount
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    account_number = result.get("account")
    if not is_valid_virtual_account_number(account_number):
        raise HTTPException(
            status_code=400,
            detail=f"유효한 가상계좌 번호를 확인하지 못했습니다. (account: {account_number})",
        )

    username = session["username"]
    assigned_at = datetime.now().isoformat(timespec="seconds")
    saved_result = {
        "username": username,
        "account": result.get("account"),
        "amount": result.get("amount"),
        "bank_name": result.get("bank_name"),
        "account_holder": result.get("account_holder"),
        "assigned_at": assigned_at,
    }
    virtual_accounts_by_user[username] = saved_result

    return {
        "success": True,
        **saved_result,
    }


@app.get("/api/virtual-account")
async def get_virtual_account(request: Request):
    """현재 로그인 사용자의 가상계좌 조회"""
    session_id = request.cookies.get("session_id")
    session = get_session(session_id)

    username = session["username"]
    account_info = virtual_accounts_by_user.get(username)

    return {
        "success": True,
        "username": username,
        "has_account": account_info is not None,
        "virtual_account": account_info,
    }


@app.get("/api/my-lotto-numbers")
async def get_my_lotto_numbers(request: Request):
    """현재 로그인 사용자 기준 저장한 지정번호 목록 조회"""
    session_id = request.cookies.get("session_id")
    session = get_session(session_id)
    username = session["username"]

    items = _list_my_lotto_numbers(username)
    return {
        "success": True,
        "items": items,
        "count": len(items),
    }


@app.post("/api/my-lotto-numbers")
async def save_my_lotto_numbers(payload: MyLottoNumberRequest, request: Request):
    """지정번호 1세트를 사용자별로 저장"""
    session_id = request.cookies.get("session_id")
    session = get_session(session_id)
    username = session["username"]

    try:
        item = _insert_my_lotto_numbers(username, payload.numbers, payload.name)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {
        "success": True,
        "item": item,
    }


@app.delete("/api/my-lotto-numbers/{number_id}")
async def delete_my_lotto_numbers(number_id: int, request: Request):
    """지정번호 삭제"""
    session_id = request.cookies.get("session_id")
    session = get_session(session_id)
    username = session["username"]

    deleted = _delete_my_lotto_numbers(username, number_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="삭제할 번호를 찾지 못했습니다.")

    return {"success": True}


@app.get("/api/lotto-draws")
async def get_lotto_draws(request: Request, limit: int = 30):
    """최근 회차 당첨번호/당첨금 정보를 최신순으로 조회"""
    session_id = request.cookies.get("session_id")
    session = get_session(session_id)

    try:
        items = _fetch_recent_draws(client=session.get("client"), limit=limit)
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return {
        "success": True,
        "count": len(items),
        "items": items,
    }


@app.get("/api/last-draw")
async def get_last_draw(request: Request):
    """직전 회차 당첨번호 조회"""
    session_id = request.cookies.get("session_id")
    session = get_session(session_id)

    try:
        draw = _fetch_last_draw_info(client=session.get("client"))
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return {
        "success": True,
        "draw": draw,
    }


@app.post("/api/ai-recommend")
async def recommend_numbers(request: Request):
    """AI 로또 번호 추천"""
    # 세션 확인 (로그인 필요)
    session_id = request.cookies.get("session_id")
    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    
    try:
        # 1게임 추천
        recommendations = ai_service.recommend_numbers(count=1)
        return {"success": True, "numbers": recommendations[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 분석 중 오류 발생: {str(e)}")


@app.post("/api/random-numbers")
async def random_numbers(request: Request):
    """완전 랜덤 번호 생성 (자동발급)"""
    try:
        games = ai_service.generate_random_games(count=1)
        return {"success": True, "numbers": games[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR)), name="assets")

@app.get("/")
async def serve_index():
    """메인 페이지"""
    return FileResponse(str(FRONTEND_DIR / "index.html"))


def get_lan_ipv4_addresses() -> List[str]:
    """LAN에서 접속 가능한 IPv4 주소 후보를 반환"""
    ips = set()

    try:
        host_name = socket.gethostname()
        for info in socket.getaddrinfo(host_name, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127."):
                ips.add(ip)
    except OSError:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith("127."):
                ips.add(ip)
    except OSError:
        pass

    def ip_priority(ip: str) -> tuple:
        if ip.startswith("192.168."):
            return (0, ip)
        if ip.startswith("10."):
            return (1, ip)
        if ip.startswith("172."):
            return (2, ip)
        return (3, ip)

    return sorted(ips, key=ip_priority)


# 서버 실행
if __name__ == "__main__":
    import uvicorn
    host = os.getenv("WEB_HOST", os.getenv("HOST", "0.0.0.0"))
    port = int(os.getenv("WEB_PORT", os.getenv("PORT", "8001")))

    print("동행복권 웹 서버 시작...")
    if host in ("0.0.0.0", "::"):
        print(f"로컬 접속: http://localhost:{port}")
        for ip in get_lan_ipv4_addresses():
            print(f"내부망 접속: http://{ip}:{port}")
    else:
        print(f"서버 주소: http://{host}:{port}")
    print("내부망 접속이 안 되면 Windows 방화벽에서 해당 TCP 포트를 허용하세요.")

    uvicorn.run(app, host=host, port=port)
