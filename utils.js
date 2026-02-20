function $(queryselector, el) {
    return (el ? el : document).querySelector(queryselector);
}

function $$(queryselector, el) {
    return (el ? el : document).querySelectorAll(queryselector);
}

function loadImage(imgURL1, imgURL2, callback) {
    if (!imgURL1) {
        return;
    }

    var elImg = document.createElement('img');
    elImg.src = imgURL1;
    elImg.onload = () => {
        if (elImg.width > 150) {
            callback(imgURL1);
        } else {
            var elImg2 = document.createElement('img');
            elImg2.src = imgURL2;
            elImg2.onload = () => {
                if (elImg2.width > 150) {
                    callback(imgURL2)
                }
            }
        }
    }
}

function loadVideo(videoURL, callback, errorCallback) {
    var elVideo = document.createElement('video');
    elVideo.src = videoURL;
    elVideo.onloadeddata = function (el) {
        elVideo.controls = true;
        callback(elVideo);
    }
    elVideo.onerror = function () {
        if (errorCallback) {
            errorCallback(videoURL);
        }
    }
}
