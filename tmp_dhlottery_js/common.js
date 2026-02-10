$(document).ready(function(){

// ====== gnb start ====== //
/*
 * // let headerLine = $('.header') let gnbTag = $('.gnb'); let depth1Box =
 * $('.gnb > .depth1-box'); let gnbBg = $('.gnb-bg'); let depth2Wrap =
 * $('.depth2-wrap'); var lastLst = $('.gnb > li:last-child .depth2-inbox >
 * li:last-child li:last-child');
 * 
 * depth1Box.each(function(){ var tagDepth01 = $(this).find('.a-depth1');
 * tagDepth01.on('mouseenter , focusin',function(){ var thisList =
 * $(this).siblings('.depth2-wrap'); depth2Wrap.removeClass('over');
 * gnbBg.addClass('over'); thisList.addClass('over');
 * $(".mypage-list-wrap").removeClass("open");
 * $(".ico-arrow").removeClass("on"); // headerLine.addClass('over'); }); });
 * lastLst.on('focusout',function(){ depth2Wrap.removeClass('over'); //
 * headerLine.removeClass('over'); gnbBg.removeClass('over'); });
 * gnbTag.on('mouseleave',function(){ depth2Wrap.removeClass('over'); //
 * headerLine.removeClass('over'); gnbBg.removeClass('over'); });
 */

	// 2025-11-14 gnb/접근성 수정(aria- 속성추가)
	const $logo = $('#d-logo > a')
	const $gnbTag = $('.gnb');
	const $depth1Box = $('.gnb .depth1-box');
	const $lastFocus = $depth1Box.last().find('.depth2-wrap a').last()
	const $gnbBg = $('.gnb-bg');
	
	// Aria 속성 닫기
	function closeAria($item) {
		$depth1Box.each(function() {
			const $link = $item.find('.a-depth1');
			const $depth2Wrap = $item.find('.depth2-wrap');
			$link.attr('aria-expanded', 'false');
			$depth2Wrap.attr('hidden', '')
		});
	}
	// 전체 닫기
	function closeAll() {
		$depth1Box.each(function () {
			closeAria($(this));
			$('.gnb .depth1-box .depth2-wrap').removeClass('over');
		});
		$gnbBg.removeClass('over');
	}
	$depth1Box.each(function() {
		const $item = $(this);
		const $link = $item.find('.a-depth1');
		const $depth2Wrap = $item.find('.depth2-wrap');

		if ($depth2Wrap.length) {
			$link.attr({
				'aria-haspopup': 'true',
				'aria-expanded': 'false'
			});
			$depth2Wrap.attr('hidden', '');
		}
		$item.on('mouseenter focusin', function() {
			closeAll();
			$link.attr('aria-expanded', 'true');
			$depth2Wrap.removeAttr('hidden').addClass('over');
			$gnbBg.addClass('over'); 
			// 마이페이지 닫기
			$(".mypage-list-wrap").removeClass("open");
			$(".ico-arrow").removeClass("on");
			
		});
		$depth2Wrap.find('a').on('focusout', function() {
			setTimeout(() => {
				if (!$depth2Wrap.find(':focus').length) {
					closeAria($item)
				}
			}, 100);
		});
		$item.on('mouseleave', function() {
			closeAria($item)
		});
	});
	
	$gnbTag.on('mouseleave',function(){
		setTimeout(() => {
			closeAll();
		},50);
	});
	$lastFocus.on('focusout', function() {
		setTimeout(() => {
			closeAll();
		},50);
	})
	$logo.on('focusin', function() {
		setTimeout(() => {
			closeAll();
		},50);
	});
	$(document).on('keydown', function(e) {
		if (e.key === 'Escape') {
			closeAll();
		}
	});


    /* 마이페이지 버튼 클릭 시 리스트 open */
    openMypageList();
    function openMypageList(){
        var btnMypage = $(".h-right-li.my-page .ico-arrow");
        btnMypage.on("click", function(e){
            e.preventDefault();
            if($(this).hasClass("on")){
                $(this).removeClass("on");
                $(this).closest(".h-right-a").siblings(".mypage-list-wrap").removeClass("open");
                $(this).focus();
            }else {
                $(this).addClass("on");
                $(this).closest(".h-right-a").siblings(".mypage-list-wrap").addClass("open").focus();

            }
        });
    }

// ====== gnb end ====== //

// ====== all-menu start ====== //
    let menuIcon = $('.btn-all-menu');
    let menuBox = $('.all-menu-box');
    let linkBox = $('.h-right-link');

    menuIcon.on('click', function(){
        if (menuBox.hasClass('active')) {
            menuBox.removeClass('active');
            menuIcon.removeClass('active');
            gnbTag.removeClass('active');
            linkBox.removeClass('active');
            $('html').css("overflow-y","unset");
            
        } else {
            menuBox.addClass('active');
            menuIcon.addClass('active');
            gnbTag.addClass('active');
            linkBox.addClass('active');
            $('html').css("overflow-y","hidden");
        }    
    });
// ====== all-menu end ====== //

// ====== quick-menu start ====== //
    if(window.location.pathname == "/" || window.location.pathname == "/main") {
	    let quickTab = $('.btn-quick-toggle');
	    let quickMenu = $('.quick-ul');
	    quickTab.on('click', function(){
	    	
	    	$(this).toggleClass('open');
	    	if($(this).hasClass('open')) {
	    		$(".popup-wrap.landing").removeClass("on");
	    		$('html').css("overflow-y","auto");     
	    	} else {
	    		$(".popup-wrap.landing").addClass("on");
	    		$('html').css("overflow-y","auto");     
	    	}
	    });
    }

    $('.btn-goUp').click(function () {
        $('body,html').animate({
            scrollTop: 0
        }, 300);
    });


    // 특정 스크롤 위치부터 탑 버튼 노출
    // $(window).scroll(function () {
    // if ($(this).scrollTop() >= 100) {
    // $('.btn-goUp').fadeIn(200);
    // } else {
    // $('.btn-goUp').fadeOut(200);
    // }
    // });
// ====== quick-menu end ====== //


// ====== bar-type-tab start ====== //

barTypeTab();
function barTypeTab() {
    let barTabBtn = $('.tab01-ul > .tab01-li');
    let barTabLi = $('.tab01-ul > .tab01-li');
    let tagVisualBox = $('.barTab-wrap > .content-tab01-box');
    barTabBtn.each(function(){
        var tagBtn01 = $(this);
        tagBtn01.on('click', function(){
        	if(tagBtn01.attr("id") == "listTab") {
        		return false;
        	}

            let btnIdx = $(this).index();
            // console.log(btnIdx);
            barTabLi.removeClass('tagTabOn');
            barTabLi.attr('aria-selected', "false");
            tagBtn01.addClass('tagTabOn')
            tagBtn01.attr('aria-selected', "true");
            tagVisualBox.removeClass('tagTabOn').attr('aria-expanded','false');
            
            tagVisualBox.eq(btnIdx).length == 0 ? tagVisualBox.eq(0).addClass('tagTabOn').attr('aria-expanded','true') : tagVisualBox.eq(btnIdx).addClass('tagTabOn').attr('aria-expanded','true');
        });
    });
}

// ====== bar-type-tab end ====== //

// ====== pill-type-tab start ====== //
pillTypeTab();
function pillTypeTab() {
    let pillTabBtn = $('.tab02-ul > .tab02-li');
    let pillTabLi = $('.tab02-ul > .tab02-li');
    let tagVisualBox = $('.pillTab-wrap > .content-tab02-box');
    pillTabBtn.each(function(){
        var tagBtn02 = $(this);
        tagBtn02.on('click', function(){
            let btnIdx = $(this).index();
            // console.log(btnIdx);
            pillTabLi.removeClass('tabOn').attr('aria-selected',false);
            tagBtn02.addClass('tabOn').attr('aria-selected', true);
            tagVisualBox.removeClass('tagTabOn').attr('aria-expanded', false);
            tagVisualBox.eq(btnIdx).addClass('tagTabOn').attr('aria-expanded', true);
            
        });
    });
}
pillTypeTab02();
function pillTypeTab02() {
    let pillTabBtn02 = $('.tab02-ul > .tab03-li');
    let pillTabLi02 = $('.tab02-ul > .tab03-li');
    let tagVisualBox02 = $('.pillTab-wrap > .content-tab03-box');
    pillTabBtn02.each(function(){
        var tagBtn02 = $(this);
        tagBtn02.on('click', function(){
            let btnIdx02 = $(this).index();
            // console.log(btnIdx);
            pillTabLi02.removeClass('tabOn').attr('aria-selected',false);
            tagBtn02.addClass('tabOn').attr('aria-selected',true);
            tagVisualBox02.removeClass('tagTabOn').attr('aria-expanded', false);
            tagVisualBox02.eq(btnIdx02).addClass('tagTabOn').attr('aria-expanded', true);
        });
    });
}
// ====== pill-type-tab end ====== //

// ====== select-box-custom start ====== //

selectCus();
function selectCus() {
    $('.d-select-cus').each(function() {
        const $select = $(this);
        const $selectTrigger = $select.find('.d-trigger');
        const $options = $select.find('.d-option');
        const $hiddenInput = $select.find('.opt_val');

        // select option 열기
        $selectTrigger.click(function() {
            $options.toggle();
            $select.toggleClass('active');
            $('.d-select-cus').not($select).find('.d-option').hide();
            $('.d-select-cus').not($select).removeClass('active');
        });

        // option 선택
        $options.find('li').click(function() {
            const value = $(this).data('value');
            const text = $(this).text();
            $select.find('.d-trigger_txt').text(text);
            $options.hide();
            $select.removeClass('active');
            // 옵션 선택했을 때 클래스 추가
            if (value != '') {
                $select.addClass('select')
            } else {
                $select.removeClass('select')
            }
            // hidden 필드에 선택한 값을 설정
            $hiddenInput.val(value);
        });
    });

    // select 영역 외 다른곳을 누르면 select 닫힘
    $(document).click(function(e) {
        if (!$(e.target).closest('.d-select-cus').length) {
            $('.d-select-cus .d-option').hide();
            $('.d-select-cus').removeClass('active');
        }
    });
}
selectTab();
function selectTab() {
    $('.d-select-tab').each(function() {
        const $select = $(this);
        const $selectTrigger = $select.find('.d-trigger');
        const $options = $select.find('.d-option');
        const $hiddenInput = $select.find('.opt_val');

        // select option 열기
        $selectTrigger.click(function() {
            $options.toggle();
            $select.toggleClass('active');
            $('.d-select-tab').not($select).find('.d-option').hide();
            $('.d-select-tab').not($select).removeClass('active');
        });

        // option 선택
        $options.find('li').click(function() {
            const value = $(this).data('value');
            const text = $(this).text();
            $select.find('.d-trigger_txt').text(text);
            $options.hide();
            $select.removeClass('active');
            // 옵션 선택했을 때 클래스 추가
            if (value != '') {
                $select.addClass('select')
            } else {
                $select.removeClass('select')
            }
            // hidden 필드에 선택한 값을 설정
            $hiddenInput.val(value);
        });
    });

    // select 영역 외 다른곳을 누르면 select 닫힘
    $(document).click(function(e) {
        if (!$(e.target).closest('.d-select-tab').length) {
            $('.d-select-tab .d-option').hide();
            $('.d-select-tab').removeClass('active');
        }
    });
}
// ====== select-box-custom end ====== //

// ====== pop-up start ====== //
// boxPopOpen();
// function boxPopOpen() {
// let popBox = $('.pop-up');
// let popUpBg = $('.popup-bg');
// let popClose = $('.btn-pop-close');
// $('.btn-popup').click(function() {
// popBox.addClass('on');
// popUpBg.addClass('over');
// $('html').css("overflow-y","hidden");
// });
// }
// boxPopClose();
// function boxPopClose() {
// let popBox = $('.pop-up');
// let popUpBg = $('.popup-bg');
// 
// $('.btn-pop-close').click(function() {
// popBox.removeClass('on');
// popUpBg.removeClass('over');
// $('html').css("overflow-y","unset");
// });
// 
// }

    // ====== pop-up start ====== //
    // 이제하 수정
    popupOpen();
    function popupOpen (){
        $(document).on("click", ".btn-popup", function(){
            var $id = $(this).attr("id");
        	if($id == "slip01" || $id == "slip02") {
            	$(this).next().addClass("on");
                $('html').css("overflow-y","hidden");
        	} else {
	            if($(".popup-wrap").hasClass("on")){
	                $(".popup-wrap").removeClass("on");
	                $('html').css("overflow-y","auto");
	            }else {
	                $(".popup-wrap").addClass("on");
	                $('html').css("overflow-y","hidden");
                    $(".popup-wrap").find(".pop-head-tit").focus();
                    $(".popup-wrap").find(".btn-pop-close").attr("data-return",$id);
	            }
        	}
        });
    }
    popupClose();
    function popupClose (){
        $(document).on("click", ".btn-pop-close", function(){
            var $return = $(this).attr("data-return");
            $("#"+$return).focus();  
            $(this).closest(".popup-wrap").removeClass("on");
            $('html').css("overflow-y","auto");
            
        });
    }
    // ====== pop-up end ====== //

    // toggleBtn
    toggleBtn();
    function toggleBtn(){
        $(document).on("click", ".btn-toggle-wrap button", function(){
            const toggleCont = $(this).closest(".btn-toggle-wrap").siblings(".toggle-content");
            if($(this).hasClass("active")){
                if(toggleCont.hasClass("graybox")){
                    toggleCont.find(".col-2depth").slideUp();
                }else if(toggleCont.hasClass("buyDirect-ul")){
                    toggleCont.css("height","32px");
                }
                else {
                    toggleCont.slideUp();
                }

                $(this).removeClass("active");
            }else {
                if(toggleCont.hasClass("graybox")){
                    toggleCont.find(".col-2depth").slideDown();
                }else if(toggleCont.hasClass("buyDirect-ul")){
                    toggleCont.css("height","max-content");
                }
                else {
                    toggleCont.slideDown();
                }
                $(this).addClass("active");
            }
        });
    }

    function openMapPopup(){
        const openPopBtn = $(".store-overlapBtn");
        openPopBtn.on("click", function(){
            if(openPopBtn.closest(".store-infoBox").hasClass("close")){
                openPopBtn.closest(".store-infoBox").removeClass("close");
            }else {
                openPopBtn.closest(".store-infoBox").addClass("close");
                if(openPopBtn.siblings(".store-inbox").hasClass("open")){
                    openPopBtn.siblings(".store-inbox").removeClass("open")
                }
            }
        });
        $(".has-detail > div").on("click", function(){$(".store-inbox").addClass("open");});
        $(".store-inbox").find(".close-btn").on("click", function(){$(this).closest(".store-inbox").removeClass("open");});
    }
    openMapPopup();
    
    
    
    // 아이폰 키패드 감지로 인한 팝업 height 문제
    function setPopupHeight() {
	  const vh = window.innerHeight * 0.01;
	  document.documentElement.style.setProperty('--vh', '${vh}px');
	}

	window.addEventListener('resize', setPopupHeight);
	setPopupHeight();
	
	// 최근 이용 메뉴 저장
	function updateRecentMenu(menuNm){
		let menuList = [];

		const cookie = cmmUtil.getCookie('recent');
		if(cookie) {
			try {
				menuList = JSON.parse(decodeURIComponent(cookie));
			} catch(e) {
				menuList = [];
			}
		}
		
		if(!cmmUtil.isEmpty(menuNm)) {
			menuList = menuList.filter(d => d.name !== menuNm);
			menuList.unshift({"name" : menuNm, "url" : window.location.href});
		}
		
		if(menuList.length > 10) {
			menuList = menuList.slice(0, 10);
		}
		
		var today  = new Date();
		var expire = new Date(today.getTime() + 60*60*24*30*1000);	// 30일
										// 후
		document.cookie = 'recent=' + encodeURIComponent(JSON.stringify(menuList)) + '; expires=' + expire.toGMTString() + '; path=/';
		
		if(menuList.length > 0) {
			drawRecentMenu(menuList);
		}
    }
	
	if(cmmUtil.isMobile()) {
		updateRecentMenu($(".nav-a.active").text().trim());
	}
	
	// 최근 이용 메뉴 그리기
	function drawRecentMenu(menuList) {
		$(".recent-ul .recent-li").remove();
		
		menuList.forEach(menu => {
			let html = ""; 
			html += '<li class="recent-li">';
	        html += '    <button class="btn-go-recent" type="button" data-url="' + menu.url + '">' + menu.name + '</button>';
	        html += '</li>';
	        
	        $(".recent-ul").append(html);
		});
		
		$(".btn-go-recent").click(function() {
			location.href = $(this).attr("data-url");
        });
	}
	
	// 이전, 다음 버튼 클릭 후 페이지 상단으로 이동
	$("#preBtn, #nextBtn").click(function() {
		window.scrollTo({ top : 0 });
	});

    $('body').find('.container-box').attr('id','containerBox').attr('tabindex','0');
	
});


// 이미지없음
function handleImgError(img) {
    img.onerror = null;
    img.src = '/resources/img/icon/icon_empty_img.svg';
    img.alt = '이미지없음';
}





	
	

document.addEventListener("DOMContentLoaded", () => {
    // 모바일 이벤트
    function setEventForMobile() {
        const isMobileDevice = ('ontouchstart' in window);
        if (isMobileDevice || window.innerWidth <= 1024) {
            // 지도 
            const mapFloatBox = document.querySelector('.store-mapBox .store-infoBox');
            const moBottomInfo = document.querySelector('#targetBox');
            if(!mapFloatBox) return
            mapFloatBox.classList.remove('close')
           
             
            const list = document.querySelector("#storeDiv")
           if (!list) return; 
            list.addEventListener("click", (e) => {
               
                const li = e.target.closest(".store-box"); 
                if (!li) return; 

                mapFloatBox.classList.remove("close");
                moBottomInfo.classList.add('active')
              });
            
            
        } else {
            
        }
    }
    setEventForMobile();
    window.addEventListener('resize', setEventForMobile);
});

