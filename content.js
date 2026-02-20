var url = document.URL;
var lastUrl = url;
let reffererService = new DOMReffererService(document)


setInterval(function () {
    if (lastUrl != document.URL) {
        lastUrl = document.URL;
        main();
    }
}, 500);

setTimeout(main, 0);

// ============================================================
// 이미지 로딩 (성공/실패 콜백 분리)
// ============================================================
function tryLoadImages(urls, index, successCallback, failureCallback) {
    if (index >= urls.length) {
        console.log(`[ShowCover] ❌ 모든 URL 실패 (${urls.length}개 시도)`);
        if (failureCallback) failureCallback();
        return;
    }
    
    var img = new Image();
    img.onload = function() {
        console.log(`[ShowCover] 🔍 로드됨: ${urls[index]} (${img.width}x${img.height})`);
        if (img.width > 100 && img.height > 100) {
            console.log(`[ShowCover] ✅ 성공: ${urls[index]}`);
            successCallback(urls[index]);
        } else {
            tryLoadImages(urls, index + 1, successCallback, failureCallback);
        }
    };
    img.onerror = function() {
        tryLoadImages(urls, index + 1, successCallback, failureCallback);
    };
    img.src = urls[index];
}

// ============================================================
// 실패 시 버튼 생성
// ============================================================
function createReportButton(subjectID, targetElement) {
    // 이미 버튼이 있으면 스킵
    let existingBtn = targetElement.querySelector('.showcover-report-btn');
    if (existingBtn) return;

    let btn = document.createElement('button');
    btn.className = 'showcover-report-btn';
    btn.innerHTML = '🚫 품번복사';
    btn.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        z-index: 9999;
        background: rgba(255,0,0,0.85);
        color: white;
        border: none;
        padding: 3px 8px;
        cursor: pointer;
        font-size: 11px;
        font-weight: bold;
        border-radius: 3px;
    `;
    
    btn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        navigator.clipboard.writeText(subjectID).then(() => {
            btn.innerHTML = '✅ 복사됨';
            btn.style.background = 'rgba(0,128,0,0.85)';
            setTimeout(() => {
                btn.innerHTML = '🚫 품번복사';
                btn.style.background = 'rgba(255,0,0,0.85)';
            }, 2000);
        });
    };

    // 부모 요소에 position 설정
    let parent = targetElement.closest('.photo') || targetElement.closest('.profile_gallery') || targetElement;
    if (parent) {
        parent.style.position = 'relative';
        parent.appendChild(btn);
    }
}

function removeReportButton(targetElement) {
    let btn = targetElement.querySelector('.showcover-report-btn');
    if (btn) btn.remove();
}

// ============================================================
// 메인 change 함수 (성공/실패 처리)
// ============================================================
function change(elBackground, elImage, subjectID) {
    console.log(`[ShowCover] 🎯 change 호출: ${subjectID}`, elBackground, elImage);
    
    var imageURLs = makeImageURL(subjectID);
    
    if (!imageURLs || imageURLs.length === 0) {
        console.log(`[ShowCover] ⚠️ URL 생성 실패: ${subjectID}`);
        createReportButton(subjectID, elBackground);
        return;
    }
    
    tryLoadImages(imageURLs, 0, 
        // 성공 시
        function(loadedImgURL) {
            console.log(`[ShowCover] 🖼️ DOM 업데이트 시도: ${subjectID}`);
            
            elBackground.style['background-image'] = 'url(' + loadedImgURL + ')';
            
            // elBackground 안의 모든 img 숨기기 (NOW PRINTING 포함)
            elBackground.querySelectorAll('img').forEach(img => {
                img.style.visibility = 'hidden';
            });
            
            // 전달받은 elImage도 숨기기
            if (elImage) {
                elImage.style.visibility = 'hidden';
            }
            
            console.log(`[ShowCover] ✅ DOM 업데이트 완료: ${subjectID}`);
            removeReportButton(elBackground);
        },
        // 실패 시 (모든 URL 실패)
        function() {
            console.log(`[ShowCover] ❌ 모든 URL 실패: ${subjectID}`);
            createReportButton(subjectID, elBackground);
        }
    );
}

function changeList(listExp, bgExp, imgExp, descExp) {
    var els = $$(listExp);
    console.log(`[ShowCover] 📋 changeList 호출: ${listExp} (${els.length}개 항목)`);

    for (el of els) {
        try {
            let bg = bgExp ? $(bgExp, el) : el;
            let img = $(imgExp, el);
            let desc = $(descExp, el);
            console.log(`[ShowCover] 📦 항목 처리:`, desc?.innerText, bg, img);
            change(bg, img, desc.innerText)
        } catch (e) {
            console.log(`[ShowCover] ⚠️ 항목 처리 실패:`, e);
        }
    }
}

// ============================================================
// 품번 패턴 정규식 (전역 검색용)
// ============================================================
const CODE_PATTERN = /\b([a-zA-Z]{2,10})-(\d{1,5})\b/g;
const CODE_PATTERN_SINGLE = /\b([a-zA-Z]{2,10})-(\d{1,5})\b/;


// ============================================================
// findAndAddButtons: 페이지 전체에서 품번을 찾아 버튼 추가
// ============================================================
function findAndAddButtons() {
    console.log('[ShowCover] 🔍 findAndAddButtons 실행 - 페이지 전체 스캔 시작');
    
    // 검색 대상 요소들
    const targetSelectors = ['div', 'span', 'p', 'td', 'th', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'dt', 'dd'];
    const processedElements = new WeakSet();
    let foundCount = 0;
    
    targetSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
            // 이미 처리했거나 버튼이 있으면 스킵
            if (processedElements.has(element)) return;
            if (element.querySelector('.showcover-inline-btn')) return;
            if (element.classList.contains('showcover-inline-btn')) return;
            if (element.closest('.showcover-export-btn')) return;
            
            // 자식 요소가 많으면 스킵 (텍스트 노드가 있는 요소만 처리)
            let hasDirectText = false;
            for (let node of element.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                    hasDirectText = true;
                    break;
                }
            }
            
            if (!hasDirectText) return;
            
            // 텍스트 내용 검사
            const text = element.textContent || '';
            
            // "품번:" 또는 "품번 :" 패턴 확인
            const prefixMatch = text.match(/품번\s*[:：]\s*([a-zA-Z]{2,10}-\d{1,5})/i);
            if (prefixMatch) {
                const code = prefixMatch[1].toUpperCase();
                console.log(`[ShowCover] 버튼 추가 시도: ${code} (품번: 패턴)`);
                addButtonToElement(element, code);
                processedElements.add(element);
                foundCount++;
                return;
            }
            
            // 일반 품번 패턴 확인 (직접 텍스트에서만)
            let directText = '';
            for (let node of element.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    directText += node.textContent;
                }
            }
            
            const codeMatch = directText.match(CODE_PATTERN_SINGLE);
            if (codeMatch) {
                const code = codeMatch[0].toUpperCase();
                // 이미 처리된 품번인지 확인 (부모에서 처리되었을 수 있음)
                if (!element.closest('[data-showcover-processed]')) {
                    console.log(`[ShowCover] 버튼 추가 시도: ${code}`);
                    addButtonToElement(element, code);
                    element.setAttribute('data-showcover-processed', 'true');
                    processedElements.add(element);
                    foundCount++;
                }
            }
        });
    });
    
    console.log(`[ShowCover] ✅ findAndAddButtons 완료 - ${foundCount}개 품번 발견`);
}

// ============================================================
// 요소에 버튼 추가 (🖼️ + [안나옴])
// ============================================================
function addButtonToElement(element, code) {
    // 이미 버튼이 있으면 스킵
    if (element.querySelector('.showcover-inline-btn')) return;
    if (element.querySelector('.collect-btn')) return;
    
    // 🖼️ 커버 보기 버튼 (초록색)
    const coverBtn = document.createElement('button');
    coverBtn.className = 'showcover-inline-btn';
    coverBtn.innerHTML = '🖼️';
    coverBtn.title = `${code} 커버 보기`;
    coverBtn.style.cssText = `
        display: inline-block;
        margin-left: 5px;
        padding: 2px 6px;
        font-size: 12px;
        cursor: pointer;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 3px;
        vertical-align: middle;
    `;
    
    coverBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        showCoverPopup(code);
    };
    
    // 📋 품번 복사 버튼 (파란색)
    const copyBtn = document.createElement('button');
    copyBtn.className = 'showcover-inline-btn';
    copyBtn.innerHTML = '품번복사';
    copyBtn.title = `${code} 복사`;
    copyBtn.style.cssText = `
        display: inline-block;
        margin-left: 3px;
        padding: 2px 6px;
        font-size: 12px;
        cursor: pointer;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 3px;
        vertical-align: middle;
    `;

    copyBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(code).then(() => {
            copyBtn.innerHTML = '✅복사됨';
            setTimeout(() => { copyBtn.innerHTML = '품번복사'; }, 1500);
        });
    };

    // 요소 끝에 버튼들 추가
    element.appendChild(coverBtn);
    element.appendChild(copyBtn);
}

// ============================================================
// 커버 이미지 팝업 표시
// ============================================================
function showCoverPopup(code) {
    console.log(`[ShowCover] 🖼️ 팝업 표시: ${code}`);
    
    // 기존 팝업 제거
    const existingPopup = document.getElementById('showcover-popup');
    if (existingPopup) existingPopup.remove();
    
    // 팝업 생성
    const popup = document.createElement('div');
    popup.id = 'showcover-popup';
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 999999;
        background: #222;
        padding: 10px;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(0,0,0,0.8);
        max-width: 90vw;
        max-height: 90vh;
    `;
    
    // 로딩 표시
    popup.innerHTML = `
        <div style="color: white; text-align: center; padding: 20px;">
            <div>로딩 중... ${code}</div>
        </div>
    `;
    
    // 닫기 버튼
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: -10px;
        right: -10px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        background: #f44336;
        color: white;
        font-size: 16px;
        cursor: pointer;
        z-index: 1000000;
    `;
    closeBtn.onclick = () => { popup.remove(); overlay.remove(); };
    popup.appendChild(closeBtn);
    
    // 배경 오버레이
    const overlay = document.createElement('div');
    overlay.id = 'showcover-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 999998;
    `;
    overlay.onclick = () => {
        popup.remove();
        overlay.remove();
    };
    
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
    
    // 이미지 URL 생성 및 로드
    const imageURLs = makeImageURL(code);
    
    if (!imageURLs || imageURLs.length === 0) {
        popup.innerHTML = `
            <div style="color: white; text-align: center; padding: 20px;">
                <div>❌ URL 생성 실패: ${code}</div>
            </div>
        `;
        popup.appendChild(closeBtn);
        return;
    }
    
    tryLoadImages(imageURLs, 0,
        // 성공
        function(loadedImgURL) {
            popup.innerHTML = `
                <img src="${loadedImgURL}" style="max-width: 80vw; max-height: 80vh; display: block;" />
                <div style="color: white; text-align: center; margin-top: 10px; font-size: 14px;">${code}</div>
            `;
            popup.appendChild(closeBtn);
        },
        // 실패
        function() {
            popup.innerHTML = `
                <div style="color: white; text-align: center; padding: 20px;">
                    <div>❌ 이미지를 찾을 수 없습니다: ${code}</div>
                </div>
            `;
            popup.appendChild(closeBtn);
        }
    );
}

function main() {
    console.log(`[ShowCover] 🚀 main() 실행: ${url}`);
    
    // 페이지 전체에서 품번 찾기 (모든 페이지에서 실행)
    setTimeout(findAndAddButtons, 500);
    
    if (/dvd.php/.test(url)) {
        console.log(`[ShowCover] 📄 상세 페이지 감지`);
        try {
            change($('.profile_gallery'), $('#dvd_img_src'), $('h1 span.tomato').innerHTML)
        } catch (ignored) { }

        changeList('.widget_photo_list ul li', null, 'a img', '.dscr')

        // 미리보기 버튼
        if (!document.getElementById('showcover_preview_btn')) {
            elA = document.createElement('a');
            elA.id = 'showcover_preview_btn';
            elA.innerText = '미리보기 ▶';
            elA.addEventListener('click', function () {
                let subjectID = $('h1 span.tomato').innerHTML;            
                if (isVR(subjectID)) {
                    showVR(makeVrURL(subjectID));
                } else {
                    showVideo(makeVideoURL(subjectID));
                }
                elA.remove();
            });

            elA.className = 'flat-btn tp2 btn_watched_n';
            if ($('.story h2')) {
                $('.story h2').insertAdjacentElement('afterend', elA);
            } else if ($('.genre h2')) {
                $('.genre h2').insertAdjacentElement('beforebegin', elA);
            }
        }
        
        changeList('.album_vw ul.lst li', '.photo', '.photo a img', '.snum, .k_name')

    } else if (/genre-av|genre_av|dvd_ranking.php|dvd_list.php|mypage.php|search.php|mention/.test(url)) {
        console.log(`[ShowCover] 📋 목록 페이지 감지`);
        // 동적 로딩 대응 - 약간의 딜레이 후 실행
        setTimeout(function() {
            // 기존 셀렉터
            changeList('ul.lst li', '.photo', '.photo a img', '.snum, .k_name');
            // 장르 페이지용 셀렉터 (album_vw 구조)
            changeList('.album_vw ul.lst li', '.photo', '.photo a img', '.snum a.detail');
            changeList('.album_vw .lst li', '.photo', '.photo a img', '.snum a.detail');
        }, 300);
    } else if (/actor.php/.test(url)) {
        console.log(`[ShowCover] 👤 배우 페이지 감지`);
        changeList('#dvd_lst ul.lst li', '.photo', 'a img', '.snum')
        changeList('.widget_photo_list ul li', null, 'a img', '.dscr')
    } else {
        console.log(`[ShowCover] ❓ 미지원 페이지`);
    }
}

function showVideo(videoURL) {
    if (!videoURL) {
        alert('미리보기를 찾을 수 없습니다.');
        return;
    }
    if (!reffererService.hasMetaRefrrer()) {
        reffererService.injectMetaRefferer()
    }    
    
    var video = document.createElement('video');
    video.src = videoURL;
    video.onloadeddata = function (el) {
        video.controls = true;
        $('.profile_right_top').insertAdjacentElement('beforebegin', video);        
    }
    video.onerror = function () {
        alert('아직 지원하지 않는 미리보기입니다.');
    }
}

function showVR(VR_URL) {
    if (VR_URL) window.open(VR_URL);
}

function purifySubjectId(subjectID) {
    let splitID = subjectID.split('-');
    if (splitID.length < 2) return [null, null];
    
    let [maker, num] = [splitID[0].toLowerCase().trim(), splitID[1].trim()];

    var replaceMap = {
        'kssis': 'ssis',
        'kcawd': 'cawd'
    };
    
    if (replaceMap[maker]) {
        maker = replaceMap[maker]
    }

    return [maker, num];
}

// ============================================================
// 핵심: makeImageURL - Prestige + 일반 DMM 패턴 병합
// ============================================================
function makeImageURL(subjectID) {
    let [maker, num] = purifySubjectId(subjectID);
    if (!maker || !num) return [];
    
    let paddedNum5 = num.padStart(5, '0');
    let paddedNum3 = num.padStart(3, '0');
    let urls = [];

    // ============================================================
    // [전략 1] Prestige 계열 패턴
    // ============================================================
    for (let key in PRESTIGE_ITEMS) {
        if (PRESTIGE_ITEMS[key].test(maker)) {
            let cid = '118' + maker + num + 'r';
            let cidNoR = '118' + maker + num;
            let cidPadded = '118' + maker + paddedNum5 + 'r';
            
            urls.push(
                `https://pics.dmm.co.jp/mono/movie/${cid}/${cid}pl.jpg`,
                `https://pics.dmm.com/mono/movie/${cid}/${cid}pl.jpg`,
                `https://pics.dmm.co.jp/mono/movie/adult/${cid}/${cid}pl.jpg`,
                `https://pics.dmm.co.jp/digital/video/${cid}/${cid}pl.jpg`,
                `https://pics.dmm.co.jp/mono/movie/${cidNoR}/${cidNoR}pl.jpg`,
                `https://pics.dmm.co.jp/mono/movie/${cidPadded}/${cidPadded}pl.jpg`,
            );
            break;
        }
    }

    // ============================================================
    // [전략 2] Constants.js ALL_ITEMS 매핑 확인
    // ============================================================
    let foundKey = '';
    for (let key in ALL_ITEMS) {
        if (!ALL_ITEMS.hasOwnProperty(key)) continue;
        if (ALL_ITEMS[key].test(maker)) {
            foundKey = key;
            break;
        }
    }

    // ============================================================
    // [전략 3] 후보군 생성 (Key 유무 모두 대응)
    // 숫자 접두어(1,2,13 등)는 원본 번호 우선, h_ 접두어는 5자리 패딩이 일반적
    // h_139 같은 특수 접두어는 r 접미사가 필요한 경우가 많음
    // ============================================================
    let combinations = [];
    
    // h_139 등 r 접미사가 필요한 접두어 리스트
    let rSuffixPrefixes = ['h_139'];
    let needsRSuffix = rSuffixPrefixes.includes(foundKey);
    
    // 숫자 접두어인 경우: 원본 번호 > 3자리 패딩 > 5자리 패딩 순서
    // 예: 2ktb101 > 2ktb101 > 2ktb00101 (AVDBS 실제 패턴 반영)
    if (foundKey && /^\d+$/.test(foundKey)) {
        combinations.push(
            foundKey + maker + num,              // 2ktb101 (원본 번호 우선!)
            foundKey + maker + paddedNum3,       // 2ktb101 (3자리 패딩)
            foundKey + maker + paddedNum5,       // 2ktb00101
        );
    } else if (needsRSuffix) {
        // h_139 등 r 접미사 필요한 접두어: r 접미사 버전 우선!
        combinations.push(
            foundKey + maker + num + 'r',        // h_139doks562r (우선!)
            foundKey + maker + paddedNum3 + 'r', // h_139doks562r
            foundKey + maker + paddedNum5 + 'r', // h_139doks00562r
            foundKey + maker + num,              // h_139doks562
            foundKey + maker + paddedNum3,       // h_139doks562
            foundKey + maker + paddedNum5,       // h_139doks00562
        );
    } else {
        // h_ 접두어 또는 빈 접두어는 5자리 패딩 우선
        combinations.push(
            foundKey + maker + paddedNum5,       // h_687ktb00069
            foundKey + maker + paddedNum3,       // h_687ktb069
            foundKey + maker + num,              // h_687ktb69
        );
    }
    
    // r 접미사 버전 추가 (아직 추가되지 않은 경우)
    if (!needsRSuffix) {
        combinations.push(
            foundKey + maker + num + 'r',
            foundKey + maker + paddedNum3 + 'r',
            foundKey + maker + paddedNum5 + 'r',
        );
    }
    
    // foundKey가 있으면 접두어 없는 버전도 추가 (fallback)
    if (foundKey) {
        combinations.push(
            maker + num,              // ktb101 (원본 번호 우선)
            maker + paddedNum3,       // ktb101
            maker + paddedNum5,       // ktb00101
            maker + num + 'r',        // ktb101r
            maker + paddedNum5 + 'r'  // ktb00101r
        );
    }
    
    // [추가] 다른 숫자 접두어도 시도 (같은 시리즈가 여러 접두어 사용 가능)
    // 단, h_ 접두어가 매핑된 경우는 숫자 접두어 fallback 스킵
    // 예: doks는 h_139가 정확한 매핑이므로 1, 2 등 시도 안함
    if (!foundKey.startsWith('h_')) {
        let numericPrefixes = ['1', '2', '12', '13', '18', '24', '36', '55', '84'];
        numericPrefixes.forEach(prefix => {
            if (prefix !== foundKey) {  // 이미 추가된 foundKey는 제외
                combinations.push(
                    prefix + maker + num,           // 예: 1ktb101
                    prefix + maker + paddedNum3,    // 예: 1ktb101
                );
            }
        });
    }

    // ============================================================
    // [전략 4] URL 생성 (mono/movie 우선!)
    // 실제 패턴: 숫자 접두어도 /mono/movie/ 경로가 기본
    // 예: https://pics.dmm.co.jp/mono/movie/2ktb069/2ktb069pl.jpg
    // ============================================================
    combinations.forEach(cid => {
        urls.push(
            // mono/movie 우선 (기본 패턴)
            `https://pics.dmm.co.jp/mono/movie/${cid}/${cid}pl.jpg`,
            // adult 경로
            `https://pics.dmm.co.jp/mono/movie/adult/${cid}/${cid}pl.jpg`,
            // 디지털 비디오 경로 (fallback)
            `https://pics.dmm.co.jp/digital/video/${cid}/${cid}pl.jpg`,
            // 닷컴 도메인
            `https://pics.dmm.com/mono/movie/${cid}/${cid}pl.jpg`,
            `https://pics.dmm.com/mono/movie/adult/${cid}/${cid}pl.jpg`,
        );
    });

    // ============================================================
    // [전략 5] 브루트포스: 자주 쓰이는 h_ 접두어 시도
    // ============================================================
    if (!foundKey) {
        let commonPrefixes = ['h_086', 'h_254', 'h_346', 'h_237', 'h_127', 
                              'h_706', 'h_244', 'h_687', 'h_1127', '1', '13', '84'];
        
        commonPrefixes.forEach(prefix => {
            let cid = prefix + maker + paddedNum5;
            urls.push(
                // mono/movie 우선 (기본 패턴)
                `https://pics.dmm.co.jp/mono/movie/${cid}/${cid}pl.jpg`,
                `https://pics.dmm.co.jp/mono/movie/adult/${cid}/${cid}pl.jpg`,
                // 디지털 비디오 경로 (fallback)
                `https://pics.dmm.co.jp/digital/video/${cid}/${cid}pl.jpg`,
            );
        });
    }

    // 중복 제거
    return [...new Set(urls)];
}

// ============================================================
// 비디오 URL 생성
// ============================================================
function makeVrURL(subjectID) {
    const [maker, num] = purifySubjectId(subjectID);
    if (!maker || !num) return null;
    
    // Prestige VR
    for (let key in PRESTIGE_ITEMS) {
        if (PRESTIGE_ITEMS[key].test(maker)) {
            let cid = '118' + maker + num + 'r';
            return `https://www.dmm.co.jp/digital/-/vr-sample-player/=/cid=${cid}`;
        }
    }
    
    for (let key in ALL_ITEMS) {
        if (key === '') continue;
        if (ALL_ITEMS[key].test(maker)) {
            const newID = VIDEO_SHORT_ID.indexOf(maker) < 0 ? `${key}${maker}${num.padStart(5, '0')}`: `${key}${maker}${num}`;
            return `https://www.dmm.co.jp/digital/-/vr-sample-player/=/cid=${newID}`;
        }
    }
    
    return `https://www.dmm.co.jp/digital/-/vr-sample-player/=/cid=${maker}${num.padStart(5, '0')}`;
}

function makeVideoURL(subjectID) {
    let [maker, num] = purifySubjectId(subjectID);
    if (!maker || !num) return null;

    // Prestige 계열
    for (let key in PRESTIGE_ITEMS) {
        if (PRESTIGE_ITEMS[key].test(maker)) {
            let cid = '118' + maker + num + 'r';
            return `https://cc3001.dmm.co.jp/litevideo/freepv/1/118/${cid}/${cid}_mhb_w.mp4`;
        }
    }

    // DMM 계열
    for (let key in ALL_ITEMS) {
        if (key === '') continue;
        if (ALL_ITEMS[key].test(maker)) {        
            let newID = VIDEO_SHORT_ID.indexOf(maker) < 0 ? `${key}${maker}${num.padStart(5, '0')}`: `${key}${maker}${num}`;
            let firstLetter = newID[0];
            let threeLetter = newID.substr(0, 3);

            return ['https://cc3001.dmm.co.jp/litevideo/freepv', firstLetter, threeLetter, newID, newID + '_mhb_w.mp4'].join('/');
        }
    }

    // 범용
    let cid = maker + num.padStart(5, '0');
    let firstLetter = cid[0];
    let threeLetter = cid.substr(0, 3);
    return `https://cc3001.dmm.co.jp/litevideo/freepv/${firstLetter}/${threeLetter}/${cid}/${cid}_mhb_w.mp4`;
}

function isVR(subjectID) {
    return /[a-z]+vr-[0-9]+/i.test(subjectID);
}
