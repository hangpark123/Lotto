"""
동행복권 API 래퍼
기존 LotteryClient 로직을 웹 API용으로 변환
"""
import sys
import os
from typing import List, Optional, Dict, Any

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from dhapi.domain.user import User
from dhapi.domain.lotto645_ticket import Lotto645Ticket
from dhapi.domain.deposit import Deposit
from dhapi.port.lottery_client import LotteryClient


class WebLotteryEndpoint:
    """웹 API용 엔드포인트 - JSON 응답 반환"""
    
    def __init__(self):
        self.last_result = None
    
    def print_result_of_buy_lotto645(self, slots):
        """로또 구매 결과를 저장"""
        self.last_result = {
            "success": True,
            "message": "로또6/45 구매가 완료되었습니다.",
            "slots": slots
        }
    
    def print_result_of_show_balance(self, **kwargs):
        """예치금 현황을 저장"""
        self.last_result = {
            "success": True,
            "balance": {
                "총예치금": kwargs.get("총예치금", 0),
                "구매가능금액": kwargs.get("구매가능금액", 0),
                "예약구매금액": kwargs.get("예약구매금액", 0),
                "출금신청중금액": kwargs.get("출금신청중금액", 0),
                "구매불가능금액": kwargs.get("구매불가능금액", 0),
                "최근1달누적구매금액": kwargs.get("최근1달누적구매금액", 0),
            }
        }
    
    def print_result_of_show_buy_list(self, found_data, output_format, start_date, end_date):
        """구매 내역을 저장"""
        self.last_result = {
            "success": True,
            "data": found_data,
            "period": {
                "start": start_date,
                "end": end_date
            }
        }
    
    def print_result_of_assign_virtual_account(self, account_number, amount, bank_name=None, account_holder=None):
        """가상계좌 정보를 저장"""
        self.last_result = {
            "success": True,
            "account": account_number,
            "amount": amount,
            "bank_name": bank_name,
            "account_holder": account_holder,
        }


class APIWrapper:
    """LotteryClient를 웹 API용으로 래핑"""
    
    @staticmethod
    def login(username: str, password: str) -> Dict[str, Any]:
        """
        로그인 및 LotteryClient 인스턴스 생성
        
        Returns:
            dict: {"success": bool, "client": LotteryClient, "message": str}
        """
        try:
            user = User(username=username, password=password)
            endpoint = WebLotteryEndpoint()
            client = LotteryClient(user, endpoint)
            
            return {
                "success": True,
                "client": client,
                "endpoint": endpoint,
                "message": "로그인 성공"
            }
        except RuntimeError as e:
            return {
                "success": False,
                "message": str(e)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"로그인 중 오류가 발생했습니다: {str(e)}"
            }
    
    @staticmethod
    def buy_lotto645(client: LotteryClient, endpoint: WebLotteryEndpoint, 
                     tickets_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        로또6/45 구매
        
        Args:
            client: LotteryClient 인스턴스
            endpoint: WebLotteryEndpoint 인스턴스
            tickets_data: [{"numbers": "1,2,3,4,5,6"}, {"numbers": ""}, ...]
        
        Returns:
            dict: {"success": bool, "data": dict, "message": str}
        """
        try:
            # 티켓 생성
            tickets = []
            for ticket_data in tickets_data:
                numbers = ticket_data.get("numbers", "")
                tickets.append(Lotto645Ticket(numbers if numbers else None))
            
            # 구매 실행
            client.buy_lotto645(tickets)
            
            return endpoint.last_result
        except ValueError as e:
            return {
                "success": False,
                "message": f"입력 오류: {str(e)}"
            }
        except RuntimeError as e:
            return {
                "success": False,
                "message": str(e)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"구매 중 오류가 발생했습니다: {str(e)}"
            }
    
    @staticmethod
    def show_balance(client: LotteryClient, endpoint: WebLotteryEndpoint) -> Dict[str, Any]:
        """
        예치금 현황 조회
        
        Returns:
            dict: {"success": bool, "balance": dict, "message": str}
        """
        try:
            client.show_balance()
            return endpoint.last_result
        except RuntimeError as e:
            return {
                "success": False,
                "message": str(e)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"조회 중 오류가 발생했습니다: {str(e)}"
            }
    
    @staticmethod
    def show_buy_list(client: LotteryClient, endpoint: WebLotteryEndpoint,
                      start_date: Optional[str] = None, 
                      end_date: Optional[str] = None) -> Dict[str, Any]:
        """
        구매 내역 조회
        
        Args:
            start_date: YYYYMMDD 형식
            end_date: YYYYMMDD 형식
        
        Returns:
            dict: {"success": bool, "data": list, "period": dict}
        """
        try:
            client.show_buy_list("json", start_date, end_date)
            return endpoint.last_result
        except RuntimeError as e:
            return {
                "success": False,
                "message": str(e)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"조회 중 오류가 발생했습니다: {str(e)}"
            }
    
    @staticmethod
    def assign_virtual_account(client: LotteryClient, endpoint: WebLotteryEndpoint,
                               amount: int) -> Dict[str, Any]:
        """
        가상계좌 할당
        
        Args:
            amount: 입금할 금액
        
        Returns:
            dict: {"success": bool, "account": str, "amount": str, "bank_name": str, "account_holder": str}
        """
        try:
            deposit = Deposit(amount)
            client.assign_virtual_account(deposit)
            return endpoint.last_result
        except ValueError as e:
            return {
                "success": False,
                "message": f"입력 오류: {str(e)}"
            }
        except RuntimeError as e:
            return {
                "success": False,
                "message": str(e)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"계좌 할당 중 오류가 발생했습니다: {str(e)}"
            }
