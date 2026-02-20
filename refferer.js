
class DOMReffererService {

    constructor(dom){    
        this.dom = dom;    
    }

    hasMetaRefrrer() {
        return this.dom.querySelector("meta[name=referrer]") !== null;
    }

    injectMetaRefferer(value) {      
        var meta = this.dom.createElement('meta'); 
        meta.name = "referrer"; 
        meta.content = value || 'same-origin'; 
        this.dom.getElementsByTagName('head')[0].appendChild(meta);
    }

}
