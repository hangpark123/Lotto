/**
 ----------------------------------------------------------------------------
@ 파일명: cmmUtil.js 
@ 프로그램명: 화면 공통 javascript
@ 작성일: 2024.02.01
@ 작성자: 조형근
----------------------------------------------------------------------------
*/

/**
 * Ajax통신 유틸
 */
var ajaxUtil = {
	/**
	 * JSON기반의 Ajax통신 함수
	 * 
	 * @param paramObj
	 * @param requestUrl
	 * @param option
	 * @param callBackFunc
	 * @param exceptionCallBackFunc : Exception 발생(= httpStatus가 200이 아닌 경우)
	 */
	sendHttpJson : function(paramObj, requestUrl, option, callBackFunc, exceptionCallBackFunc){
		var _async = true;
		var _contentType = "application/json;charset=UTF-8";
		var _lodbar = true;
		var _pagenation = false;
		var requestObject = new Object();
		var includeBody = false;
		var _method = "";
		var _dataType = "JSON";
		var _jsonp = "";
		var _encryptYn = "N";
		if(typeof paramObj != "undefined"){
			requestObject = paramObj;
			
//			사용자가 직접 주입 할수 있게 수정
//			if(typeof requestObject.pageNum != "undefined"
//				&& typeof requestObject.recordCountPerPage != "undefined"){
//				requestObject.pagenation = true;
//			}
		}
		
		var reqData = null;
		var reqUrl = requestUrl;
		var funcevaluated;

		if(typeof (option) == "object"){
			if(option.async != undefined){
				_async = option.async;
				_lodbar = option.async;
			}
			if(option.lodbar != undefined){
				_lodbar = option.lodbar;
			}
			if(option.isForm){
				_contentType = "application/x-www-form-urlencoded; charset=utf-8"
				reqData = requestObject;
			}
			if(option.method){
				_method = option.method.toUpperCase();
			}
			if(option.dataType){
				_dataType = option.dataType;
			}
			if(option.jsonp){
				_jsonp = option.jsonp;
			}
			if(option.encryptYn){
				_encryptYn = option.encryptYn;
			}
		}
		
		if(!_method) {
			alert("option.method 를 지정해주세요");
			return false;
		} else if(!["GET","POST"].includes(_method)) {
			alert("option.method 는 \"GET\",\"POST\" 중에서 사용해주세요");
			return false;
		}
		if(!reqData){
			if(_method === "GET"){
				reqData = cmmUtil.paramToGetStr(requestObject, _encryptYn).substring(1);
			}else {
				reqData = JSON.stringify(requestObject); // jsonObject로 변환
			}
		}
		
		if( _lodbar ){
			cmmUtil.showLoadingOverlay();
		}
		if(!cmmUtil.isEmpty(option.loading)){
			$("#"+option.loading).loading();
		}
		
		$.ajax({
			type : (_method === "GET") ? _method : "POST",
			dataType : _dataType,
			beforeSend : function(ajaxHeader){
				ajaxHeader.setRequestHeader("AJAX", "true");
				ajaxHeader.setRequestHeader("requestMenuUri",window.location.pathname);
			},			
			async : _async,
			data : reqData,
			contentType : _contentType,
			url : reqUrl,
			cache : false,
			jsonp : _jsonp,
			success : function(data, status, res){
				var resultMessage = (!data.resultMessage) ? "처리 중 오류가 발생했습니다." : data.resultMessage;
				var statusType = data.resultCode;
				
				if( _lodbar ){
					cmmUtil.hideLoadingOverlay();
				}
				if(!cmmUtil.isEmpty(option.loading)){
					$("#"+option.loading).loading('stop');
				}
				
				if(statusType){
					$.alert(resultMessage, null, data.resultCode);
					
					if(!cmmUtil.isEmpty(exceptionCallBackFunc)){
						if(typeof (exceptionCallBackFunc) == "function"){
							exceptionCallBackFunc.call(this, requestUrl, statusType, "오류", data.data);
						}
						return true;
					} else {
						return false;
					}
				}
				
				// 요청성공
				if(res.status == "200"){
					if(typeof (callBackFunc) == "function"){
						// 스크립트코드 변경
						data = cmmUtil.dataRefine(data);
						callBackFunc.call(this, statusType, resultMessage, data);
					}
				} else{
					if(!cmmUtil.isEmpty(exceptionCallBackFunc)){
						if(typeof (exceptionCallBackFunc) == "function"){
							// 스크립트코드 변경
							data = cmmUtil.dataRefine(data);
							exceptionCallBackFunc.call(this, statusType, resultMessage, data);
						}
					}
				}
			},
			error : function(request, status, error){
				if( _lodbar ){
					cmmUtil.hideLoadingOverlay();
				}
				if(!cmmUtil.isEmpty(option.loading)){
					$("#"+option.loading).loading('stop');
				}
				if(request.status === 401){
					// Unauthorized - 시큐리티 인증이 없는 상태. 로그인으로 이동
					$.alert("세션이 만료되어 로그인 페이지로 이동합니다.", null, request.status);
					return;
				}
				
				const data = request.responseJSON;
				var resultMessage = (!data || !data.resultMessage) ? "처리 중 오류가 발생했습니다." : data.resultMessage;
				var statusType = (data) ? data.resultCode : "";
				var resultData = (data) ? data.data : null;
				
				if(!cmmUtil.isEmpty(exceptionCallBackFunc)){
					if(typeof (exceptionCallBackFunc) == "function"){
						exceptionCallBackFunc.call(this, requestUrl, statusType, "오류", resultData);
					}
				} else {
					$.alert(resultMessage, null, statusType);
				}
				return;
			}
		});
	}
}
var cmmUtil = {
	propInfo : null,
	downFsh : null,
	isEmpty : function(value){
		if(value === "" || value == null || value == undefined || (value != null && typeof value == "object" && !Object.keys(value).length)){
			return true
		}else{
			return false
		}
	},
	//빈 값 check
	checkNull : (value)=>{
		if(value === null || value === undefined){
			return true;
		}

		if(typeof value === 'string' && value.length === 0){
			return true
		}

		if(typeof value === 'object' && Object.keys(value).length == 0){
			return true
		}

		return false;
	},
	//오른쪽 패딩
	rightPad : (data,width)=>{
		data = data + '';
		return data.length >= width ? data : new Array(width - data.length + 1).join('0') + data;
	},
	//왼쪽 패딩
	leftPad : (data,width)=>{
		data = data + '';
		return data.length >= width ? data : data + new Array(width - data.length + 1).join('0');
	},
	//문자열 교체
	replaceAll : (str, searchStr, replaceStr)=>{
			return str.split(searchStr).join(replaceStr);
	},
	//DatePicker
	datePicker : (targetId, type, changeFunc)=>{
		const datePickerProp = {
			dateFormat: 'yy-mm-dd', //달력 날짜 형태
			showMonthAfterYear: true, // 월-년 순서가 아닌 년도-월 순서
			changeYear: true, // Option값 년 선택 가능
			changeMonth: true,// Option값 월 선택 가능
			yearSuffix: "년", // 달력의 년도 부분 뒤 텍스트
			monthNamesShort: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
			dayNamesMin: ['일','월','화','수','목','금','토'],
			yearRange: 'c-200:c+10',
		}
		
		if(type === "MONTH"){
			datePickerProp.dateFormat = "yy-mm";
			datePickerProp.beforeShow = function(){
				datePickerProp.selectedDateVl = $("#"+targetId).val();
				var selectDate = $("#"+targetId).val().split("-");
				var year = Number(selectDate[0]);
				var month = Number(selectDate[1]);
				$(this).datepicker("option","defaultDate",new Date(year, month-1, 1));
				
				$("#ui-datepicker-div").addClass("hidedays");
			};
			datePickerProp.onClose = function(dateText, inst){
				var month = $("#ui-datepicker-div .ui-datepicker-month :selected").val();
				var year =  $("#ui-datepicker-div .ui-datepicker-year :selected").val();
				$(this).datepicker("option","defaultDate",new Date(year, month, 1));
				$(this).datepicker("setDate", new Date(year, month, 1));
				
				$("#ui-datepicker-div").removeClass("hidedays");
				
				// 월 선택시 onchange 이벤트 트리거
				if($("#"+targetId).val() !== datePickerProp.selectedDateVl)
					$("#"+targetId).change();
			};
		}
		datePicker = new $("#"+targetId).datepicker(datePickerProp).datepicker("setDate",new Date());
		datePicker[0].onchange = function(event){
			if(typeof changeFunc === 'function') {
				changeFunc(event.target, event.target.value);
			}
			
			// 숫자, 하이픈 외 빈문자 치환
			$(event.target).val($(event.target).val().replace(/[^0-9-]/g,''));
			if($(event.target).val()) {
				const dateVl = $(event.target).val().replaceAll("-",'');
				let validDt = "";
				let formatDt = "";
				if(type === "MONTH"){
					validDt = dateVl + "01";
					formatDt = "YYYY-MM";
				} else {
					validDt = dateVl;
					formatDt = "YYYY-MM-DD";
				}
				if(moment(validDt).isValid() && validDt.length === 8) {
					$(event.target).val(moment(validDt).format(formatDt));
				}else {
					$(event.target).val(moment().format(formatDt));
				}
			}
		}
	},
	dateRangeValid : function(strDtId, endDtId, msg) {
		var dateRangePreviousVl = "";
		$("#"+strDtId).on('focus', function(){
			dateRangePreviousVl = this.value;
		}).on('change', function(event){
			if(moment($("#"+endDtId).val()).isBefore(this.value)){
				// 종료일이 시작일보다 크다면 이전 값으로 되돌림
				this.value = dateRangePreviousVl;
				if(msg) $.alert(msg);
			}
		});
		$("#"+endDtId).on('focus', function(){
			dateRangePreviousVl = this.value;
		}).on('change', function(event){
			if(moment(this.value).isBefore($("#"+strDtId).val())){
				// 종료일이 시작일보다 크다면 이전 값으로 되돌림
				this.value = dateRangePreviousVl;
				if(msg) $.alert(msg);
			}
		});
	},

	/**
	 * 마스킹 정책
	 * 
	 * 성명 - 송**(두 번째 글자 이상 마스킹)
	 * 생년월일 - ******(전체마스킹)
	 * 전화번호/휴대폰번호 - 010-1234-****(마지막 4자리)
	 * 주소 - 서울시 광진구 ****** 345
	 * 
	 */
	maskingFunc : {
		//성명 마스킹 - 송**(두 번째 글자 이상 마스킹) -> Utility.maskNameDh() 사용
		name : (inputName)=>{
			
			if(cmmUtil.checkNull(inputName) == true || typeof(inputName) != "string" || inputName.length <= 1){
				return null;
			}
			
			const firstChar = inputName.charAt(0);
			const maskedPart = "*".repeat(inputName.length - 1);
			const maskedName = firstChar + maskedPart;
			
			return maskedName;
		},
		//생년월일 마스킹 - ******(전체마스킹)
		birth : (inputBirth)=>{
			// 정규표현식 패턴: 6자리 숫자 형식(YYMMDD)
			const regexPattern = /^(\d{6})$/;	
			const numberOnly = inputBirth.replace(/\D/g,"");
			const maskedBirthday = "******";
	
			if(!regexPattern.test(numberOnly)){
				return null
			}
	
			return maskedBirthday;
		},
		//휴대폰번호 마스킹 - 010-1***-2***
		phoneNum : (inputPhoneNum)=>{
			if(cmmUtil.checkNull(inputPhoneNum) == true || inputPhoneNum.length <= 1){
				return null;
			}
			
			const regexPattern = /^\d{10,11}$/;
			const numberOnly = inputPhoneNum.replace(/\D/g,"");

			if(!regexPattern.test(numberOnly)){
				return null
			}
			
			const firstPart = numberOnly.slice(0, 3);
			const midLen = numberOnly.length === 11 ? 4 : 3;
			const secondPart = numberOnly.slice(3, 3 + midLen);
			const thirdPart = numberOnly.substring(3 + midLen);
			
			const mask = (str) => str[0] + '*'.repeat(str.length -1);
	
			return `010-${mask(secondPart)}-${mask(thirdPart)}`;
		},
		ipAddress : (inputIpAddress)=>{
			//IPv4 주소 패턴
			const ipv4Pattern = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;
			//IPv6 주소 패턴
			const ipv6Pattern = /^([0-9a-fA-F:]+)$/;

			if(ipv4Pattern.test(inputIpAddress)){
				const [octec1, octec2, octec3, octec4] = inputIpAddress.split(".").map(Number);
				return `${octec1}.****.${octec3}.${octec4}`;
			}else if(ipv6Pattern.test(inputIpAddress)){
				inputIpAddress.split(".").map(Number);
				return;
			}else{
				//IPv4 or IPv6 형식이 아니면 null 반환
				return null;
			}
		},
		actNo : (inputActNo)=>{
			if(cmmUtil.checkNull(inputActNo) == true || inputActNo.length <= 1){
				return null;
			}
			
			const sInputActNo = inputActNo.replace(/-/g, "");
			if(sInputActNo.length <= 5) {
				return "*".repeat(sInputActNo.length);
			}
			
			const maskedActNo = sInputActNo.slice(0, sInputActNo.length - 5) + "*".repeat(5);
			
			if(inputActNo.includes("-")) {
				let resultStr = "";
				let index = 0;
				
				for(let i = 0; i < inputActNo.length; i++) {
					if(inputActNo[i] === "-") {
						resultStr += "-";
					}
					else {
						resultStr += maskedActNo[index];
						index++;
					}
				}
				return resultStr;
			}
			else {
				return maskedActNo;
			}
		}
	},
	/*====================================================================
	 * 함수명(컴포넌트명): openPopUp
	 * 설  명 : layerPopup 호출
	 * 사용예 : cmmUtil.openPopUp('targetId', 'popUpURL', paramObj, option);
	 *====================================================================*/
	openLayerPopup : function(targetId, popUpURL, paramObj, opt, returnId){
		$("#"+targetId).remove();
		sessionStorage.setItem(targetId, JSON.stringify(paramObj));
		var popupWrap = $("<div>", {
			"class" : "popup-wrap",
			"id" : targetId
		}).appendTo("body");
		
		var popupLayer = $("<div>", {
			"class" : "pop-up",
			"tabindex": "0",
			"role": "dialog",
			"aria-modal": "true",
			"aria-label": ""
		}).appendTo("#" + targetId);
		
		if(opt) {
			if(opt.isStatic){
				// 임시 미개발
				// 백드롭 클릭 Close 방지여부
				//popupLayer.attr("data-coreui-backdrop", "static");
			}
		}
		var backDrop = $("<div>", {
			"class" : "popup-bg over backdropPop"
		}).appendTo("#" + targetId);
		
		popUpURL += "?isModal=true";
		if(targetId == "LottoyWnAplyP") {
			popUpURL = popUpURL + "&ltGdsCd=" + paramObj.ltGdsCd + "&ntslOrdrNo=" + paramObj.ntslOrdrNo + "&ltPblcnSn=" + paramObj.ltPblcnSn;
		}
		$('.container-box').append($("#" + targetId));
		$("#" + targetId + " .pop-up").load(popUpURL, function(){
			const targetIdTot = "Lotto645TicketP;Pt720TicketP;LramSmamP;LottoyWnAplyP;Pt720WnAplyP;LottoyWnAplyCmptnP;LottoWaitConnectP";
			$("#" + targetId).addClass('on');
			if(targetIdTot.indexOf(targetId) < 0) {
				cmmUtil.initPopUpLayer(targetId, opt, returnId);
			}
			var $popTitle = $("#" + targetId).find(".pop-head-tit");
			var $istitle = $popTitle.is(":visible");
			if($istitle){
				$popTitle.attr('tabindex',"0").focus();
			} 
			cmmUtil.focusReturn(targetId);
		});
		$(".btn-goUp").hide();
		
	},
	/*====================================================================
	 * 함수명(컴포넌트명): focusReturn
	 * 설  명 : 웹접근성, 레이어팝업 포커스 이동제어
	 * 사용예 : cmmUtil.focusReturn('targetId');
	 *====================================================================*/
	focusReturn: function(targetId) {
		const $popup = $("#"+targetId).find(".pop-up-wrapper"); 
	    const $focusable = $popup.find(
	        'a[href], button, textarea, input[type="text"], input[type="radio"], ' +
	        'input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
	    ).filter(':visible');

	    // 첫번째/마지막 포커스 요소
	    const $first = $focusable.first();
	    const $last  = $focusable.last();
		
		$popup.on('keydown', function (e) {
			if (e.key === 'Tab') {
				if (e.shiftKey) {
					// Shift + Tab : 첫 요소에서 뒤로 가면 마지막으로
					if (document.activeElement === $first[0]) {
						e.preventDefault();
						$last.focus();
					}
				} else {
					// Tab : 마지막 요소에서 앞으로 가면 첫 요소로
					if (document.activeElement === $last[0]) {
						e.preventDefault();
						$first.focus();
					}
				}
			}
		});
	    	
	},
	/*====================================================================
	 * 함수명(컴포넌트명): openClientLayerPopup
	 * 설  명 : layerPopup 호출
	 * 사용예 : cmmUtil.openClientLayerPopup('targetId', 'opt', htmlContent);
	 *====================================================================*/
	openClientLayerPopup: function(targetId, opt, htmlContent) {
	  $("#" + targetId).remove(); // 중복 방지
	
	  var popupWrap = $("<div>", {
	    class: "popup-wrap",
	    id: targetId
	  }).appendTo("body");
	
	  var popupLayer = $("<div>", {
	    class: "pop-up",
	    css: {
	      width: opt.width || 400,
	      height: opt.height || 200,
	      background: "#fff",
	      padding: "20px",
	      borderRadius: "8px",
	      zIndex: 10001,
	      position: "relative"
	    }
	  }).appendTo("#" + targetId);
	
	  $("<div>", {
	    class: "popup-bg",
	    css: {
	      position: "fixed",
	      top: 0, left: 0, width: "100%", height: "100%",
	      background: "rgba(0,0,0,0.3)",
	      zIndex: 10000
	    }
	  }).appendTo("#" + targetId);
	
	  popupLayer.html(htmlContent);
	  $("#" + targetId).addClass("on");
	},
	/*====================================================================
	 * 함수명(컴포넌트명): moveLayer
	 * 설  명 : 페이지 이동 호출
	 * 사용예 : cmmUtil.moveLayer('targetId', 'popUpURL', paramObj);
	 *====================================================================*/
	moveLayer : function(targetId, popUpURL, paramObj){
		sessionStorage.setItem(targetId, JSON.stringify(paramObj));
		location.href = popUpURL;
		
		setTimeout(function() {
			sessionStorage.clear(targetId);
		}, 2000);
	},
	moveWindow : function(winPop){
		let paramStr = "";
		if(cmmUtil.isObjEmpty(winPop.param)) winPop.param = new Object();
		
		winPop.param.globalParamMenu = window.location.pathname;
		
		paramStr = cmmUtil.paramToGetStr(winPop.param, "N");	// 파라미터 암호화 안함
		location.href = winPop.url+paramStr;
	},
	/*====================================================================
	 * 함수명(컴포넌트명): openWindow
	 * 설  명 : 윈도우 페이지 팝업 호출
	 * 사용예 : cmmUtil.openWindow(winPop);
	 * winPop = {
	 *	url : "/po/samplemng/sample/SampleRegP",
	 *	param : {userId: "userId"},
	 *	name : "edit",
	 *	option : "width=500, height=500, left=550, top=40, toolbar=no, menubar=no, location=no scrollbars=1"
	 * }
	 *====================================================================*/
	openWindow : function(winPop){
		let paramStr = "";
		if(cmmUtil.isObjEmpty(winPop.param)) winPop.param = new Object();
		
		winPop.param.globalParamMenu = window.location.pathname;
		
		paramStr = cmmUtil.paramToGetStr(winPop.param, "N");	// 파라미터 암호화 안함
		window.open(winPop.url+paramStr, winPop.name, winPop.option);
	},
	initPopUpLayer : function(targetId, opt, returnId){
		sessionStorage.clear(targetId);
		
		if(opt){
			if(opt.width){
				$("#" + targetId).find('.pop-up-wrapper').addClass(opt.width);
			}
		}
		
		$("#"+targetId+" .btn-pop-close").on('click', function (e) {
			$("#"+targetId).remove();
			cmmUtil.dropBackModal();
			$(".btn-goUp").show();
			if(returnId == 'viewDetail'){
				$(`[data-return="${returnId}"]`).focus().removeAttr('data-return');
			}else{
				$("#" + returnId).focus();
			}
			
		});
		
		cmmUtil.dropBackModal();
		
		$('html').css("overflow-y","hidden");
	},
	dropBackModal : function(){
		// 모달 중북 호출/닫길 시 가장 최근 팝업만 fade 밖으로 나올 수 있게 조정
		$(".popup-wrap.on").each((i,el) => {
			if($(".popup-wrap.on").length - 1 ===  i){
				$("#"+el.id).css("z-index","1002"); // 보임
			} else {
				$("#"+el.id).css("z-index","1000"); // 비활성영역으로 들어감
			}
		});
		
		if($(".popup-wrap.on").length === 0) {
			$(".backdropPop").remove();
			$('html').css("overflow-y","unset");
		}
	},
	getDate : function(offsetDays){
		// 현재 날짜와 시간 객체 생성
		if(!offsetDays) offsetDays = 0;
		
		// 날짜에 오프셋 적용
		var today = new Date();
		today.setDate(today.getDate() + offsetDays);
		
		// 년,월,일 가져오기
		var year = today.getFullYear();
		var month = today.getMonth() + 1;
		var day = today.getDate();
		
		// 월,일,시,분,초가 한 자리 수인 경우 두 자리로 변환
		if(month < 10) month = '0'+month;
		if(day < 10) day = '0'+day;
		
		// 오늘 날짜와 시간 문자열로 출력
		var formattedDate = year + '-' + month + '-' + day;
		
		return formattedDate;
	},
	getMonth : function(offsetMonths){
		// 현재 날짜와 시간 객체 생성
		if(!offsetMonths) offsetMonths = 0;
		
		// 날짜에 오프셋 적용
		var today = new Date();
		today.setMonth(today.getMonth() + offsetMonths);
		
		// 년,월,일 가져오기
		var year = today.getFullYear();
		var month = today.getMonth() + 1;
		var day = today.getDate();
		
		// 월,일,시,분,초가 한 자리 수인 경우 두 자리로 변환
		if(month < 10) month = '0'+month;
		if(day < 10) day = '0'+day;
		
		// 오늘 날짜와 시간 문자열로 출력
		var formattedDate = year + '-' + month + '-' + day;
		
		return formattedDate;
	},
	getDateTime : function(offsetDays){
		// 현재 날짜와 시간 객체 생성
		if(!offsetDays) offsetDays = 0;
		
		// 날짜에 오프셋 적용
		var today = new Date();
		today.setDate(today.getDate() + offsetDays);
		
		// 년,월,일 가져오기
		var year = today.getFullYear();
		var month = today.getMonth() + 1;
		var day = today.getDate();
		
		// 시,분,초 가져오기
		var hours = today.getHours();
		var minutes = today.getMinutes();
		var seconds = today.getSeconds();
		
		// 월,일,시,분,초가 한 자리 수인 경우 두 자리로 변환
		if(month < 10) month = '0'+month;
		if(day < 10) day = '0'+day;
		if(hours < 10) hours = '0'+hours;
		if(minutes < 10) minutes = '0'+minutes;
		if(seconds < 10) seconds = '0'+seconds;
		
		// 오늘 날짜와 시간 문자열로 출력
		var formattedDateTime = year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
		
		return formattedDateTime;
	},
	formatDateTime : function(date){
		if(!date || typeof (date) != "string" || date.length < 8) return "";
		
		let formatDate = "";
		if(date.length === 8) {
			const year = date.slice(0, 4);
			const month = date.slice(4, 6);
			const day = date.slice(6, 8);
			formatDate = year +"-"+ month +"-"+ day +" "+"00"+":"+"00"+":"+"00";
		} else if(date.indexOf("-") > -1) {
			// yyyy-MM-dd -> 9시로 자동 지정 되어서 인위 값 지정
			date = (date.length === 10) ? date + " 00"+":"+"00"+":"+"00" : date;
			
			var getConvertDate = new Date(date);
			if(!getConvertDate) return "";
			
			formatDate = getConvertDate.getFullYear() + '-' +
							 ('0' + (getConvertDate.getMonth()+1)).slice(-2) + '-' +
							 ('0' + getConvertDate.getDate()).slice(-2) + ' ' +
							 ('0' + getConvertDate.getHours()).slice(-2) + ':' +
							 ('0' + getConvertDate.getMinutes()).slice(-2) + ':' +
							 ('0' + getConvertDate.getSeconds()).slice(-2);
		}
		return formatDate;
	},
	formatDate : function(date){
		if(!date || typeof (date) != "string" || date.length < 8) return "";
		
		let formatDate = "";
		if(date.length === 8) {
			const year = date.slice(0, 4);
			const month = date.slice(4, 6);
			const day = date.slice(6, 8);
			formatDate = year +"-"+ month +"-"+ day;
		} else if(date.indexOf("-") > -1) {
			// var fmDate = isNaN(date) ? date : Number(date);
			
			var getConvertDate = new Date(date);
			if(!getConvertDate) return "";
			
			formatDate = getConvertDate.getFullYear() + '-' +
						 ('0' + (getConvertDate.getMonth()+1)).slice(-2) + '-' +
						 ('0' + getConvertDate.getDate()).slice(-2);
		}
		return formatDate;
	},
	formatPhone : (inputPhoneNum)=>{
		const regexPattern = /^\d{10,11}$/;
		const numberOnly = inputPhoneNum.replace(/\D/g,"");

		if(!regexPattern.test(numberOnly)){
			return inputPhoneNum;
		}
		const phoneSplitLenRegex = (numberOnly.length === 11) ?
				/^(\d{3})(\d{4})(\d{4})/ :
				/^(\d{2})(\d{4})(\d{4})/;
		const [firstPart, secondPart, thirdPart, fourthPart] = numberOnly.match(phoneSplitLenRegex);

		//phoneSplitLen-1234-5678
		return `${secondPart}-${thirdPart}-${fourthPart}`;
	},
	addComma :function(str){
		str = String(str);
		
		return str.replace(/(\d)(?=(?:\d{3})+(?!\d))/g, '$1,');
	},
	paramToGetStr: function(obj, encryptYn){
		const _encryptYn = (encryptYn) ? encryptYn : "Y";
		
		let reqData = Object.keys(obj).map(key => key+"="+obj[key]).join('&');
				
		if(_encryptYn === "Y" && !cmmUtil.isEmpty(reqData)
			&& !cmmUtil.isEmpty(rsaModulus) && !cmmUtil.isEmpty(publicExponent)){
			var rsa = new RSAKey();
			rsa.setPublic(rsaModulus, publicExponent);
			reqData = "encData="+rsa.encrypt(reqData);
		}
		
		return "?" + reqData;
	},
	//필수값 체크
	validate : function(targetEl, option){
		let autoFocus = false;
		if(typeof (option) == "object"){
			autoFocus = option.autoFocus ? option.autoFocus : false;
		}
		const targetName = $(targetEl).prop("tagName");
		var rtn = true;
		if(targetName == "FORM"){
			// 검증 대상이 form 일 경우
			targetEl.find("input,select,textarea").not("[type=image],[type=submit],[type=button]").each(function() {
				rtn = cmmUtil.commonValid(this, autoFocus);
				if(!rtn) return false;
			});
		} else if(targetName == "INPUT"){
			// 검증 대상이 input 일 경우
			rtn = cmmUtil.commonValid(targetEl, autoFocus);
		} else {
//			console.log("cmmUtil.validate 현재 검증 대상으로 지원하지 않음 : ",targetEl);
		}
		
		if(rtn){
			for(var i in fileUtil.fileConfig){
				// 첨부파일 검증
				if(fileUtil.fileConfig[i].require){
					var count = fileUtil.fn.getFileCnt(fileUtil.fileConfig[i].targetId);
					if(count < 1){
						const targetElement = $("#"+fileUtil.fileConfig[i].targetId+" input");
						
						cmmUtil.createValidMsg(targetElement[0]
								,fileUtil.fileConfig[i].fileNm+"을(를) 등록해 주세요.");
						
						if(autoFocus) $("#"+fileUtil.fileConfig[i].targetId).attr("tabindex", -1).focus();
						
						rtn = false;
						return false;
					}
				}
			}
		}
		
		return rtn;
	},
	createValidMsg: function(targetElement, msg){
		cmmUtil.clearValidMsg($("#"+targetElement.id));
		
		const msgEl = document.createElement("div");
		msgEl.className = "valid";
		msgEl.innerText = msg;
		targetElement.parentNode.appendChild(msgEl);
		
		cmmUtil.labelValidClass(targetElement, false);
	},
	labelValidClass: function(targetElement, isValid){
		const addClassName = (isValid) ? " success" : " fail";
		const removeClassName = (isValid) ? " fail" : "";
		$(targetElement).parent().attr("class"
				, $(targetElement).parent().attr("class").replaceAll(removeClassName,""));
		$(targetElement).parent().attr("class"
				, $(targetElement).parent().attr("class")+ addClassName);
	},
	clearValidMsg: function(unit){
		const elementId = $(unit).attr("id");
		// 기존 메시지 삭제
		if(!cmmUtil.isEmpty(elementId)){
			const targetElement = document.getElementById(elementId);
			
			$("#"+elementId).parent().find(".valid").each(function() {
				$(this).remove();
			});
		}
	},
	commonValid: function(unit, autoFocus){
		let rtn = true;
		var require = $(unit).attr("require");
		var inputNm = $(unit).data("input-nm");
		var min = $(unit).attr("min");
		var max = $(unit).attr("max");
		var minLen = $(unit).attr("minlength");
		var inputType = $(unit).attr("type");
		var inputLang = $(unit).data("text-rule");
		const elementId = $(unit).attr("id");
		const targetElement = document.getElementById(elementId);
		$(unit).val($(unit).val().trim());
		
		if(!cmmUtil.isEmpty(require) && require == "true"){
			if(inputType == 'radio'){
				var cnt = $(":input:radio[name="+$(unit).attr("name")+"]:checked").length;
				if(cnt == 0){
					cmmUtil.createValidMsg(targetElement
							,inputNm+"을(를) 선택해 주십시오.");
					if(autoFocus) $(unit).closest('div').attr("tabindex", -1).focus();
					
					rtn = false;
					return rtn;
				}
			}else if(inputType == 'checkbox'){
				var cnt = $(":input:checkbox[name='"+$(unit).attr("name")+"']:checked").length;
				if(cnt == 0){
					cmmUtil.createValidMsg(targetElement
							, inputNm+"을(를) 체크해 주십시오.");
					if(autoFocus) $(unit).closest('div').attr("tabindex", -1).focus();
					
					rtn = false;
					return rtn;
				}
			}else{
				if(cmmUtil.isEmpty($(unit).val())){
					cmmUtil.createValidMsg(targetElement
							, inputNm+"을(를) 입력해 주십시오.");
					if(autoFocus) $(unit).focus();
					
					var elementPosition = targetElement.getBoundingClientRect().top;
					var headerH = 96;
					if(window.innerWidth < 1440) {
						headerH = 110;
					}
					window.scrollTo({ behavior : 'smooth', top: elementPosition + window.pageYOffset - headerH });
					
					rtn = false;
					return rtn;
				}
			}
		}
		if( inputType === "number" ) {
			if(cmmUtil.isEmpty($(unit).val())){
				$(unit).val(0);
			} else {
				$(unit).val(Number($(unit).val()));
			}
			
			if(!cmmUtil.isEmpty(min) && !cmmUtil.isEmpty(max)){
				if(Number($(unit).val()) < Number(min) ||
						Number($(unit).val()) > Number(max) ){
					cmmUtil.createValidMsg(targetElement
							, "입력값은 "+min+" 이상 "+max+" 이하여야 합니다.");
					if(autoFocus) $(unit).focus();
					
					rtn = false;
					return rtn;
				}
			}
			if(!cmmUtil.isEmpty(min)){
				if(Number($(unit).val()) < Number(min)){
					cmmUtil.createValidMsg(targetElement
							,"입력값이 너무 작습니다. 입력값은 "+min+"보다 크거나 같아야 합니다.");
					if(autoFocus) $(unit).focus();
					
					rtn = false;
					return rtn;
				}
			}
			if(!cmmUtil.isEmpty(max)){
				if(Number($(unit).val()) > Number(max)){
					cmmUtil.createValidMsg(targetElement
							, "입력값이 너무 큽니다. 입력값은 "+max+"보다 작거나 같아야 합니다.");
					if(autoFocus) $(unit).focus();
					
					rtn = false;
					return rtn;
				}
			}
		}
		if(inputLang && inputLang.length){
			const typeChkArr = inputLang;
			const regExSpace = typeChkArr.includes("space") ? "\\s" : "";
			let rtnMsg = "";
			let regEx = "";
			
			let regTest = "";
			regTest += typeChkArr.includes("en") ? "A-Za-z" : "";
			regTest += typeChkArr.includes("kr") ? "ㄱ-ㅎㅏ-ㅣ-가-힣" : "";
			regTest += typeChkArr.includes("num") ? "0-9" : "";
			regTest += typeChkArr.includes("space") ? "\\s" : "";
			regTest += typeChkArr.includes("special") ? "`~!@#$%^&*()-=+_" : "";
			
			if(["en","kr","num","special"].every(r => typeChkArr.includes(r))){
				rtnMsg = cmmUtil.isEmpty(regExSpace) ? 
						"한글/영문, 숫자, ~!@#$%^&*()-=+_ 특수문자 외 공백을 포함한 문자를 허용하지 않습니다." :
						"한글/영문, 숫자, ~!@#$%^&*()-=+_ 특수문자만 사용 가능합니다.";
				regEx = "^["+regTest+"]*$";
			} else if(["en","num","special"].every(r => typeChkArr.includes(r))){
				rtnMsg = cmmUtil.isEmpty(regExSpace) ? 
						"영문, 숫자, ~!@#$%^&*()-=+_ 특수문자 외 공백을 포함한 문자를 허용하지 않습니다." :
						"영문, 숫자, ~!@#$%^&*()-=+_ 특수문자만 사용 가능합니다.";
				regEx = "^["+regTest+"]*$";
			} else if(["kr","num","special"].every(r => typeChkArr.includes(r))){
				rtnMsg = cmmUtil.isEmpty(regExSpace) ? 
						"한글, 숫자, ~!@#$%^&*()-=+_ 특수문자 외 공백을 포함한 문자를 허용하지 않습니다." :
						"한글, 숫자, ~!@#$%^&*()-=+_ 특수문자만 사용 가능합니다.";
				regEx = "^["+regTest+"]*$";
			} else if(["en","kr","num"].every(r => typeChkArr.includes(r))){
				rtnMsg = cmmUtil.isEmpty(regExSpace) ? 
						"한글/영문, 숫자 외 공백을 포함한 문자를 허용하지 않습니다." :
						"한글/영문, 숫자만 사용 가능합니다.";
				regEx = "^["+regTest+"]*$";
			} else if(["en","kr"].every(r => typeChkArr.includes(r))){
				rtnMsg = cmmUtil.isEmpty(regExSpace) ? 
						"한글/영문 외 공백을 포함한 문자를 허용하지 않습니다." :
						"한글/영문만 사용 가능합니다.";
				regEx = "^["+regTest+"]*$";
			} else if(["en","num"].every(r => typeChkArr.includes(r))){
				rtnMsg = cmmUtil.isEmpty(regExSpace) ? 
						"영문/숫자 외 공백을 포함한 문자를 허용하지 않습니다." :
						"영문/숫자만 사용 가능합니다.";
				regEx = "^["+regTest+"]*$";
			} else if(["kr","num"].every(r => typeChkArr.includes(r))){
				rtnMsg = cmmUtil.isEmpty(regExSpace) ? 
						"한글/숫자 외 공백을 포함한 문자를 허용하지 않습니다." :
						"한글/숫자만 사용 가능합니다.";
				regEx = "^["+regTest+"]*$";
			} else if(typeChkArr.includes("en")){
				rtnMsg = cmmUtil.isEmpty(regExSpace) ? 
						"영문 외 공백을 포함한 문자를 허용하지 않습니다." :
						"영문만 사용 가능합니다.";
				regEx = "^["+regTest+"]+$";
			} else if(typeChkArr.includes("kr")){
				rtnMsg = cmmUtil.isEmpty(regExSpace) ? 
						"한글 외 공백을 포함한 문자를 허용하지 않습니다.":
						"한글만 사용 가능합니다.";
				regEx = "^["+regTest+"]*$";
			} else if(typeChkArr.includes("num")){
				rtnMsg = cmmUtil.isEmpty(regExSpace) ? 
						"숫자 외 공백을 포함한 문자를 허용하지 않습니다.":
						"숫자만 사용 가능합니다.";
				regEx = "^["+regTest+"]*$";
			} else {
				alert("en,kr,num 타입을 기본적으로 사용하며, 타입 별 문구 추가 필요시 요청 바랍니다.");
				rtn = false;
				return rtn;
			}
			
			if(!RegExp(regEx).test($(unit).val())){
				cmmUtil.createValidMsg(targetElement, rtnMsg);
				if(autoFocus) $(unit).focus();
				
				rtn = false;
				return rtn;
			}
		}
		if(!cmmUtil.isEmpty(minLen)){
			if($(unit).val().length < Number(minLen)){
				cmmUtil.createValidMsg(targetElement
						, "글자수가 너무 작습니다. 최소 글자수는 "+minLen+"자 입니다.");
				if(autoFocus) $(unit).focus();
				
				rtn = false;
				return rtn;
			}
		}
		
		cmmUtil.clearValidMsg($("#"+targetElement.id));
		cmmUtil.labelValidClass(targetElement, true);
		return rtn;
	},
	validateCustom: function(unit, msg, rtn, option){
		let autoFocus = false;
		if(typeof (option) == "object"){
			autoFocus = option.autoFocus ? option.autoFocus : false;
		}
		
		const elementId = $(unit).attr("id");
		const targetElement = document.getElementById(elementId);
		
		if(!rtn){
			if(cmmUtil.isEmpty(elementId)){
				$.alert(msg);
			}else{
				cmmUtil.labelValidClass(targetElement, false);
				
				cmmUtil.createValidMsg(targetElement, msg);
				if(autoFocus) $("#"+elementId).focus();
			}
		}else {
			cmmUtil.labelValidClass(targetElement, true);
		}
		
		return rtn;
	},
	nvl : function(v, s){
		if(cmmUtil.isEmpty(v)){
			return s
		}else{
			return v
		}
	},
	//공통코드 Json
	cmCodeJson : function(cmnsGroupCd,flterCdArr,callBackFunc){
		var jsonData = new Object();
		var param = {
			'cmnsGroupCd' : cmnsGroupCd,
		};
		if(!cmmUtil.isEmpty(flterCdArr)){
			param.flterCdArr = flterCdArr;
		}
		
		var reqOption = {
			 "method": "GET",
			 "async" : false		// 동기식 조회
		};
		
		ajaxUtil.sendHttpJson(param, '/sy/selectCmnsCd.do', reqOption, function(code, msg, {data}){
			jsonData = data.list;
			if( jsonData && jsonData.length ){
				jsonData = jsonData.map((d,i) => {
					d.value = d.cmnsCd;
					d.text = d.cmnsCdNm;
					return d;
				})
			}
		});

		if(typeof (callBackFunc) == "function"){
			callBackFunc.call(this, jsonData);
		}

		return jsonData;
	},
	//공통코드 레이아웃
	cmCodeHelpers : function(boxType, boxId, divObj, result, option){
		var html = '';
		var require = '';
		var inputNm = '';
		var className = '';
		var hasAll = false;
		
		if(typeof (option) == "object"){
			if(option.require){
				require = 'require=true';
				inputNm = option.dataInputNm;
			}
			hasAll = option.hasAll;
		}

		if(typeof hasAll === 'boolean' && hasAll && typeof result === 'object'){
			result.unshift({text: '전체', value: ''});
		}
		
		if(boxType == "S"){
			className = (option.className) ? option.className : "form-select select-md";
			html += '<select id="'+boxId+'" name="'+boxId+'" class="'+className+'" '+require+' data-input-nm='+inputNm+'>';
			if(result != '')
			{
				$.each(result, function(k, v) {
					if(v.value == option.selectedValue){
						html += '<option value="' + v.value + '" selected>' + v.text + '</option>';
					}else{
						html += '<option value="' + v.value + '">' + v.text + '</option>';
					}
				});
			}
			html += '</select>';
			
		}else if(boxType == "C"){
			if(result != '')
			{
				className = (option.className) ? option.className : "form-check";
				$.each(result, function(k, v) {
					var checked = ''; 
					if(option.selectedValue){
						var slcVal = option.selectedValue.split(',')
						checked = '';
						$.each(slcVal, function(sK, sV) {
							if(v.value == sV){
								checked = 'checked'; 
							}
						});
					}
					html += '<div class="'+className+' '+className+'-flex'+' pe-3">';
					html += 	'<input class="'+className+'-input" type="checkbox" id="'+boxId+k+'" name="'+boxId+'[]" value="' + v.value + '" '+require+' data-input-nm="'+inputNm+'" '+checked+'>';
					html += 	'<label for="'+boxId+k+'" class="'+className+'-label">' + v.text + '</label>';
					html += '</div>';
				});
				
			}
		}else if(boxType == "R"){
			if(result != ''){
				className = (option.className) ? option.className : "form-check";
				$.each(result, function(k, v) {
					var checked = '';
					if(v.value == option.selectedValue){
						checked = 'checked';
					}
					html += '<div class="'+className+' '+className+'-flex'+'">';
					html += '<input type="radio" id="'+boxId+k+'" class="'+className+'-input" name="'+boxId+'" value="' + v.value + '" '+require+' data-input-nm="'+inputNm+'" '+checked+'>';
					html += '<label for="'+boxId+k+'" class="'+className+'-label">' + v.text + '</label>';
					html += '</div>';
				});
			}
		}
		$("#"+divObj).append(html);
	},
	// use overlay start
	setLoadingOverlay : function() {
		var html = '';
		html += '<div class="popup-bg over loadingOverlay" style="display:none;"></div>';
		$('body').prepend(html);
	},
	showLoadingOverlay : function() {
		$('.loadingOverlay').show();
	},
	hideLoadingOverlay : function() {
		setTimeout(function() {
			$('.loadingOverlay').hide();
		}, 500);
	},
	// use overlay end
	// 엑셀 다운로드 로딩
	loadOverlayTrigger : function(callBackFunc) {
		if( typeof cmmUtil.downFsh == 'undefined' || !cmmUtil.downFsh ){
			cmmUtil.showLoadingOverlay();
			document.cookie = "downFsh=" + escape('N') + "; expires=-1;path=/;";
			cmmUtil.downFsh = setInterval(() => cmmUtil.loadOverlayTrigger(), 1000);
		} else if(cmmUtil.getCookie('downFsh') == 'Y'){
			cmmUtil.hideLoadingOverlay();
			clearInterval(cmmUtil.downFsh);
			cmmUtil.downFsh = null;

			if(typeof (callBackFunc) == "function"){
				callBackFunc.call(this);
			}
		}
	},
	getCookie : function(cookieName) {
		var cookieString = document.cookie;
		var cookies = cookieString.split(';');
		for(var i=0; i < cookies.length; i++){
			var cookie = cookies[i].trim();
			var cookieParts = cookie.split('=');
			var name = cookieParts[0];
			var value = cookieParts[1];
			if(name === cookieName) {
				return value;
			}
		}
	},
	isObjEmpty(obj){
		for(let key in obj){
			return false;
		}
		return true;
	},
	getUriParameter(name){
		name = name.replace(/[\[]/,"\\[").replace(/[\]]/,"\\]");
		var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
		var results = regex.exec(location.search);
		return ( results === null ) ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
	},
	// Xss 변경된 문자 복호화
	getCleanStr(str){
		str = str.replaceAll("&lt;","<").replaceAll("&gt;",">");
		str = str.replaceAll("&amp;","&");
		str = str.replaceAll("&quot;","\"").replaceAll("&apos;","'");
		str = str.replaceAll("&#40;","(").replaceAll("&#41;",")");
		str = str.replaceAll("&#35;","#");
		return str;
	},
	dataRefine(data){
		if(data) {
			if(Array.isArray(data)){
				data.forEach((dValue, idx) => {
					dValue = cmmUtil.dataRefine(dValue);
					data[idx] = dValue;
				});
			} else if(typeof data === "object") {
				Object.keys(data).forEach(key => {
					const dValue = cmmUtil.dataRefine(data[key]);
					data[key] = dValue;
				});
			} else if(typeof data === "string") {
				data = cmmUtil.getCleanStr(data);
			}
		}
		return data;
	},
	//서버 프로퍼티 정보 조회
	getServerProperties : function(callBackFunc){
		let propData = new Object();
		var param = {
		};
		
		var reqOption = {
			 "method": "GET",
			 "async" : true
		};
		
		ajaxUtil.sendHttpJson(param, '/sy/getServerPropInfo.do', reqOption, function(code, msg, {data}){
			if( data ){
				const propInfo = data;
				if(typeof (callBackFunc) == "function"){
					callBackFunc.call(this, propInfo);
				}
			}
		});
		return propData;
	},
	// 모바일 도메인 확인 
	isMobileDomain : function(){
		var host = window.location.hostname;
		var domainM = cmmUtil.propInfo.poDomainM;
		
        return host.includes(domainM);
	},
	// 사용하면 안되는 사용자 아이디 목록여부 체크
	isAllowedUserId : function(userIdVl) {
		const notUsedArr = ["webmaster","master","web","admin","ohmylotto","garosu","sgng","test","xwsh"
			,"halt","passwd","netstat","ifconfig","chown","chmod","chgrp","perl","tcsh","bash","ipconfig","del"
			,"rmdir","killall","wget","tftp","ping","eval","script","iframe","src"];
		let isAllowedUserId = true;
		for(let i=0; i < notUsedArr.length; i++) {
			if(userIdVl.indexOf(notUsedArr[i]) >= 0){
				isAllowedUserId = false;
				break;
			}
		}
		return isAllowedUserId;
	},
	getRsaModulus : function(){
		return new Promise(function(resolve, reject){
			const param = {}
			const options = {
				"method": "GET",
				"async" : true
			}
			ajaxUtil.sendHttpJson(param, "/login/selectRsaModulus.do", options, function(code, msg, {data}){
				if(data){
					var rsa = new RSAKey();
					rsa.setPublic(data.rsaModulus, data.publicExponent);
				
					resolve(rsa);
				} else {
					reject();
				}
			});
		});
	},
	// 회원 예치금 조회
	getUserMndp : function(callBackFunc){
		const param = {}
		const options = {
			"method": "GET",
			"async" : true
		}
		ajaxUtil.sendHttpJson(param, "/mypage/selectUserMndp.do", options, function(code, msg, {data}){
			let userMndp = new Object();
			if(data){
				userMndp = data.userMndp;
				const pntDpstAmt = userMndp && userMndp.pntDpstAmt ? userMndp.pntDpstAmt||0 : 0;
				const pntTkmnyAmt = userMndp && userMndp.pntTkmnyAmt ? userMndp.pntTkmnyAmt||0 : 0;
				const ncsblDpstAmt = userMndp && userMndp.ncsblDpstAmt ? userMndp.ncsblDpstAmt||0 : 0;
				const ncsblTkmnyAmt = userMndp && userMndp.ncsblTkmnyAmt ? userMndp.ncsblTkmnyAmt||0 : 0;
				const csblDpstAmt = userMndp && userMndp.csblDpstAmt ? userMndp.csblDpstAmt||0 : 0;
				const csblTkmnyAmt = userMndp && userMndp.csblTkmnyAmt ? userMndp.csblTkmnyAmt||0 : 0;
				const totalAmt = (pntDpstAmt-pntTkmnyAmt)+(ncsblDpstAmt-ncsblTkmnyAmt)+(csblDpstAmt-csblTkmnyAmt);
				userMndp.totalAmt = totalAmt||0;
				
				if(typeof (callBackFunc) == "function"){
					callBackFunc.call(this, userMndp);
				}
			}
			return userMndp;
		});
	},
	onTooltip: function(event) {
		const elTooltipBox = cmmUtil.findTooltipBox($(event.target).parent());
		$(elTooltipBox).addClass('on');
	},
	offTooltip: function(event) {
		const elTooltipBox = cmmUtil.findTooltipBox($(event.target).parent());
		$(elTooltipBox).removeClass('on');
	},
	findTooltipBox: function(target) {
		const elTooltipBox = $(target).find(".tooltip-box");
		if(elTooltipBox.length)
			return elTooltipBox;
		else
			return cmmUtil.findTooltipBox($(target).parent());
	},
	isMobile: function() {
		const mobile = /iPhone|iPad|Android|BlackBerry|Windows Phone/i.test(navigator.userAgent);
		
		var ipad = false;
		//if(navigator.maxTouchPoints >= 5) {
		//	ipad = true;
		//}
		
		return mobile || ipad;
	},
	isTimeBetween: function(startDate, endDate, diffDays) {
		if(moment(endDate).diff(moment(startDate), 'days') > diffDays) {
			return false;
		} else {
			return true;
		}
	}
}

cmmUtil.getServerProperties(function(propInfo){
	cmmUtil.propInfo = propInfo;
});

var pageUtil = {
	pagingInit : function(id, data, select_function) {
		const currentPage = data.pageNum || 0; // 현재 페이지
		const total = data.total || 0; // 총 레코드 수
		const recordCountPerPage = data.recordCountPerPage || 0; // ~개 씩 보기(한 페이지 내 데이터 갯수)
		const totalPage = Math.ceil(total/recordCountPerPage); // 총 페이지 갯수
		const pageCount = cmmUtil.isEmpty(data.pageCount) ? 10 : data.pageCount || 0;	// 노출 페이지 개수(하단 페이지 갯수)
		
		var startPage = Math.max(Math.floor((currentPage - 1) / pageCount) * pageCount + 1, 1);
		var endPage   = Math.min(startPage + pageCount - 1, totalPage);
		
		var prevPage = Math.max(startPage - 1, 1) ;
		var nextPage = Math.min(endPage + 1, totalPage);
		
		let pageHtml = "";
		if(total > 0) {
			pageHtml += "<nav class=\"board-page\">";
			pageHtml += 	"<input class=\"pageNum\" type=\"hidden\" value=\""+currentPage+"\">";
			pageHtml +=		"<ul class=\"pagination-ul\">";
			
			if(totalPage > pageCount && currentPage > pageCount) {
			//<!-- 페이지 이동 화살표 (가장 좌측) -->
				pageHtml += 		"<li class=\"page-item btn-arrow\">";
				pageHtml += 			"<a class=\"page-link\" href=\"javascript:pageUtil.searchPaging(1,"+select_function+")\" aria-label=\"Previous\">";
				pageHtml +=					"<figure>";
				pageHtml +=						"<img src=\"/resources/img/icon/icon-dubble-left-arrow.svg\" alt=\"처음페이지\">";
				pageHtml +=					"</figure>";
				pageHtml += 			"</a>";
				pageHtml += 		"</li>";
				//<!-- 페이지 이동 화살표 (좌측)-->
				pageHtml += 		"<li class=\"page-item btn-arrow\">";
				pageHtml += 			"<a class=\"page-link\" href=\"javascript:pageUtil.searchPaging("+prevPage+","+select_function+")\" aria-label=\"Previous\">";
				pageHtml +=					"<figure>";
				pageHtml +=						"<img src=\"/resources/img/icon/icon-single-left-arrow.svg\" alt=\"이전페이지\">";
				pageHtml +=					"</figure>";
				pageHtml += 			"</a>";
				pageHtml += 		"</li>";
			}
			
			// 페이징 리스트
			for( var i=startPage; i <= endPage; i++ ){
				const inActive = currentPage == i ? "on" : "";
				pageHtml += 		"<li class=\"page-item "+inActive+"\">";
				pageHtml += 			"<a class=\"page-link\" href=\"javascript:pageUtil.searchPaging("+i+","+select_function+")\">";
				pageHtml += 				i;
				pageHtml += 			"</a>";
				pageHtml += 		"</li>";
			}
			
			if(totalPage > pageCount && totalPage > endPage) {
				// <!-- 페이지 이동 화살표 (우측) -->
				pageHtml += 		"<li class=\"page-item btn-arrow\">";
				pageHtml += 			"<a class=\"page-link\" href=\"javascript:pageUtil.searchPaging("+nextPage+","+select_function+")\" aria-label=\"Next\">";
				pageHtml += 				"<figure>";
				pageHtml += 					"<img src=\"/resources/img/icon/icon-single-right-arrow.svg\" alt=\"다음페이지\">";
				pageHtml += 				"</figure>";
				pageHtml += 			"</a>";
				pageHtml += 		"</li>";
				//<!-- 페이지 이동 화살표 (가장우측) -->
				pageHtml += 		"<li class=\"page-item btn-arrow\">";
				pageHtml += 			"<a class=\"page-link\" href=\"javascript:pageUtil.searchPaging("+totalPage+","+select_function+")\" aria-label=\"Next\">";
				pageHtml += 				"<figure>";
				pageHtml += 					"<img src=\"/resources/img/icon/icon-dubble-right-arrow.svg\" alt=\"마지막페이지\">";
				pageHtml += 				"</figure>";
				pageHtml += 			"</a>";
				pageHtml += 		"</li>";
			}
				
			pageHtml += 	"</ul>";
			pageHtml += "</nav>";
		}
		$("#"+id).html(pageHtml);
		
		const target = document.querySelector(".content-inner-box");
		if(target) {
			target.scrollIntoView({
                behavior: 'smooth',
				block: 'end'
			});
		}
	},
	searchPaging : function(page, select_function) {
		if(typeof  (select_function) == "function"){
			select_function.call(this, page);
		}
	},
	recordCountPerPageInit : function(id, select_function) {
		$("#"+id).attr("class","form-select select-short");
		$("#"+id).attr("aria-label","select multiple");
		$("#"+id).attr("onclick","return false");
		
		var perHtml = "";
		perHtml += "<option value=\"10\" selected>10개</option>";
		perHtml += "<option value=\"20\">20개</option>";
		perHtml += "<option value=\"30\">30개</option>";
		perHtml += "<option value=\"50\">50개</option>";
		perHtml += "<option value=\"100\">100개</option>";
		
		$("#"+id).html(perHtml);
			
		if(typeof (select_function) == "function"){
			$("#"+id).on('change', function(){
				select_function.call(this);
			})
		}
	} 
}
