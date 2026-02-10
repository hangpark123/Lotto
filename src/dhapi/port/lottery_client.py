import datetime
import json
import logging
import random
import re
import time
from pathlib import Path
from typing import List, Dict
from urllib.parse import urlsplit, urljoin

import pytz
import requests
from bs4 import BeautifulSoup
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5

from dhapi.domain.deposit import Deposit
from dhapi.domain.lotto645_ticket import Lotto645Ticket, Lotto645Mode
from dhapi.domain.user import User

logger = logging.getLogger(__name__)


class LotteryClient:
    _base_url = "https://www.dhlottery.co.kr"
    _login_page = "/login"
    _rsa_key_url = "/login/selectRsaModulus.do"
    _login_url = "/login/securityLoginCheck.do"
    _buy_lotto645_url = "https://ol.dhlottery.co.kr/olotto/game/execBuy.do"
    _ready_socket = "https://ol.dhlottery.co.kr/olotto/game/egovUserReadySocket.json"
    _game645_page = "https://ol.dhlottery.co.kr/olotto/game/game645.do"
    _cash_balance = "https://www.dhlottery.co.kr/mypage/home"
    _user_mndp_url = "https://www.dhlottery.co.kr/mypage/selectUserMndp.do"
    _mndp_charge_page = "https://www.dhlottery.co.kr/mypage/mndpChrg"
    _assign_virtual_account_1 = "https://www.dhlottery.co.kr/kbank.do?method=kbankInit"
    _assign_virtual_account_2 = "https://www.dhlottery.co.kr/kbank.do?method=kbankProcess"
    _tracer_domain = "tracer.dhlottery.co.kr"
    _tracer_check_bot = "https://{domain}:48081/TRACERAPI/checkBotIp.do"
    _tracer_input_queue = "https://{domain}:48081/TRACERAPI/inputQueue.do"
    _lotto_buy_list_url = "https://www.dhlottery.co.kr/mypage/selectMyLotteryledger.do"
    _DETAIL_REQUEST_DELAY = 0.5
    _BANK_CODE_TO_NAME = {
        "004": "국민은행",
        "011": "농협은행",
        "020": "우리은행",
        "023": "SC제일은행",
        "031": "대구은행",
        "032": "부산은행",
        "034": "광주은행",
        "035": "제주은행",
        "037": "전북은행",
        "039": "경남은행",
        "071": "우체국",
        "081": "하나은행",
        "088": "신한은행",
        "089": "케이뱅크",
        "090": "카카오뱅크",
    }

    def __init__(self, user_profile: User, lottery_endpoint):
        self._user_id = user_profile.username
        self._user_pw = user_profile.password
        self._lottery_endpoint = lottery_endpoint

        self._session = requests.Session()
        self._session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                "Connection": "keep-alive",
                "Cache-Control": "max-age=0",
                "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"macOS"',
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-User": "?1",
                "Sec-Fetch-Dest": "document",
            }
        )

        self._login()

    def _rsa_encrypt(self, plain_text, modulus_hex, exponent_hex):
        n = int(modulus_hex, 16)
        e = int(exponent_hex, 16)
        key = RSA.construct((n, e))
        cipher = PKCS1_v1_5.new(key)
        encrypted = cipher.encrypt(plain_text.encode("utf-8"))
        return encrypted.hex()

    def _login(self):
        resp = self._session.get(f"{self._base_url}/", timeout=10)
        logger.debug(f"Initial session status: {resp.status_code}")

        if "index_check.html" in resp.url:
            raise RuntimeError("동행복권 사이트가 현재 시스템 점검중입니다.")

        resp = self._session.get(f"{self._base_url}{self._login_page}", timeout=10)
        logger.debug(f"Login page status: {resp.status_code}")

        # RSA 공개키 요청
        rsa_headers = {"Accept": "application/json", "X-Requested-With": "XMLHttpRequest", "Referer": f"{self._base_url}{self._login_page}"}
        resp = self._session.get(f"{self._base_url}{self._rsa_key_url}", headers=rsa_headers, timeout=10)
        rsa_data = resp.json()

        if "data" not in rsa_data:
            raise RuntimeError("RSA 키를 가져올 수 없습니다.")

        rsa_modulus = rsa_data["data"]["rsaModulus"]
        rsa_exponent = rsa_data["data"]["publicExponent"]
        logger.debug(f"RSA key received, modulus length: {len(rsa_modulus)}")

        # 아이디/비밀번호 암호화 및 로그인
        encrypted_user_id = self._rsa_encrypt(self._user_id, rsa_modulus, rsa_exponent)
        encrypted_password = self._rsa_encrypt(self._user_pw, rsa_modulus, rsa_exponent)

        login_headers = {"Content-Type": "application/x-www-form-urlencoded", "Origin": self._base_url, "Referer": f"{self._base_url}{self._login_page}"}
        login_data = {"userId": encrypted_user_id, "userPswdEncn": encrypted_password, "inpUserId": self._user_id}

        resp = self._session.post(f"{self._base_url}{self._login_url}", headers=login_headers, data=login_data, timeout=10, allow_redirects=True)
        logger.debug(f"Login response status: {resp.status_code}, URL: {resp.url}")

        if resp.status_code != 200 or "loginSuccess" not in resp.url:
            soup = BeautifulSoup(resp.text, "html5lib")
            error_button = soup.find("a", {"class": "btn_common"})
            if error_button:
                raise RuntimeError("로그인에 실패했습니다. 아이디 또는 비밀번호를 확인해주세요.")
            raise RuntimeError(f"로그인에 실패했습니다. (Status: {resp.status_code}, URL: {resp.url})")

        logger.debug("로그인 성공")

        # 구매 도메인(ol.dhlottery.co.kr)에 접속하여 JSESSIONID 획득
        resp = self._session.get(f"{self._base_url}/main", timeout=10)
        logger.debug(f"Main page status: {resp.status_code}")

        resp = self._session.get(self._game645_page, timeout=10, allow_redirects=True)
        logger.debug(f"ol.dhlottery.co.kr visit status: {resp.status_code}")

        for cookie in self._session.cookies:
            logger.debug(f"Cookie: {cookie.name} = {cookie.value[:20]}... (domain: {cookie.domain})")

        if not any(c.name == "JSESSIONID" for c in self._session.cookies):
            logger.warning("JSESSIONID was not acquired from ol.dhlottery.co.kr")

    def _get_round(self):
        """
        로또645 현재 판매 중인 회차를 계산

        로또645는 2002년 12월 7일(토요일)부터 매주 토요일마다 추첨.
        1회부터 현재까지 경과한 주 수를 계산하여 회차를 반환.

        Returns:
            int: 현재 판매 중인 회차 번호
        """
        first_round_date = datetime.date(2002, 12, 7)
        korea_tz = pytz.timezone("Asia/Seoul")
        now = datetime.datetime.now(korea_tz)
        today = now.date()

        current_weekday = today.weekday()
        days_until_saturday = (5 - current_weekday) % 7
        this_saturday = today + datetime.timedelta(days=days_until_saturday)

        days_diff = (this_saturday - first_round_date).days
        weeks_passed = days_diff // 7
        round_number = 1 + weeks_passed

        logger.debug(f"Calculated round: {round_number} (today: {today}, this_saturday: {this_saturday})")
        return round_number

    def _calculate_draw_dates(self):
        korea_tz = pytz.timezone("Asia/Seoul")
        now = datetime.datetime.now(korea_tz)
        today = now.date()
        current_weekday = today.weekday()
        days_until_saturday = (5 - current_weekday) % 7
        draw_date = today + datetime.timedelta(days=days_until_saturday)
        pay_limit_date = draw_date + datetime.timedelta(days=365)
        return draw_date, pay_limit_date

    def buy_lotto645(self, tickets: List[Lotto645Ticket]):
        try:
            res = self._session.post(url=self._ready_socket, timeout=5)
            direct = json.loads(res.text)["ready_ip"]

            round_number = self._get_round()
            draw_date, pay_limit_date = self._calculate_draw_dates()

            data = {
                "round": str(round_number),
                "direct": direct,
                "nBuyAmount": str(1000 * len(tickets)),
                "param": self._make_buy_loyyo645_param(tickets),
                "ROUND_DRAW_DATE": draw_date.strftime("%Y/%m/%d"),
                "WAMT_PAY_TLMT_END_DT": pay_limit_date.strftime("%Y/%m/%d"),
                "gameCnt": len(tickets),
                "saleMdaDcd": "10",
            }
            logger.debug(f"data: {data}")

            buy_headers = {"Referer": self._game645_page, "Origin": "https://ol.dhlottery.co.kr"}

            resp = self._session.post(self._buy_lotto645_url, headers=buy_headers, data=data, timeout=10)

            response_text = resp.text
            logger.debug(f"response: {response_text}")

            response = json.loads(response_text)
            if not self._is_purchase_success(response):
                raise RuntimeError(f"❗ 로또6/45 구매에 실패했습니다. (사유: {response['result']['resultMsg']})")

            slots = self._format_lotto_numbers(response["result"]["arrGameChoiceNum"])
            self._lottery_endpoint.print_result_of_buy_lotto645(slots)
        except RuntimeError as e:
            raise e
        except Exception:
            raise RuntimeError("❗ 로또6/45 구매에 실패했습니다. (사유: 알 수 없는 오류)")

    def _is_purchase_success(self, response):
        return response["result"]["resultCode"] == "100"

    def _make_buy_loyyo645_param(self, tickets: List[Lotto645Ticket]):
        params = []
        for i, t in enumerate(tickets):
            if t.mode == Lotto645Mode.AUTO:
                gen_type = "0"
            elif t.mode == Lotto645Mode.MANUAL:
                gen_type = "1"
            elif t.mode == Lotto645Mode.SEMIAUTO:
                gen_type = "2"
            else:
                raise RuntimeError(f"올바르지 않은 모드입니다. (mode: {t.mode})")
            arr_game_choice_num = None if t.mode == Lotto645Mode.AUTO else ",".join(map(str, t.numbers))
            alpabet = "ABCDE"[i]  # XXX: 오타 아님
            slot = {
                "genType": gen_type,
                "arrGameChoiceNum": arr_game_choice_num,
                "alpabet": alpabet,
            }
            params.append(slot)
        return json.dumps(params)

    def _format_lotto_numbers(self, lines: list) -> List[Dict]:
        """
        example: ["A|01|02|04|27|39|443", "B|11|23|25|27|28|452"]
        """

        mode_dict = {
            "1": "수동",
            "2": "반자동",
            "3": "자동",
        }

        slots = []
        for line in lines:
            slot = {
                "mode": mode_dict[line[-1]],
                "slot": line[0],
                "numbers": line[2:-1].split("|"),
            }
            slots.append(slot)
        return slots

    def show_balance(self):
        try:
            headers = {
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": self._cash_balance,
            }

            # 예치금 정보 조회 (JSON API)
            resp = self._session.get(self._user_mndp_url, headers=headers, timeout=10)
            if resp.status_code != 200 or "json" not in resp.headers.get("Content-Type", "").lower():
                raise RuntimeError("예치금 API 응답 오류")

            data = resp.json()
            user_mndp = data.get("data", {}).get("userMndp", {})

            # 총예치금 계산 (웹사이트 JS 로직과 동일)
            총예치금 = (
                ((user_mndp.get("pntDpstAmt", 0) or 0) - (user_mndp.get("pntTkmnyAmt", 0) or 0))
                + ((user_mndp.get("ncsblDpstAmt", 0) or 0) - (user_mndp.get("ncsblTkmnyAmt", 0) or 0))
                + ((user_mndp.get("csblDpstAmt", 0) or 0) - (user_mndp.get("csblTkmnyAmt", 0) or 0))
            )
            구매가능금액 = user_mndp.get("crntEntrsAmt", 0) or 0
            예약구매금액 = user_mndp.get("rsvtOrdrAmt", 0) or 0
            출금신청중금액 = user_mndp.get("dawAplyAmt", 0) or 0
            구매불가능금액 = 예약구매금액 + 출금신청중금액 + (user_mndp.get("feeAmt", 0) or 0)

            # 최근 1달 누적 구매금액 조회
            최근1달누적구매금액 = 0
            resp2 = self._session.get("https://www.dhlottery.co.kr/mypage/selectMyHomeInfo.do", headers=headers, timeout=10)
            if resp2.status_code == 200 and "json" in resp2.headers.get("Content-Type", "").lower():
                최근1달누적구매금액 = resp2.json().get("data", {}).get("mnthPrchsAmt", 0)

            self._lottery_endpoint.print_result_of_show_balance(
                총예치금=총예치금,
                구매가능금액=구매가능금액,
                예약구매금액=예약구매금액,
                출금신청중금액=출금신청중금액,
                구매불가능금액=구매불가능금액,
                최근1달누적구매금액=최근1달누적구매금액,
            )

        except Exception:
            raise RuntimeError("❗ 예치금 현황을 조회하지 못했습니다.")

    def show_buy_list(self, output_format="table", start_date=None, end_date=None):
        try:
            start_dt, end_dt = self._calculate_date_range(start_date, end_date)

            params = {
                "srchStrDt": start_dt.strftime("%Y%m%d"),
                "srchEndDt": end_dt.strftime("%Y%m%d"),
                "pageNum": 1,
                "recordCountPerPage": 100,
                "_": int(datetime.datetime.now().timestamp() * 1000),
            }

            headers = {
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://www.dhlottery.co.kr/mypage/mylotteryledger",
            }

            self._session.get("https://www.dhlottery.co.kr/mypage/mylotteryledger", timeout=10)

            resp = self._session.get(self._lotto_buy_list_url, params=params, headers=headers, timeout=10)

            if resp.status_code != 200:
                logger.error(f"API 요청 실패: {resp.status_code}")
                raise RuntimeError(f"구매 내역 조회 API 요청 실패 (Status: {resp.status_code})")

            content_type = resp.headers.get("Content-Type", "")
            if "application/json" not in content_type:
                logger.error(f"JSON이 아닌 응답: {content_type}, URL: {resp.url}")
                raise RuntimeError("구매 내역 조회 API가 JSON을 반환하지 않았습니다. 세션이 만료되었을 수 있습니다.")

            data = resp.json()

            found_data = self._parse_buy_list_json(data)

            self._lottery_endpoint.print_result_of_show_buy_list(found_data, output_format, start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d"))

        except Exception as e:
            logger.error(e)
            raise RuntimeError("❗ 구매 내역을 조회하지 못했습니다.")

    def _calculate_date_range(self, start_date, end_date):
        today = datetime.date.today()

        if start_date:
            start_dt = datetime.datetime.strptime(start_date, "%Y%m%d").date()
        else:
            start_dt = today - datetime.timedelta(days=14)

        if end_date:
            end_dt = datetime.datetime.strptime(end_date, "%Y%m%d").date()
        else:
            end_dt = today
        return start_dt, end_dt

    def _parse_buy_list_json(self, response_data):  # pylint: disable=too-many-locals
        if not response_data or "data" not in response_data:
            return []

        data = response_data.get("data", {})
        items = data.get("list", [])

        if not items:
            return []

        headers = ["구입일자", "복권명", "회차", "선택번호/복권번호", "구입매수", "당첨결과", "당첨금", "추첨일"]
        rows = []

        for item in items:
            purchase_date = item.get("eltOrdrDt", "")
            lottery_name = item.get("ltGdsNm", "")
            round_no = item.get("ltEpsdView", "")
            gm_info = item.get("gmInfo", "")
            quantity = str(item.get("prchsQty", ""))
            win_result = item.get("ltWnResult", "")
            ntsl_ordr_no = item.get("ntslOrdrNo", "")
            win_amt = item.get("ltWnAmt", 0) or 0
            draw_date = item.get("epsdRflDt", "")

            win_amt_str = f"{win_amt:,}원" if win_amt > 0 else "-"

            if gm_info and lottery_name == "로또6/45" and ntsl_ordr_no:
                numbers = self._get_lotto645_ticket_detail(ntsl_ordr_no, gm_info, purchase_date)
                time.sleep(self._DETAIL_REQUEST_DELAY)
            else:
                numbers = gm_info

            rows.append([purchase_date, lottery_name, round_no, numbers, quantity, win_result, win_amt_str, draw_date])

        return [{"headers": headers, "rows": rows}]

    def _get_lotto645_ticket_detail(self, ntsl_ordr_no, barcode, purchase_date):  # pylint: disable=too-many-locals
        """로또645 티켓 상세 정보 조회

        Args:
            ntsl_ordr_no: 주문번호
            barcode: 바코드 (gmInfo)
            purchase_date: 구매일 (YYYY-MM-DD)

        Returns:
            str: 포맷팅된 번호 정보
        """
        try:
            purchase_dt = datetime.datetime.strptime(purchase_date, "%Y-%m-%d").date()
            start_date = (purchase_dt - datetime.timedelta(days=7)).strftime("%Y%m%d")
            end_date = (purchase_dt + datetime.timedelta(days=7)).strftime("%Y%m%d")

            url = "https://www.dhlottery.co.kr/mypage/lotto645TicketDetail.do"
            params = {"ntslOrdrNo": ntsl_ordr_no, "srchStrDt": start_date, "srchEndDt": end_date, "barcd": barcode}

            resp = self._session.get(url, params=params, timeout=10)
            data = resp.json()

            if not data.get("data", {}).get("success"):
                return "조회 실패"

            ticket = data["data"]["ticket"]
            game_dtl = ticket.get("game_dtl", [])

            if not game_dtl:
                return "번호 정보 없음"

            type_map = {1: "수동", 2: "반자동", 3: "자동"}

            result = []
            for game in game_dtl:
                idx = game.get("idx", "")
                numbers = game.get("num", [])
                game_type = type_map.get(game.get("type", 3), "자동")

                if numbers:
                    numbers_str = " ".join(str(n) for n in numbers)
                    result.append(f"[{idx}] {game_type}: {numbers_str}")

            return "\n".join(result) if result else "번호 확인 불가"

        except Exception as e:
            logger.error(f"로또 상세 정보 조회 실패: {e}")
            return "조회 실패"

    def _parse_digit(self, text):
        return int("".join(filter(str.isdigit, text)))

    def _format_won_text(self, value):
        digits = "".join(filter(str.isdigit, str(value)))
        if not digits:
            return str(value)
        return f"{int(digits):,}원"

    def _save_debug_html(self, file_name, html_text):
        try:
            root_dir = Path(__file__).resolve().parents[3]
            debug_dir = root_dir / "tmp_debug"
            debug_dir.mkdir(parents=True, exist_ok=True)
            (debug_dir / file_name).write_text(html_text, encoding="utf-8")
        except Exception as error:
            logger.debug(f"failed to save debug html ({file_name}): {type(error).__name__}: {error}")

    def _save_debug_json(self, file_name, payload):
        try:
            root_dir = Path(__file__).resolve().parents[3]
            debug_dir = root_dir / "tmp_debug"
            debug_dir.mkdir(parents=True, exist_ok=True)
            (debug_dir / file_name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as error:
            logger.debug(f"failed to save debug json ({file_name}): {type(error).__name__}: {error}")

    def _bank_name_from_code(self, bank_code):
        if bank_code is None:
            return None
        return self._BANK_CODE_TO_NAME.get(str(bank_code).zfill(3))

    def _pick_first(self, data, *keys, default=""):
        for key in keys:
            value = data.get(key)
            if value not in (None, ""):
                return value
        return default

    def _normalize_account_candidate(self, raw):
        if raw is None:
            return ""
        value = str(raw).strip().replace(" ", "")
        value = re.sub(r"[^0-9\-]", "", value)
        value = re.sub(r"-{2,}", "-", value).strip("-")
        return value

    def _is_valid_virtual_account_candidate(self, candidate):
        if not candidate:
            return False
        value = self._normalize_account_candidate(candidate)
        if not re.fullmatch(r"[0-9][0-9\-]*[0-9]", value):
            return False

        digits = re.sub(r"\D", "", value)
        if len(digits) < 10 or len(digits) > 16:
            return False

        # 대표 고객센터/ARS 번호 패턴 차단 (예: 1588-6450)
        if re.fullmatch(r"1[5-9][0-9]{2}-?[0-9]{4}", value):
            return False
        if value in {"1588-6450"}:
            return False

        # 일반 전화/팩스 번호 패턴 차단
        # 예: 02-6933-3063, 031-123-4567, 010-1234-5678
        phone_like_pattern = r"0\d{1,2}-(?:\d{3,4})-\d{4}"
        if re.fullmatch(phone_like_pattern, value):
            return False

        return True

    def _find_account_in_mapping(self, data):
        if not isinstance(data, dict):
            return ""

        # 우선순위가 높은 키부터 확인
        for key in (
            "FxVrAccountNo",
            "VbankNum",
            "vbankNum",
            "AccountNo",
            "accountNo",
            "actNo",
            "ActNo",
            "vactNo",
            "VactNo",
            "fxdVactNo",
            "FxdVactNo",
        ):
            candidate = self._normalize_account_candidate(data.get(key, ""))
            if self._is_valid_virtual_account_candidate(candidate):
                return candidate

        # 기타 키 중 계좌번호로 보이는 값 탐색
        for key, value in data.items():
            key_l = str(key).lower()
            if not any(token in key_l for token in ("account", "vbank", "vr", "actno", "vact", "acct", "fxvr")) and "계좌" not in str(key):
                continue
            candidate = self._normalize_account_candidate(value)
            if self._is_valid_virtual_account_candidate(candidate):
                return candidate

        return ""

    def _extract_hidden_inputs_from_html(self, html_text):
        soup = BeautifulSoup(html_text, "html5lib")
        fields = {}
        for elem in soup.select("input[name]"):
            name = elem.get("name")
            if not name:
                continue
            if name not in fields:
                fields[name] = elem.get("value", "")
        return fields

    def _extract_virtual_account_from_html(self, html_text):
        soup = BeautifulSoup(html_text, "html5lib")
        account_number = None
        amount_text = None
        bank_name = None

        contents = soup.select_one("#contents")
        if contents is not None:
            account_elem = contents.select_one("span")
            amount_elem = contents.select_one(".color_key1")
            if account_elem is not None:
                candidate = self._normalize_account_candidate(account_elem.get_text(strip=True))
                if self._is_valid_virtual_account_candidate(candidate):
                    account_number = candidate
            if amount_elem is not None:
                amount_text = amount_elem.get_text(strip=True)

        plain_text = soup.get_text(" ", strip=True)

        # 계좌 키워드 주변 숫자만 추출 (전역 숫자 탐색 금지)
        if not account_number:
            keyword_patterns = [
                # 예: 고정 가상계좌 [케이뱅크] 701-9005-915-9906
                r"(?:고정\s*가상계좌|전용\s*가상계좌|가상계좌|입금계좌|계좌번호)\s*(?:\[\s*([^\]\[]+)\s*\])?\s*[:：]?\s*([0-9][0-9\- ]{8,30}[0-9])",
                r"([0-9][0-9\- ]{8,30}[0-9])\s*(?:고정\s*가상계좌|전용\s*가상계좌|가상계좌|입금계좌|계좌번호)",
            ]
            for pattern in keyword_patterns:
                match = re.search(pattern, plain_text)
                if match:
                    if match.lastindex and match.lastindex >= 2:
                        matched_bank = (match.group(1) or "").strip()
                        raw_account = match.group(2)
                    else:
                        matched_bank = ""
                        raw_account = match.group(1)

                    normalized = self._normalize_account_candidate(raw_account)
                    if self._is_valid_virtual_account_candidate(normalized):
                        account_number = normalized
                        if matched_bank and not bank_name:
                            bank_name = matched_bank
                        break

        if not amount_text:
            amount_match = re.search(r"[0-9][0-9,]{2,15}\s*원", plain_text)
            if amount_match:
                amount_text = amount_match.group(0).replace(" ", "")

        if not account_number:
            bracket_bank_account = re.search(
                r"\[\s*(케이뱅크|카카오뱅크|국민은행|신한은행|우리은행|하나은행|기업은행|농협은행|부산은행|경남은행|대구은행|광주은행|전북은행|제주은행|SC제일은행|우체국)\s*\]\s*([0-9][0-9\- ]{8,30}[0-9])",
                plain_text,
            )
            if bracket_bank_account:
                normalized = self._normalize_account_candidate(bracket_bank_account.group(2))
                if self._is_valid_virtual_account_candidate(normalized):
                    account_number = normalized
                    bank_name = bracket_bank_account.group(1)

        if not account_number:
            bank_then_account = re.search(
                r"(케이뱅크|카카오뱅크|국민은행|신한은행|우리은행|하나은행|기업은행|농협은행|부산은행|경남은행|대구은행|광주은행|전북은행|제주은행|SC제일은행|우체국)\s*[\]\)\:\-]?\s*([0-9][0-9\- ]{8,30}[0-9])",
                plain_text,
            )
            if bank_then_account:
                normalized = self._normalize_account_candidate(bank_then_account.group(2))
                if self._is_valid_virtual_account_candidate(normalized):
                    account_number = normalized
                    bank_name = bank_then_account.group(1)

        # 스크립트 문자열/속성값 안에 계좌가 있는 경우를 대비한 raw HTML fallback
        if not account_number:
            raw_bank_account = re.search(
                r"(케이뱅크|카카오뱅크|국민은행|신한은행|우리은행|하나은행|기업은행|농협은행|부산은행|경남은행|대구은행|광주은행|전북은행|제주은행|SC제일은행|우체국)[^0-9]{0,80}([0-9]{3}-[0-9]{4}-[0-9]{3}-[0-9]{4})",
                html_text,
            )
            if raw_bank_account:
                normalized = self._normalize_account_candidate(raw_bank_account.group(2))
                if self._is_valid_virtual_account_candidate(normalized):
                    account_number = normalized
                    bank_name = raw_bank_account.group(1)

        bank_match = re.search(
            r"(케이뱅크|카카오뱅크|국민은행|신한은행|우리은행|하나은행|기업은행|농협은행|부산은행|경남은행|대구은행|광주은행|전북은행|제주은행|SC제일은행|우체국)",
            plain_text,
        )
        if bank_match:
            bank_name = bank_match.group(1)

        return account_number, amount_text, bank_name

    def _extract_account_holder_from_html(self, html_text):
        if not html_text:
            return None
        soup = BeautifulSoup(html_text, "html5lib")
        plain_text = soup.get_text(" ", strip=True)
        holder_match = re.search(
            r"(?:예금주|입금자명|계좌주(?:명)?(?:\(ID\))?|수취인)\s*[:：]?\s*([가-힣A-Za-z0-9\(\)\.\-_* ]{2,40})",
            plain_text,
        )
        if not holder_match:
            return None
        holder = holder_match.group(1).strip()
        if not holder:
            return None
        return holder

    def _iter_mappings(self, payload):
        if isinstance(payload, dict):
            yield payload
            for value in payload.values():
                yield from self._iter_mappings(value)
        elif isinstance(payload, list):
            for value in payload:
                yield from self._iter_mappings(value)

    def _find_bank_name_in_mapping(self, data):
        if not isinstance(data, dict):
            return None

        for key in ("VbankBankName", "VBankName", "bankName", "bankNm", "bank"):
            value = data.get(key)
            if value not in (None, ""):
                value = str(value).strip()
                if not value:
                    continue
                if re.fullmatch(r"\d{3}", value):
                    code_name = self._bank_name_from_code(value)
                    if code_name:
                        return code_name
                return value

        for key, value in data.items():
            key_l = str(key).lower()

            if "bankcode" in key_l:
                bank_name = self._bank_name_from_code(value)
                if bank_name:
                    return bank_name

            if "bank" in key_l or "은행" in str(key):
                if value in (None, ""):
                    continue
                value = str(value).strip()
                if value and any(bank_name in value for bank_name in self._BANK_CODE_TO_NAME.values()):
                    return value

        return None

    def _find_account_holder_in_mapping(self, data):
        if not isinstance(data, dict):
            return None

        key_candidates = (
            "VBankAccountName",
            "BuyerName",
            "accountHolder",
            "holderName",
            "depositorName",
            "dpstrNm",
            "예금주",
            "입금자",
            "계좌주",
        )
        for key in key_candidates:
            value = data.get(key)
            if value in (None, ""):
                continue
            holder = str(value).strip()
            if holder and 1 < len(holder) <= 30:
                return holder

        for key, value in data.items():
            key_l = str(key).lower()
            if not any(token in key_l for token in ("holder", "depositor", "buyer", "예금주", "입금자", "계좌주")):
                continue
            if value in (None, ""):
                continue
            holder = str(value).strip()
            if holder and 1 < len(holder) <= 30:
                return holder
        return None

    def _find_amount_text_in_mapping(self, data):
        if not isinstance(data, dict):
            return None

        for key in ("Amt", "amt", "price", "payAmt", "amount"):
            value = data.get(key)
            if value in (None, ""):
                continue
            return self._format_won_text(value)

        for key, value in data.items():
            key_l = str(key).lower()
            if not any(token in key_l for token in ("amt", "amount", "price")):
                continue
            if value in (None, ""):
                continue
            return self._format_won_text(value)
        return None

    def _extract_virtual_account_fields_from_payload(self, payload, default_amount=None):
        account_number = ""
        amount_text = None
        bank_name = None
        account_holder = None

        for mapping in self._iter_mappings(payload):
            if not account_number:
                account_number = self._find_account_in_mapping(mapping)
            if not bank_name:
                bank_name = self._find_bank_name_in_mapping(mapping)
            if not account_holder:
                account_holder = self._find_account_holder_in_mapping(mapping)
            if not amount_text:
                amount_text = self._find_amount_text_in_mapping(mapping)

            if account_number and bank_name and account_holder and amount_text:
                break

        if not amount_text and default_amount is not None:
            amount_text = self._format_won_text(default_amount)

        if bank_name is None:
            # 케이뱅크는 동행복권 가상계좌 대표 은행.
            bank_name = self._bank_name_from_code("089")

        return account_number, amount_text, bank_name, account_holder

    def _ajax_json_headers(self, referer):
        menu_uri = urlsplit(referer).path or "/"
        return {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": referer,
            "AJAX": "true",
            "requestMenuUri": menu_uri,
        }

    def _normalize_url(self, raw_path, referer=None):
        if not raw_path:
            return None
        path = raw_path.strip()
        if path.startswith(("http://", "https://")):
            return path
        if path.startswith("//"):
            return f"https:{path}"
        if referer:
            return urljoin(referer, path)
        return urljoin(self._base_url + "/", path)

    def _normalize_do_endpoint(self, raw_path):
        return self._normalize_url(raw_path, referer=self._base_url)

    def _extract_script_sources(self, html_text, referer):
        if not html_text:
            return []

        soup = BeautifulSoup(html_text, "html5lib")
        sources = []
        for script in soup.select("script[src]"):
            raw_src = script.get("src")
            src = self._normalize_url(raw_src, referer=referer)
            if not src:
                continue
            if not src.endswith(".js") and ".js?" not in src:
                continue
            if src not in sources:
                sources.append(src)
        return sources

    def _fetch_script_texts(self, script_urls, max_scripts=18):
        texts = []
        for url in script_urls[:max_scripts]:
            try:
                if "dhlottery.co.kr" not in url:
                    continue
                resp = self._session.get(url, timeout=10)
                if resp.status_code != 200:
                    continue
                content_type = (resp.headers.get("Content-Type") or "").lower()
                if "javascript" not in content_type and not url.endswith(".js") and ".js?" not in url:
                    continue
                if not resp.text:
                    continue
                texts.append(resp.text)
            except Exception as error:
                logger.debug(f"script fetch failed ({url}): {type(error).__name__}: {error}")
        return texts

    def _discover_account_related_endpoints(self, html_text, script_texts=None):
        if not html_text:
            return []

        if script_texts is None:
            script_texts = []
        combined_text = html_text + "\n" + "\n".join(script_texts)

        endpoint_set = set()
        patterns = [
            r'ajaxUtil\.sendHttpJson\([^,]+,\s*[\'"]([^\'"]+\.do(?:\?method=[A-Za-z0-9_]+)?)',
            r'[\'"](/mypage/[A-Za-z0-9_/\-]+\.do(?:\?method=[A-Za-z0-9_]+)?)[\'"]',
            r'[\'"](/kbank\.do\?method=[A-Za-z0-9_]+)[\'"]',
        ]
        for pattern in patterns:
            for raw in re.findall(pattern, combined_text):
                endpoint = self._normalize_do_endpoint(raw)
                if endpoint:
                    endpoint_set.add(endpoint)

        def score(url):
            url_l = url.lower()
            s = 0
            for token in ("mndp", "chrg", "kbank", "vbank", "account", "actno", "vact", "dpst", "charge"):
                if token in url_l:
                    s += 3
            for token in ("select", "get", "search"):
                if token in url_l:
                    s += 2
            return s

        ranked = []
        for url in endpoint_set:
            url_l = url.lower()
            if "/mypage/" not in url_l:
                continue
            if not any(token in url_l for token in ("select", "get", "search")):
                continue
            if score(url) < 3:
                continue
            ranked.append(url)
        ranked.sort(key=score, reverse=True)
        return ranked

    def _try_extract_account_from_endpoint_response(self, resp, default_amount):
        content_type = (resp.headers.get("Content-Type") or "").lower()
        if "json" in content_type:
            payload = resp.json()
            account_number, amount_text, bank_name, account_holder = self._extract_virtual_account_fields_from_payload(
                payload,
                default_amount=default_amount,
            )
            if self._is_valid_virtual_account_candidate(account_number):
                return account_number, amount_text, bank_name, account_holder
            return None

        if "html" in content_type:
            account_number, amount_text, bank_name = self._extract_virtual_account_from_html(resp.text)
            account_holder = self._extract_account_holder_from_html(resp.text)
            if self._is_valid_virtual_account_candidate(account_number):
                if not amount_text:
                    amount_text = self._format_won_text(default_amount)
                return account_number, amount_text, bank_name, account_holder
            return None

        return None

    def _try_fetch_account_from_discovered_endpoints(self, html_text, referer, default_amount):
        script_urls = self._extract_script_sources(html_text, referer=referer)
        script_texts = self._fetch_script_texts(script_urls, max_scripts=18)
        endpoints = self._discover_account_related_endpoints(html_text, script_texts=script_texts)
        guessed_paths = [
            "/mypage/selectMndpChrg.do",
            "/mypage/selectMndpChrgInfo.do",
            "/mypage/selectMndpChrgList.do",
            "/mypage/selectMndpChrgHist.do",
            "/mypage/selectMndpChrgDetail.do",
            "/mypage/selectMndpVbankInfo.do",
            "/mypage/selectVbankInfo.do",
            "/mypage/selectFixVactInfo.do",
            "/mypage/selectFxVrAccount.do",
        ]
        for path in guessed_paths:
            url = self._normalize_do_endpoint(path)
            if url and url not in endpoints:
                endpoints.append(url)
        logger.warning(
            "mndpChrg endpoint discovery result: "
            f"scripts={len(script_urls)} fetched={len(script_texts)} endpoints={len(endpoints)} "
            f"sample={endpoints[:5]}"
        )
        if not endpoints:
            return None

        headers = self._ajax_json_headers(referer)
        headers_json_post = dict(headers)
        headers_json_post["Content-Type"] = "application/json;charset=UTF-8"
        timestamp = int(datetime.datetime.now().timestamp() * 1000)

        for endpoint in endpoints[:12]:
            for method in ("GET", "POST_JSON", "POST_FORM"):
                try:
                    if method == "GET":
                        resp = self._session.get(endpoint, headers=headers, params={"_": timestamp}, timeout=10)
                    elif method == "POST_JSON":
                        resp = self._session.post(endpoint, headers=headers_json_post, data="{}", timeout=10)
                    else:
                        resp = self._session.post(endpoint, headers=headers, data={}, timeout=10)
                    if resp.status_code != 200:
                        continue
                    found = self._try_extract_account_from_endpoint_response(resp, default_amount)
                    if found:
                        logger.warning(f"virtual account found from discovered endpoint: {endpoint} ({method})")
                        return found
                except Exception as error:
                    logger.debug(f"account endpoint probe failed ({method} {endpoint}): {type(error).__name__}: {error}")

        return None

    def _find_mapping_by_keys(self, payload, key_candidates):
        key_candidates_l = [k.lower() for k in key_candidates]
        for mapping in self._iter_mappings(payload):
            if not isinstance(mapping, dict):
                continue
            mapping_keys_l = {str(k).lower() for k in mapping.keys()}
            if any(k in mapping_keys_l for k in key_candidates_l):
                return mapping
        return {}

    def _find_dict_value_by_key(self, payload, target_key):
        if isinstance(payload, dict):
            value = payload.get(target_key)
            if isinstance(value, dict):
                return value
            for nested in payload.values():
                found = self._find_dict_value_by_key(nested, target_key)
                if found:
                    return found
        elif isinstance(payload, list):
            for nested in payload:
                found = self._find_dict_value_by_key(nested, target_key)
                if found:
                    return found
        return {}

    def _try_assign_virtual_account_via_mypage_flow(self, deposit):
        referer = self._mndp_charge_page
        headers = self._ajax_json_headers(referer)

        try:
            # mndpChrg 페이지 진입 후 마이페이지 전용 API 흐름을 그대로 수행
            self._session.get(self._mndp_charge_page, headers={"Referer": self._cash_balance}, timeout=10)

            # (선행) 간편충전 정보 조회 - 실제 페이지 초기화 흐름과 동일하게 맞춤
            smrt_url = f"{self._base_url}/mypage/selectSmrtChrgInfo.do"
            smrt_resp = self._session.get(smrt_url, headers=headers, timeout=10)
            if smrt_resp.status_code == 200 and "json" in (smrt_resp.headers.get("Content-Type") or "").lower():
                try:
                    smrt_payload = smrt_resp.json()
                    easy_user = (
                        smrt_payload.get("data", {}).get("easyChargeUser")
                        if isinstance(smrt_payload, dict)
                        else None
                    )
                    if isinstance(easy_user, dict) and easy_user.get("maintenaceUseYn") == "Y":
                        logger.warning("selectSmrtChrgInfo indicates maintenance window for charge flow")
                except Exception:
                    pass

            # [tab2] 가상계좌 입금 충전하기 버튼 클릭 흐름 (MndpChrgM.fn_openVcRegistAccountCheck)
            init_url = f"{self._base_url}/mypage/kbankInit.do"
            init_params = {
                "VbankExpDate": self._get_tomorrow(),
                "PayMethod": "VBANK",
                "VbankBankCode": "089",
                "Price": str(deposit.amount),
            }
            init_resp = self._session.get(init_url, headers=headers, params=init_params, timeout=10)
            if init_resp.status_code != 200:
                logger.warning(f"mypage kbankInit.do status: {init_resp.status_code}")
                return None
            if "json" not in (init_resp.headers.get("Content-Type") or "").lower():
                logger.warning(f"mypage kbankInit.do non-json content-type: {init_resp.headers.get('Content-Type', '')}")
                return None

            init_payload = init_resp.json()
            self._save_debug_json("mypage_kbankInit_last.json", init_payload)
            req_vo = self._find_dict_value_by_key(init_payload, "reqVO")
            if not req_vo:
                req_vo = self._find_mapping_by_keys(
                    init_payload,
                    (
                        "payMethod",
                        "goodsName",
                        "moid",
                        "userIP",
                        "mallUserID",
                        "vbankExpDate",
                        "amt",
                        "vbankBankCode",
                        "fxVrAccountNo",
                        "buyerName",
                    ),
                )
            if not req_vo:
                logger.warning("mypage kbankInit.do returned no reqVO-like payload")
                return None

            process_url = f"{self._base_url}/mypage/kbankProcess.do"
            process_params = {
                "PayMethod": self._pick_first(req_vo, "payMethod", "PayMethod", default="VBANK"),
                "GoodsName": self._pick_first(req_vo, "goodsName", "GoodsName", default="복권예치금"),
                "Moid": self._pick_first(req_vo, "moid", "Moid"),
                "UserIP": self._pick_first(req_vo, "userIP", "UserIP"),
                "MallUserID": self._pick_first(req_vo, "mallUserID", "MallUserID"),
                "VbankExpDate": self._pick_first(req_vo, "vbankExpDate", "VbankExpDate", default=self._get_tomorrow()),
                "Amt": self._pick_first(req_vo, "amt", "Amt", default=str(deposit.amount)),
                "VbankBankCode": self._pick_first(req_vo, "vbankBankCode", "VbankBankCode", default="089"),
                "VbankNum": self._pick_first(req_vo, "fxVrAccountNo", "vbankNum", "VbankNum"),
                "FxVrAccountNo": self._pick_first(req_vo, "fxVrAccountNo", "FxVrAccountNo", "vbankNum", "VbankNum"),
                "VBankAccountName": self._pick_first(req_vo, "buyerName", "VBankAccountName", "BuyerName"),
            }
            process_resp = self._session.get(process_url, headers=headers, params=process_params, timeout=10)
            if process_resp.status_code != 200:
                logger.warning(f"mypage kbankProcess.do status: {process_resp.status_code}")
                return None
            if "json" not in (process_resp.headers.get("Content-Type") or "").lower():
                logger.warning(f"mypage kbankProcess.do non-json content-type: {process_resp.headers.get('Content-Type', '')}")
                return None

            process_payload = process_resp.json()
            self._save_debug_json("mypage_kbankProcess_last.json", process_payload)
            res_vo = self._find_dict_value_by_key(process_payload, "resVO")
            if not res_vo:
                res_vo = self._find_mapping_by_keys(
                    process_payload,
                    (
                        "vbankNum",
                        "vbankBankName",
                        "resultCode",
                        "amt",
                        "mallUserIDMask",
                        "payMethodName",
                    ),
                )
            if not res_vo:
                logger.warning("mypage kbankProcess.do returned no resVO-like payload")
                return None

            result_code = str(self._pick_first(res_vo, "resultCode", default="")).upper()
            account_number_raw = self._pick_first(res_vo, "vbankNum", "VbankNum")
            if not account_number_raw:
                account_number_raw = self._pick_first(req_vo, "fxVrAccountNo", "FxVrAccountNo", "vbankNum", "VbankNum")
            account_number = self._normalize_account_candidate(account_number_raw)
            if result_code == "FAIL" and not self._is_valid_virtual_account_candidate(account_number):
                logger.warning("mypage kbankProcess.do resultCode=FAIL")
                return None

            if not self._is_valid_virtual_account_candidate(account_number):
                logger.warning(
                    "mypage kbankProcess.do returned invalid account candidate: "
                    f"{account_number} (raw={account_number_raw}, resVO_keys={list(res_vo.keys())[:20]})"
                )
                return None

            amount_text = self._format_won_text(
                self._pick_first(res_vo, "amt", "Amt", default=self._pick_first(req_vo, "amt", "Amt", default=deposit.amount))
            )
            bank_name = (
                self._pick_first(res_vo, "vbankBankName", "VbankBankName", default="")
                or self._bank_name_from_code(self._pick_first(req_vo, "vbankBankCode", "VbankBankCode", default="089"))
                or self._bank_name_from_code("089")
            )
            account_holder = (
                self._pick_first(res_vo, "vBankAccountName", "VBankAccountName", "buyerName")
                or self._pick_first(req_vo, "buyerName", "VBankAccountName")
            )
            logger.warning("virtual account found from mypage kbank flow (/mypage/kbankInit.do -> /mypage/kbankProcess.do)")
            return account_number, amount_text, bank_name, account_holder
        except Exception as error:
            logger.warning(f"mypage kbank flow failed: {type(error).__name__}: {error}")
            return None

    def _try_get_virtual_account_from_user_mndp(self, default_amount):
        try:
            headers = self._ajax_json_headers(self._cash_balance)
            resp = self._session.get(self._user_mndp_url, headers=headers, timeout=10)
            if resp.status_code != 200:
                logger.debug(f"selectUserMndp status: {resp.status_code}")
                return None

            content_type = (resp.headers.get("Content-Type") or "").lower()
            if "json" not in content_type:
                logger.debug(f"selectUserMndp non-json content-type: {content_type}")
                return None

            payload = resp.json()
            account_number, amount_text, bank_name, account_holder = self._extract_virtual_account_fields_from_payload(
                payload,
                default_amount=default_amount,
            )
            if self._is_valid_virtual_account_candidate(account_number):
                return account_number, amount_text, bank_name, account_holder
            return None
        except Exception as error:
            logger.debug(f"selectUserMndp account lookup skipped: {type(error).__name__}: {error}")
            return None

    def _try_get_virtual_account_from_mndp_charge_page(self, default_amount):
        try:
            resp = self._get_with_wait_retry(
                self._mndp_charge_page,
                headers={"Referer": self._cash_balance},
                timeout=10,
                max_attempts=8,
                wait_seconds=1,
            )
            if resp.status_code != 200 or self._is_wait_page(resp.text):
                return None

            account_number, amount_text, bank_name = self._extract_virtual_account_from_html(resp.text)
            account_holder = self._extract_account_holder_from_html(resp.text)
            if self._is_valid_virtual_account_candidate(account_number):
                if not amount_text:
                    amount_text = self._format_won_text(default_amount)
                return account_number, amount_text, bank_name, account_holder

            hidden_fields = self._extract_hidden_inputs_from_html(resp.text)
            account_number, amount_text, bank_name, account_holder = self._extract_virtual_account_fields_from_payload(
                hidden_fields,
                default_amount=default_amount,
            )
            if self._is_valid_virtual_account_candidate(account_number):
                return account_number, amount_text, bank_name, account_holder

            via_mypage = self._try_assign_virtual_account_via_mypage_flow(Deposit(default_amount))
            if via_mypage:
                return via_mypage

            discovered = self._try_fetch_account_from_discovered_endpoints(
                resp.text,
                referer=self._mndp_charge_page,
                default_amount=default_amount,
            )
            if discovered:
                return discovered

            logger.warning(
                "mndpChrg page parsed but no valid account found "
                f"(url: {resp.url}, has_keyword: {'고정 가상계좌' in resp.text}, "
                f"content_type: {resp.headers.get('Content-Type', '')}, "
                f"direct_extract: account={account_number} bank={bank_name} holder={account_holder}, "
                f"snippet: {' '.join(resp.text.split())[:240]})"
            )
            self._save_debug_html("mndpChrg_last.html", resp.text)

            return None
        except Exception as error:
            logger.debug(f"mndpChrg account lookup skipped: {type(error).__name__}: {error}")
            return None

    def _extract_wait_context_from_html(self, html_text, request_url):
        if not html_text:
            return None

        def _find_var(name):
            pattern = rf'var\s+{re.escape(name)}\s*=\s*[\'"]([^\'"]+)[\'"]'
            match = re.search(pattern, html_text)
            if match:
                return match.group(1).strip()
            return None

        parsed_url = urlsplit(request_url)
        default_page_url = parsed_url.path.lstrip("/") if parsed_url.path else "main"
        if parsed_url.query:
            default_page_url = f"{default_page_url}?{parsed_url.query}"

        context = {
            "host": _find_var("host") or parsed_url.netloc or "www.dhlottery.co.kr",
            "ip": _find_var("ip"),
            "loginId": _find_var("loginId"),
            "port": _find_var("port") or ("443" if parsed_url.scheme == "https" else "80"),
            "pageUrl": _find_var("pageUrl") or default_page_url,
            "tracer_domain": _find_var("tracer_domain") or self._tracer_domain,
        }

        if not context["ip"]:
            return None
        if not context["loginId"]:
            context["loginId"] = context["ip"]
        return context

    def _parse_tracer_parameters(self, xml_text):
        values = {}
        if not xml_text:
            return values
        for key, value in re.findall(r'<Parameter\s+id="([^"]+)"[^>]*>(.*?)</Parameter>', xml_text, re.S):
            values[key] = value.strip()
        return values

    def _ensure_wc_cookie(self, wait_context):
        current_wc = self._session.cookies.get("wcCookie")
        if current_wc:
            wait_context["loginId"] = current_wc
            return current_wc

        ip = wait_context.get("ip", "0.0.0.0")
        wc_cookie = f"{ip}_T_{random.randint(10000, 99999)}_WC"
        self._session.cookies.set("wcCookie", wc_cookie, domain=".dhlottery.co.kr", path="/")
        wait_context["loginId"] = wc_cookie
        return wc_cookie

    def _call_tracer_check_bot(self, wait_context, request_url, timeout=2):
        tracer_domain = wait_context.get("tracer_domain") or self._tracer_domain
        tracer_url = self._tracer_check_bot.format(domain=tracer_domain)
        payload = {
            "host": wait_context.get("host"),
            "ip": wait_context.get("ip"),
            "port": wait_context.get("port"),
            "pageUrl": wait_context.get("pageUrl"),
        }
        headers = {
            "Origin": self._base_url,
            "Referer": request_url,
        }
        resp = self._session.post(tracer_url, data=payload, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            return None
        return (resp.text or "").strip()

    def _call_tracer_input_queue(self, wait_context, request_url, timeout=3):
        tracer_domain = wait_context.get("tracer_domain") or self._tracer_domain
        tracer_url = self._tracer_input_queue.format(domain=tracer_domain)
        payload = {
            "host": wait_context.get("host"),
            "ip": wait_context.get("ip"),
            "loginId": wait_context.get("loginId"),
            "port": wait_context.get("port"),
            "pageUrl": wait_context.get("pageUrl"),
            "userAgent": self._session.headers.get("User-Agent", "Mozilla/5.0"),
        }
        headers = {
            "Origin": self._base_url,
            "Referer": request_url,
        }
        resp = self._session.post(tracer_url, data=payload, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            logger.debug(f"tracer inputQueue status: {resp.status_code}")
            return {}
        return self._parse_tracer_parameters(resp.text)

    def _try_release_wait_queue(self, html_text, request_url, max_attempts=3, wait_seconds=0.8):
        wait_context = self._extract_wait_context_from_html(html_text, request_url)
        if not wait_context:
            return False

        self._ensure_wc_cookie(wait_context)

        try:
            reject_state = self._call_tracer_check_bot(wait_context, request_url)
            logger.debug(f"tracer checkBotIp state: {reject_state}")
            if reject_state and reject_state not in {"F", "E"}:
                return False
        except Exception as error:
            logger.debug(f"tracer checkBotIp failed: {type(error).__name__}: {error}")
            return False

        for attempt in range(1, max_attempts + 1):
            try:
                tracer_result = self._call_tracer_input_queue(wait_context, request_url)
            except Exception as error:
                logger.debug(f"tracer inputQueue failed: {type(error).__name__}: {error}")
                return False

            is_wait = str(tracer_result.get("isWait", "")).strip()
            wait_cnt = str(tracer_result.get("waitCnt", "")).strip()
            logger.debug(f"tracer queue state ({attempt}/{max_attempts}): isWait={is_wait}, waitCnt={wait_cnt}")

            if is_wait in {"F", "E", "NE"} or wait_cnt in {"0", "E"}:
                return True

            if attempt < max_attempts:
                time.sleep(wait_seconds)
        return False

    def _is_wait_page(self, html_text):
        if not html_text:
            return False
        # 일반 페이지에도 tracer 스크립트/DOM이 기본 포함되므로,
        # wait 판별은 에러/점검 템플릿 마커가 있는 경우로 제한한다.
        return (
            "img_error.png" in html_text
            or "img_construction.png" in html_text
        )

    def _request_with_wait_retry(
        self,
        method,
        url,
        *,
        params=None,
        data=None,
        headers=None,
        timeout=10,
        max_attempts=15,
        wait_seconds=2,
    ):
        last_resp = None
        upper_method = method.upper()
        released_retry_done = False

        for attempt in range(1, max_attempts + 1):
            resp = self._session.request(
                upper_method,
                url,
                params=params,
                data=data,
                headers=headers,
                timeout=timeout,
            )
            last_resp = resp

            content_type = (resp.headers.get("Content-Type") or "").lower()
            if resp.status_code != 200:
                return resp

            if "text/html" in content_type and self._is_wait_page(resp.text):
                logger.warning(f"wait page detected for {url} ({attempt}/{max_attempts})")
                released = self._try_release_wait_queue(resp.text, url)

                # tracer 해제가 안 되면 반복 재시도해도 결과가 동일한 경우가 많다.
                if not released:
                    return resp

                # 대기열 해제 후 재요청은 1회만 수행.
                if attempt < max_attempts and not released_retry_done:
                    released_retry_done = True
                    time.sleep(0.3)
                    continue

            return resp

        return last_resp

    def _post_with_wait_retry(self, url, *, data, headers=None, timeout=10, max_attempts=15, wait_seconds=2):
        return self._request_with_wait_retry(
            "POST",
            url,
            data=data,
            headers=headers,
            timeout=timeout,
            max_attempts=max_attempts,
            wait_seconds=wait_seconds,
        )

    def _get_with_wait_retry(self, url, *, params=None, headers=None, timeout=10, max_attempts=15, wait_seconds=2):
        return self._request_with_wait_retry(
            "GET",
            url,
            params=params,
            headers=headers,
            timeout=timeout,
            max_attempts=max_attempts,
            wait_seconds=wait_seconds,
        )

    def _publish_virtual_account_result(self, account_number, amount_text, bank_name=None, account_holder=None):
        try:
            self._lottery_endpoint.print_result_of_assign_virtual_account(account_number, amount_text, bank_name, account_holder)
        except TypeError:
            self._lottery_endpoint.print_result_of_assign_virtual_account(account_number, amount_text)

    def assign_virtual_account(self, deposit: Deposit):
        try:
            # 1) 동행복권 마이페이지 API/화면에 이미 발급된 개인별 가상계좌가 있으면 우선 사용.
            account_info = self._try_get_virtual_account_from_user_mndp(deposit.amount)
            if not account_info:
                account_info = self._try_get_virtual_account_from_mndp_charge_page(deposit.amount)

            if account_info:
                account_number, amount_text, bank_name, account_holder = account_info
                if self._is_valid_virtual_account_candidate(account_number):
                    self._publish_virtual_account_result(account_number, amount_text, bank_name, account_holder)
                    return

            # 2) 기존 kbank 발급 플로우 (fallback)
            init_body = {
                "PayMethod": "VBANK",
                "VbankBankCode": "089",  # 가상계좌 채번가능 케이뱅크 코드
                "price": str(deposit.amount),
                "goodsName": "복권예치금",
                "vExp": self._get_tomorrow(),
            }
            resp = self._post_with_wait_retry(
                self._assign_virtual_account_1,
                data=init_body,
                timeout=10,
                max_attempts=15,
                wait_seconds=2,
            )
            logger.debug(f"kbankInit status_code: {resp.status_code}")
            logger.debug(f"kbankInit content-type: {resp.headers.get('Content-Type', '')}")

            if resp.status_code != 200:
                raise RuntimeError(f"kbankInit 요청 실패 (status: {resp.status_code})")
            if self._is_wait_page(resp.text):
                self._save_debug_html("kbankInit_last.html", resp.text)
                raise RuntimeError(
                    "결제 시스템 대기열로 인해 가상계좌 발급이 지연되고 있습니다. "
                    "동행복권 mndpChrg 페이지에서 대기열 해소 후 다시 시도해주세요."
                )

            data = None
            try:
                data = resp.json()
                logger.debug(f"kbankInit json keys: {list(data.keys())}")
            except Exception as json_error:
                logger.warning(f"kbankInit non-json response: {type(json_error).__name__}: {json_error}")
                account_number, amount_text, bank_name_from_html = self._extract_virtual_account_from_html(resp.text)

                # 사이트 응답이 이미 최종 결과 화면인 경우
                if account_number:
                    if not amount_text:
                        amount_text = self._format_won_text(deposit.amount)
                    bank_name = bank_name_from_html or self._bank_name_from_code("089")
                    self._publish_virtual_account_result(account_number, amount_text, bank_name, None)
                    return

                data = self._extract_hidden_inputs_from_html(resp.text)
                if not data:
                    snippet = " ".join(resp.text.strip().split())[:200]
                    raise RuntimeError(
                        "kbankInit 응답을 파싱하지 못했습니다. "
                        f"(status: {resp.status_code}, content-type: {resp.headers.get('Content-Type', '')}, snippet: {snippet})"
                    )
                logger.debug(f"kbankInit html input keys: {list(data.keys())}")

            account_no = self._find_account_in_mapping(data)
            amount_value = self._pick_first(data, "amt", "Amt", "price", default=str(deposit.amount))
            buyer_name = str(self._pick_first(data, "BuyerName", "VBankAccountName", default="")).strip()
            bank_code = str(self._pick_first(data, "VbankBankCode", default="089")).zfill(3)
            bank_name = (
                self._pick_first(data, "VbankBankName", "VBankName", default="")
                or self._bank_name_from_code(bank_code)
            )

            body = {
                "PayMethod": "VBANK",
                "GoodsName": self._pick_first(data, "GoodsName", default="복권예치금"),
                "GoodsCnt": "",
                "BuyerTel": self._pick_first(data, "BuyerTel"),
                "Moid": self._pick_first(data, "Moid"),
                "MID": self._pick_first(data, "MID"),
                "UserIP": self._pick_first(data, "UserIP"),
                "MallIP": self._pick_first(data, "MallIP"),
                "MallUserID": self._pick_first(data, "MallUserID"),
                "VbankExpDate": self._pick_first(data, "VbankExpDate", default=self._get_tomorrow()),
                "BuyerEmail": self._pick_first(data, "BuyerEmail"),
                # "SocketYN": '',
                # "GoodsCl": '',
                # "EncodeParameters": '',
                "EdiDate": self._pick_first(data, "EdiDate"),
                "EncryptData": self._pick_first(data, "EncryptData"),
                "Amt": amount_value,
                "BuyerName": buyer_name,
                "VbankBankCode": bank_code,
                "VbankNum": account_no,
                "FxVrAccountNo": self._pick_first(data, "FxVrAccountNo", default=account_no),
                "VBankAccountName": self._pick_first(data, "VBankAccountName", "BuyerName", default=buyer_name),
                "svcInfoPgMsgYn": self._pick_first(data, "svcInfoPgMsgYn", default="N"),
                "OptionList": self._pick_first(data, "OptionList", default="no_receipt"),
                "TransType": self._pick_first(data, "TransType", default="0"),  # 일반(0), 에스크로(1)
                # "TrKey": None,
            }

            if not body["VbankNum"] and body["FxVrAccountNo"]:
                body["VbankNum"] = self._normalize_account_candidate(body["FxVrAccountNo"])
            if not body["FxVrAccountNo"] and body["VbankNum"]:
                body["FxVrAccountNo"] = body["VbankNum"]
            if not body["Amt"]:
                body["Amt"] = str(deposit.amount)
            logger.debug(f"body: {body}")

            process_headers = {
                "Origin": self._base_url,
                "Referer": self._assign_virtual_account_1,
            }
            resp = self._post_with_wait_retry(
                self._assign_virtual_account_2,
                headers=process_headers,
                data=body,
                timeout=10,
                max_attempts=10,
                wait_seconds=2,
            )
            logger.debug(f"kbankProcess status: {resp.status_code}")
            logger.debug(f"kbankProcess content-type: {resp.headers.get('Content-Type', '')}")
            if resp.status_code != 200:
                raise RuntimeError(f"kbankProcess 요청 실패 (status: {resp.status_code})")
            if self._is_wait_page(resp.text):
                self._save_debug_html("kbankProcess_last.html", resp.text)
                raise RuntimeError(
                    "결제 시스템 대기열이 길어 가상계좌 정보를 확인하지 못했습니다. "
                    "동행복권 mndpChrg 페이지에서 대기열 해소 후 다시 시도해주세요."
                )

            전용가상계좌, 결제신청금액, bank_name_from_html = self._extract_virtual_account_from_html(resp.text)
            if bank_name_from_html:
                bank_name = bank_name_from_html

            # 동행복권 응답 구조가 바뀌어 HTML 파싱이 실패해도
            # 1차 응답 JSON 값을 이용해 결과를 반환할 수 있게 보완.
            if not 전용가상계좌:
                fallback_account = self._find_account_in_mapping(data)
                if self._is_valid_virtual_account_candidate(fallback_account):
                    전용가상계좌 = fallback_account
            if not 결제신청금액:
                결제신청금액 = self._format_won_text(self._pick_first(data, "amt", "Amt", default=deposit.amount))

            if not self._is_valid_virtual_account_candidate(전용가상계좌):
                snippet = " ".join(resp.text.strip().split())[:200]
                raise RuntimeError(
                    "유효한 가상계좌 번호를 찾지 못했습니다. "
                    f"(candidate: {전용가상계좌}, kbankProcess status: {resp.status_code}, snippet: {snippet})"
                )

            self._publish_virtual_account_result(전용가상계좌, 결제신청금액, bank_name, buyer_name)
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(f"❗ 가상계좌를 할당하지 못했습니다. (상세: {type(e).__name__}: {e})")

    def _get_tomorrow(self):
        korea_tz = pytz.timezone("Asia/Seoul")
        now = datetime.datetime.now(korea_tz)
        tomorrow = now + datetime.timedelta(days=1)
        return tomorrow.strftime("%Y%m%d")
