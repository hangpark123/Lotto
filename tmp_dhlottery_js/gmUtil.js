/**
 ----------------------------------------------------------------------------
@ 파일명: gmUtil.js 
@ 프로그램명: 게임 공통 javascript
@ 작성일: 2024.10.21
@ 작성자: 조형근
----------------------------------------------------------------------------
*/

/**
 * 게임 공통 유틸
 */
var gmUtil = {
	
	centerPop : function(url, pageName, width, height, scrollYN){
		var windowW = width; 
		var windowH = height;
		var left = Math.ceil((window.screen.width - windowW) / 2);
		var top = Math.ceil((window.screen.height - windowH) / 2);

		return gmUtil.positionPop(url, pageName, left, top, width, height, scrollYN);
	},
	
	positionPop : function(url, pageName, left, top, width, height, scrollYN){
		var windowW = width;
		var windowH = height;

		const ua = navigator.userAgent.toLowerCase();
		
		if (ua.indexOf("chrome") > -1) {
		    windowW = width;
		    windowH = height + 2;
		} else if (ua.indexOf("safari") > -1) {
		    windowW = width;
		    windowH = height + 28;
		}
		var new_popup = window.open(url, pageName,'left='+left+',top='+top+',width='+windowW+',height='+windowH+',scrollbars='+scrollYN, 'status=no, toolbar=no, menubar=no, location=no');
		return new_popup;

	},
	
	goGameClsf : function(lottoId,clsf){
		if(!isLoggedIn){
			ajaxUtil.sendHttpJson({}, '/saved/clearSavedRequest.do', {method: "POST", async: false,} , function(code, msg, {data}){
				alert("로그인 후 이용이 가능합니다.");
				location.href = "/login";
			});
		} else{
			cmmUtil.getServerProperties(function(propInfo){
				let gmUrl = propInfo.serviceElwasUrl; // 게임 도메인
				if(cmmUtil.isMobile() && lottoId == "LO40") {
					gmUrl = propInfo.serviceOlwasUrl;
				}
				if (clsf == 'PRCHS'){
					gmUtil.gamePopUp(lottoId, gmUrl)
				}else if (clsf == 'SMGM'){
					gmUtil.samplePopUp(lottoId, gmUrl)
				}			
			});
		}
	},
	
	//게임팝업
	gamePopUp : function(lotid, gmUrl){
		/*
		* 스피드키노 LD10, 메가빙고 LD11, 더블잭마이더스 LD20, 파워볼 LD14, 트레져헌터 LI22, 트리플럭 LI21 -> gamePop
		* 캐치미 LI23 -> catchPop
		*/
		var type;
		if( lotid === 'LI23' ){
			type = 'catchPop';
		}else{
			type = 'gamePop';
		}
		
		if(cmmUtil.isMobile()) {
			if(lotid == "LO40") { // 로또645
				// 모바일 기기인 경우 토,일요일 구매 제한
				var smarPrchs = true;
				var smarPrchsDay = "토, 일요일";
				
				var reqOption = {
					 "method": "GET",
					 "async" : false		// 동기식 조회
				};
				ajaxUtil.sendHttpJson({}, '/selectMobPrchsCheck.do', reqOption, function(code, msg, {data}){
					if(data && data.result.mobPrchs == "1") {
						smarPrchs = false;
						smarPrchsDay = data.result.nowDay;
					}
				});

				if(smarPrchs) {
					location.href = gmUrl + "/olotto/game_mobile/game645.do";
				} else {
					$.alert("로또복권 인터넷 구매는 PC를 이용해 주시기 바랍니다.");
				}
			} else {
				if(lotid == "LP72") { // 연금복권720
					location.href = gmUrl + "/game_mobile/pension720/game.jsp";
				} else if(lotid == "LP72R") { // 연금복권720(예약하기)
					location.href = gmUrl + "/game_mobile/pension720/reserveGame.jsp";
				} else if(lotid == "LD14") { // 파워볼
					location.href = gmUrl + "/game_mobile/m_powerBall/main.jsp";
				} else if(lotid == "LD10") { // 스피드키노
					location.href = gmUrl + "/game_mobile/keno/game.jsp";
				} else if(lotid == "LD11") { // 메가빙고
					location.href = gmUrl + "/game_mobile/bingo/game.jsp";
				} else if(lotid == "LI21") { // 트리플럭
					location.href = gmUrl + "/game_mobile/m_tripleLuck/main.jsp";
				} else if(lotid == "LI22") { // 트레져헌터
					location.href = gmUrl + "/game_mobile/thunt/game.jsp";
				} else if(lotid == "LD20") { // 더블잭마이더스
					location.href = gmUrl + "/game_mobile/djack/game.jsp";
				} else if(lotid == "LI23") { // 캐치미
					location.href = gmUrl + "/game_mobile/catch/game.jsp";
				}
			}	
		} else {
			var url = gmUrl + '/game/TotalGame.jsp?LottoId='+ lotid;
			gmUtil.centerPop(url, 'type', 1164, 793, 'no');
		}
	},
	
	// 샘플게임팝업
	samplePopUp : function(lotid, gmUrl){		
		var type = 'gamePop';
		url = gmUrl+'/game_sample/TotalGame.jsp?LottoId='+ lotid;	
		
		gmUtil.centerPop(url, 'type', 1164, 645, 'no');
	},
	
	// 미확인 게임팝업
	notYetGamePopUp : function(lotid, orderNo, gmInfoCn){
		if(!isLoggedIn){
			alert("로그인 후 이용이 가능합니다.");
			location.href = "/login";
			return false;
		}
		
		cmmUtil.getServerProperties(function(propInfo){
			let type = 'gamePop';
			let url = propInfo.serviceElwasUrl; // 게임 도메인
			let params = '';

			if(lotid === 'LI21'){ //트리플럭
				params = '/game/tluck/game.jsp?req='+orderNo+'&notyet_img='+gmInfoCn;
			}else if(lotid === 'LI22'){ //트레져헌터
				params = '/game/thunt/game.jsp?req='+orderNo;
			}else if(lotid === 'LD20'){ //더블잭마이더스
				params = '/game/double2/game.jsp?req='+orderNo;
			}else if(lotid === 'LI23'){ //캐치미
				params = '/game/catch/game.jsp?req='+orderNo+'&selected_data='+gmInfoCn;
			}
			
			if(cmmUtil.isEmpty(orderNo) == false){
				gmUtil.centerPop(url+params, type , 900, 645, 'no');
			}
		});
	}
	
}