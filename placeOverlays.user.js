// ==UserScript==
// @name         r/place overlays
// @namespace    https://tampermonkey.net/
// @version      0.0.93
// @description  Currently supported overlays: PlaceDE, Gronkh, Bonjwa, and Papaplatte
// @author       MAZ / MAZ01001 <https://maz01001.github.io/>
// @match        https://garlic-bread.reddit.com/embed*
// @icon         https://styles.redditmedia.com/t5_2sxhs/styles/communityIcon_5ejpm2gtctq81.png
// @updateURL    https://github.com/MAZ01001/placeOverlays/raw/main/placeOverlays.user.js
// @downloadURL  https://github.com/MAZ01001/placeOverlays/raw/main/placeOverlays.user.js
// ==/UserScript==

// also see:
// > PlaceDE: https://github.com/PlaceDE-Official/place-overlay/
// > Gronkh: https://github.com/FeLuckLP/rplace/
// > Bonjwa: https://github.com/rplacebonjwa/rplace/
// > Papaplate: https://github.com/FlashSkyNews/place-overlay/

//@ts-check
"use strict";

//~ log time
const timeScriptStart=performance.now();
console.log("%c[rPlaceOverlays] script loading started at %f ms","background-color:#000;color:#F90;font-style:italic;font-size:larger",timeScriptStart.toFixed(3));

/**@type {readonly[number,number]} current size of r/place canvas*/
const CANVAS_SIZE=Object.freeze([3000,2000]);
/**@type {readonly[number,number]} offset from top left to origin point on r/place canvas (pixel 0,0)*/
const ORIGIN_OFFSET=Object.freeze([1500,1000]);

/* {{widget preview}}
    [screenshot]
    [ -- overlays --
        [new overlay]
        [
            [visible] <name> ([delete])
        ]
        [update overlays]
        [opacity]
    ]
    [ -- teporary image --
        [set image]
        [ -- position --
            [X] [Y]
        ]
        [ -- size --
            [width] [height]
            [auto] [auto]
            [reset]
        ]
        [pixelate image]
        [opacity]
    ]
*/

/**
 * ## save a value in local storage
 * @param {string} name - name for {@linkcode value}
 * @param {string} value - the value to store
 */
const saveStorage=(name,value)=>{
    "use strict";
    localStorage.setItem(`rPlaceOverlays_${name}`,value);
};
/**
 * ## load a value from local storage
 * @param {string} name - name of the value to get
 * @returns {string|null} the value found or `null`
 */
const readStorage=name=>{
    "use strict";
    return localStorage.getItem(`rPlaceOverlays_${name}`);
};
/**
 * ## remove an item from local storage
 * @param {string} name - name of stored item to remove
 */
const removeStorage=name=>{
    "use strict";
    localStorage.removeItem(`rPlaceOverlays_${name}`);
};
/**
 * ## removes all stored values from local storage
 * only values from this overlay - key starts with `"rPlaceOverlays_"`
 */
const clearStorage=()=>{
    "use strict";
    for(const key in localStorage)
        if(key.startsWith("rPlaceOverlays_"))localStorage.removeItem(key);
}
/**
 * ## checks if given {@linkcode url} leads to an image
 * _async function_
 * @param {string} url - a URL that leads to an image
 * @returns {Promise<boolean>} true if {@linkcode url} is a valid image URL and false otherwise
 */
const checkImageURL=async url=>{
    "use strict";
    if(url.startsWith("javascript:"))return false;
    if(url.startsWith("data:")){
        if(url.startsWith("data:image/"))return true;
        return false;
    }
    const res=await fetch(url,{method:"HEAD"}).catch(()=>null);
    const buff=await res?.blob();
    return buff?.type?.startsWith("image/")??false;
};

/**@type {number} number of default overlays in {@linkcode OVERLAYS} (after that are the custom overlays)*/
const DEFAULT_OVERLAYS=8;
/**@type {(readonly[string,string])[]} all overlays `[unique name, image URL]` (custom overlays start at index {@linkcode DEFAULT_OVERLAYS})*/
const OVERLAYS=(customOverlays=>{
    "use strict";
    /**@type {(readonly[string,string])[]}*/
    const overlays=[
        Object.freeze(["PlaceDE (dots)","https://place.army/overlay_target.png"]),
        Object.freeze(["PlaceDE (full)","https://place.army/default_target.png"]),
        Object.freeze(["Gronkh (dots)","https://raw.githubusercontent.com/FeLuckLP/rplace/main/overlay.png"]),
        Object.freeze(["Gronkh (full)","https://raw.githubusercontent.com/FeLuckLP/rplace/main/output.png"]),
        Object.freeze(["Bonjwa (dots)","https://raw.githubusercontent.com/rplacebonjwa/rplace/main/overlay.png"]),
        Object.freeze(["Bonjwa (full)","https://raw.githubusercontent.com/rplacebonjwa/rplace/main/output.png"]),
        Object.freeze(["Papaplatte (dots)","https://place.kayo.zip/outputs/overlay_target.png"]),
        Object.freeze(["Papaplatte (full)","https://place.kayo.zip/outputs/default_target.png"]),
    ];
    if(!Array.isArray(customOverlays))return overlays;
    for(const overlay of customOverlays)
        if(
            Array.isArray(overlay)
            &&overlay.length===2
            &&typeof overlay[0]==="string"
            &&typeof overlay[1]==="string"
         //@ts-ignore above lines check for [string,string]
        )overlays.push(Object.freeze(overlay));
    return overlays;
})(JSON.parse(readStorage("customOverlays")??"[]"));
saveStorage("customOverlays",JSON.stringify(OVERLAYS.slice(DEFAULT_OVERLAYS)));
/**
 * ## updates an svg eye toggle element
 * _used within {@linkcode createEyeToggle} for updating the svg eye_
 * @param {SVGPathElement} svgPath - the svg path element to change
 * @param {boolean} state - the state of the toggle (true = visible)
 */
const updateEyeToggle=(svgPath,state)=>{
    "use strict";
    svgPath.setAttribute("d",state?"M4.5-.5Q0-6.7-4.5-.5q-.3.5 0 1Q0 6.7 4.5.5q.3-.5 0 -1zM0-2.2a2.2 2.2 0 11-.001 0zM0-1.3a1.3 1.3 0 11-.001 0z":"M3.27 1.965Q4 1.2 4.5.5q.3-.5 0-1Q1.34-4.85-1.8-3.1l1.04 1.035a2.2 2.2 0 012.83 2.82zM-3.27-1.965Q-4-1.2-4.5-.5q-.3.5 0 1Q-1.34 4.85 1.8 3.1l-1.04-1.035a-2.2-2.2 0 01-2.83-2.82zM-1.578-.268A1.6 1.6 0 00.268 1.578zM1.578.268A-1.6-1.6 0 00-.268-1.578zM-3.5-4a.2.2 0 00-.5.5L3.5 4a.2.2 0 00.5-.5z");
};
/**
 * ## create an svg eye toggle element
 * _uses {@linkcode updateEyeToggle} to update svg when toggle state changes_ \
 * also adds tooltip "toggle visibility"
 * @param {boolean} startState - set the created toggle to this value
 * @returns {HTMLInputElement&{get parentElement():HTMLLabelElement}} the toggle element (use `parentElement` to append to DOM)
 */
const createEyeToggle=startState=>{
    "use strict";
    const label=document.createElement("label"),
        input=document.createElement("input"),
        svg=document.createElementNS("http://www.w3.org/2000/svg","svg"),
        svgPath=document.createElementNS("http://www.w3.org/2000/svg","path");
    svg.setAttribute("viewBox","-5-5 10 10");
    svg.setAttribute("fill","#F90");
    svg.style.margin="2px";
    svg.style.height="1.4rem";
    svg.style.verticalAlign="-0.5rem";
    svg.append(svgPath);
    updateEyeToggle(svgPath,input.checked=startState);
    input.type="checkbox";
    input.style.opacity="0";
    input.style.margin="0";
    input.style.width="0";
    input.style.height="0";
    input.addEventListener("change",()=>{
        "use strict";
        updateEyeToggle(svgPath,input.checked);
    },{passive:true});
    label.title="toggle visibility";
    label.style.display="inline-block";
    label.style.cursor="pointer";
    label.append(input,svg);
    //@ts-ignore the parent element of `input` is `label`
    return input;
};
/**
 * ## create an svg delete button element
 * adds tooltip "remove overlay"
 * @param {((ev:MouseEvent)=>void|Promise<void>)|null} onClick - `click` event of the button (passive)
 * @returns {HTMLInputElement&{get parentElement():HTMLLabelElement}} the toggle element (use `parentElement` to append to DOM)
 */
const createDelButton=onClick=>{
    "use strict";
    const label=document.createElement("label"),
        input=document.createElement("input"),
        svg=document.createElementNS("http://www.w3.org/2000/svg","svg"),
        svgPathTopBack=document.createElementNS("http://www.w3.org/2000/svg","path"),
        svgPathTopFront=document.createElementNS("http://www.w3.org/2000/svg","path"),
        svgPathMiddleBack=document.createElementNS("http://www.w3.org/2000/svg","path"),
        svgPathMiddleFront=document.createElementNS("http://www.w3.org/2000/svg","path");
    svgPathTopBack.setAttribute("stroke-width",".09");
    svgPathTopBack.setAttribute("d","M.35.15v-.1h.3v.1");
    svgPathTopFront.setAttribute("stroke","#B22");
    svgPathTopFront.setAttribute("d","M.35.15v-.1h.3v.1");
    svgPathMiddleBack.setAttribute("fill","#F33");
    svgPathMiddleBack.setAttribute("d","M.1.15h.8l.02.1h-.84zM.13.25l.1.7h.54l.1-.7");
    svgPathMiddleFront.setAttribute("stroke","#B22");
    svgPathMiddleFront.setAttribute("stroke-width",".05");
    svgPathMiddleFront.setAttribute("stroke-linecap","round");
    svgPathMiddleFront.setAttribute("d","M.29.35l.06.5m.15 0l0-.5m.21 0l-.06.5");
    svg.setAttribute("viewBox","0 0 1 1");
    svg.setAttribute("fill","none");
    svg.setAttribute("stroke","#000");
    svg.setAttribute("stroke-width",".03");
    svg.setAttribute("stroke-linejoin","round");
    svg.style.margin="2px";
    svg.style.height="1.4rem";
    svg.style.verticalAlign="-.5rem";
    svg.append(svgPathTopBack,svgPathTopFront,svgPathMiddleBack,svgPathMiddleFront);
    input.type="button";
    input.style.opacity="0";
    input.style.padding="0";
    input.style.border="0";
    if(onClick!=null)input.addEventListener("click",onClick,{passive:true});
    label.title="remove overlay";
    label.style.display="inline-block";
    label.style.cursor="pointer";
    label.append(input,svg);
    //@ts-ignore the parent element of `input` is `label`
    return input;
};

/**@type {(HTMLInputElement&{get parentElement():HTMLLabelElement})[]} on/off toggles for each overlay (name as in {@linkcode OVERLAYS} (index should also match) || use `parentElement` to append to DOM)*/
const overlayToggles=OVERLAYS.map(
    overlay=>{
        "use strict";
        const name=overlay[0];
        const toggle=createEyeToggle(readStorage(`overlay_${name}`)==="true");
        toggle.name=name;
        toggle.addEventListener("change",()=>{
            "use strict";
            saveStorage(`overlay_${name}`,toggle.checked?"true":"false");
        },{passive:true});
        return toggle;
    }
);
/**
 * ## draw the overlays on the {@linkcode overlayCanvas}
 * _if enabled in {@linkcode overlayToggles}_
 */
const drawOverlays=()=>{
    "use strict";
    overlayContext?.clearRect(0,0,CANVAS_SIZE[0]*3,CANVAS_SIZE[1]*3);
    for(let i=0;i<OVERLAYS.length;i++){
        const[name,imgUrl]=OVERLAYS[i];
        //~ index should be the same but just in case it isn't
        if(overlayToggles[i].name===name){
            if(!overlayToggles[i].checked)continue;
        }else if(!overlayToggles.find(toggle=>toggle.name===name)?.checked)continue;
        let img=new Image();
        img.addEventListener("load",()=>{
            "use strict";
            overlayContext?.drawImage(img,0,0,overlayCanvas.width,overlayCanvas.height);
        },{passive:true,once:true});
        const url=new URL(imgUrl);
        url.searchParams.append("timestamp",Date.now().toString());
        img.src=url.href;
    }
};
/**## updates {@linkcode tempImage} position and size*/
const displayTempImage=()=>{
    "use strict";
    // TODO position/resize image via CSS relative to canvas position/origin
};

/**@type {HTMLDivElement} custom menu container (holds buttons, toggles, sliders, and such)*/
const customMenu=document.createElement("div");
customMenu.id="rPlaceOverlays_mainMenu";
customMenu.style.position="fixed";
customMenu.style.bottom="1rem";
customMenu.style.right="1rem";
customMenu.style.maxWidth="calc(40vw - calc(1rem + 16px))";
customMenu.style.maxHeight="calc(80vh - calc(1rem + 16px))";
customMenu.style.overflow="overlay";
customMenu.style.display="flex";
customMenu.style.flexFlow="column";
customMenu.style.placeItems="flex-end end";
customMenu.style.gap=".4rem";
customMenu.style.padding="5px";
customMenu.style.border="3px outset #222";
customMenu.style.borderRadius="10px";
customMenu.style.backgroundColor="#3338";
customMenu.style.backdropFilter="blur(10px)";
customMenu.style.color="white";
/**@type {HTMLStyleElement} CSS for the {@linkcode customMenu} (might not work because of [Content Security Policies](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP))*/
const customMenuStyle=document.createElement("style");
customMenuStyle.textContent=`
    div#${customMenu.id} svg:hover{filter:drop-shadow(0 0 4px #FFF8);}
    div#${customMenu.id} input[type="button"]{outline:none!important;}
    div#${customMenu.id} input[type="button"]:hover{filter:brightness(1.5);}
    div#${customMenu.id} input[type="button"]:focus{border-color:#F90!important;}
    div#${customMenu.id} input[type="button"]:active{border-style:inset!important;}
    div#${customMenu.id} input[type="range"]:hover{background-color:#555;}
    div#${customMenu.id} input[type="range"]{
        appearance:none;
        background-color:#000;
        border:1px inset #000;
        border-radius:1rem;
    }
    div#${customMenu.id} input[type="range"]::-webkit-slider-thumb{
        appearance:none;
        width:1rem;
        height:1rem;
        background-color:#F90;
        border:1px outset #F90;
        border-radius:1rem;
        cursor:grab;
    }
    div#${customMenu.id}::-webkit-scrollbar,
    div#${customMenu.id} *::-webkit-scrollbar{width:.8rem;height:.8rem;}
    div#${customMenu.id}::-webkit-scrollbar-thumb:vertical:window-inactive,
    div#${customMenu.id} *::-webkit-scrollbar-thumb:vertical:window-inactive{border-right-style:dashed;}
    div#${customMenu.id}::-webkit-scrollbar-thumb:horizontal:window-inactive,
    div#${customMenu.id} *::-webkit-scrollbar-thumb:horizontal:window-inactive{border-bottom-style:dashed;}
    div#${customMenu.id}::-webkit-scrollbar-thumb:vertical,
    div#${customMenu.id} *::-webkit-scrollbar-thumb:vertical{
        background-color:#0000;
        border-right:.2rem solid #000F;
        border-radius:0;
    }
    div#${customMenu.id}:hover::-webkit-scrollbar-thumb:vertical,
    div#${customMenu.id} *:hover::-webkit-scrollbar-thumb:vertical{
        background-color:#000F;
        box-shadow:inset .4rem 0 .4rem 0 #0A0F;
        border:none;
        border-top-left-radius:1rem;
        border-bottom-left-radius:1rem;
    }
    div#${customMenu.id}::-webkit-scrollbar-thumb:horizontal,
    div#${customMenu.id} *::-webkit-scrollbar-thumb:horizontal{
        background-color:#0000;
        border-bottom:.2rem solid #000F;
        border-radius:0;
    }
    div#${customMenu.id}:hover::-webkit-scrollbar-thumb:horizontal,
    div#${customMenu.id} *:hover::-webkit-scrollbar-thumb:horizontal{
        background-color:#000F;
        box-shadow:inset 0 .4rem .4rem 0 #0A0F;
        border:none;
        border-top-left-radius:1rem;
        border-top-right-radius:1rem;
    }
    div#${customMenu.id}:hover::-webkit-scrollbar-thumb:hover:vertical,
    div#${customMenu.id} *:hover::-webkit-scrollbar-thumb:hover:vertical{box-shadow:inset .4rem 0 .4rem 0 #0F0F;}
    div#${customMenu.id}:hover::-webkit-scrollbar-thumb:hover:horizontal,
    div#${customMenu.id} *:hover::-webkit-scrollbar-thumb:hover:horizontal{box-shadow:inset 0 .4rem .4rem 0 #0F0F;}
    div#${customMenu.id}::-webkit-scrollbar-track,
    div#${customMenu.id} *::-webkit-scrollbar-track,
    div#${customMenu.id}::-webkit-scrollbar-track-piece,
    div#${customMenu.id} *::-webkit-scrollbar-track-piece,
    div#${customMenu.id}::-webkit-scrollbar-corner,
    div#${customMenu.id} *::-webkit-scrollbar-corner{display:none;background-color:#0000;}
`;
customMenu.append(customMenuStyle);
/**@type {HTMLDivElement} container (list) for the {@linkcode OVERLAYS} with visibility toggle and delete button */
const overlayContainer=document.createElement("div");
overlayContainer.style.maxHeight="10rem";
overlayContainer.style.overflow="overlay";
overlayContainer.style.display="flex";
overlayContainer.style.flexFlow="column";
overlayContainer.style.border="2px outset #000";
overlayContainer.style.borderRadius=".3rem";
overlayContainer.style.backgroundColor="#333";
overlayContainer.style.padding=".1rem .3rem";

//~ add existing overlays (no delete button)
for(let i=0;i<OVERLAYS.length;i++){
    const[name,url]=OVERLAYS[i];
    const toggleIndex=overlayToggles?.[i]?.name===name?i:overlayToggles.findIndex(v=>v.name===name),
        text=document.createElement("span"),
        group=document.createElement("div");
    text.textContent=name;
    text.title=url;
    group.id=name;
    group.style.minWidth="max-content";
    if(toggleIndex===-1){
        const toggle=createEyeToggle(readStorage(`overlay_${name}`)==="true");
        toggle.name=name;
        toggle.addEventListener("change",()=>{
            "use strict";
            saveStorage(`overlay_${name}`,toggle.checked?"true":"false");
        },{passive:true});
        group.append(toggle.parentElement,text);
    }else group.append(overlayToggles[toggleIndex].parentElement,text);
    overlayContainer.append(group);
}
/**
 * ## styles an HTML element to fit the rest of the r/place canvas UI
 * @param {HTMLElement} element - an HTML element
 */
const setupStyle=element=>{
    "use strict";
    element.style.backgroundColor="#333";
    element.style.color="#FFF";
    element.style.border="2px #000 outset";
    element.style.borderRadius=".3rem";
};
/**
 * ## creates a button (input element)
 * @param {string} title - the text on the button
 * @param {string} tooltip - tooltip text
 * @param {((ev:MouseEvent)=>void|Promise<void>)|null} onClick - `click` event of the button (passive)
 * @returns {HTMLInputElement} the button element
 */
const createButton=(title,tooltip,onClick)=>{
    "use strict";
    const input=document.createElement("input");
    input.type="button";
    input.value=title;
    input.title=tooltip;
    if(onClick!=null)input.addEventListener("click",onClick,{passive:true});
    setupStyle(input);
    input.style.padding=".4rem";
    input.style.cursor="pointer";
    return input;
};
/**
 * ## creates a slider [0.00 to 1.00] (input element with label as parent)
 * @param {string} title - the text before the slider
 * @param {string} tooltip - tooltip text
 * @param {string} defaultValue - default value of slider [0.00 to 1.00] (number)
 * @param {((ev:Event)=>void|Promise<void>)|null} onInput - `input` event of the slider (passive)
 * @returns {HTMLInputElement&{get parentElement():HTMLLabelElement}} the slider element (use `parentElement` to append to DOM)
 */
const createSlider=(title,tooltip,defaultValue,onInput)=>{
    "use strict";
    const label=document.createElement("label");
    label.title=tooltip;
    setupStyle(label);
    label.style.padding=".3rem .2rem";
    label.style.textAlign="center";
    const input=document.createElement("input");
    input.type="range";
    input.min="0";
    input.max="1";
    input.step="0.01";
    input.value=defaultValue;
    if(onInput!=null)input.addEventListener("input",onInput,{passive:true});
    input.style.display="block";
    label.append(title,input);
    //@ts-ignore the parent element of `input` is `label`
    return input;
};
/**
 * ## create an svg camera button element
 * adds tooltip "take a screenshot"
 * @param {((ev:MouseEvent)=>void|Promise<void>)|null} onClick - `click` event of the button (passive)
 * @returns {HTMLLabelElement} the parent element of the screenshot button
 */
const createScreenshotButton=onClick=>{
    "use strict";
    const label=document.createElement("label"),
        input=document.createElement("input"),
        svg=document.createElementNS("http://www.w3.org/2000/svg","svg"),
        svgPath=document.createElementNS("http://www.w3.org/2000/svg","path");
    svgPath.setAttribute("d","M-4.8-2a1 1 0 011-1h1.5c.75 0 .4-1 1.5-1h1.6c1.1 0 .75 1 1.5 1h1.5a1 1 0 011 1v5a1 1 0 01-1 1h-7.6a1 1 0 01-1-1zM0-1.5a2 2 0 10.001 0zM0-.5a1 1 0 10.001 0z");
    svg.setAttribute("viewBox","-5-5 10 10");
    svg.setAttribute("fill","#F90");
    svg.style.height="1.7rem";
    svg.style.padding=".2rem";
    svg.style.verticalAlign="-.5rem";
    svg.append(svgPath);
    input.type="button";
    input.style.opacity="0";
    input.style.padding="0";
    input.style.border="0";
    if(onClick!=null)input.addEventListener("click",onClick,{passive:true});
    label.title="take a screenshot";
    setupStyle(label);
    label.style.cursor="pointer";
    label.append(input,svg);
    return label;
};

/**@type {HTMLCanvasElement} the overlay canvas*/
const overlayCanvas=document.createElement("canvas");
overlayCanvas.height=CANVAS_SIZE[1]*3;
overlayCanvas.width=CANVAS_SIZE[0]*3;
overlayCanvas.style.position="absolute";
overlayCanvas.style.left="0px";
overlayCanvas.style.top="0px";
overlayCanvas.style.width=`${CANVAS_SIZE[0]}px`;
overlayCanvas.style.height=`${CANVAS_SIZE[1]}px`;
overlayCanvas.style.pointerEvents="none";
/**@type {CanvasRenderingContext2D|null} 2d context of {@linkcode overlayCanvas}*/
const overlayContext=overlayCanvas.getContext("2d");
if(overlayContext==null)throw new ReferenceError("[rPlaceOverlays] could not get overlay canvas 2d context");
overlayContext.imageSmoothingEnabled=false;

/**@type {HTMLImageElement} temp image to render*/
const tempImage=document.createElement("img");
tempImage.style.position="absolute"
tempImage.style.transform="translate(-50%,-50%)";
tempImage.style.pointerEvents="none";
/**@type {[number,number]} position of {@linkcode tempImage} `[x, y]` coordinates are from {@linkcode ORIGIN_OFFSET} (this array is sealed)*/
const tempImagePos=(storedValue=>{
    "use strict";
    if(storedValue==null)return Object.seal([0,0]);
    const parsed=JSON.parse(storedValue);
    if(
        Array.isArray(parsed)
        &&parsed.length!==2
        &&typeof parsed[0]==="number"
        &&typeof parsed[1]==="number"
    ){
        /**@type {[number,number]}*/
        //@ts-ignore above condition checks for [number,number]
        const checked=Object.seal(parsed);
        return checked;
    }
    return Object.seal([0,0]);
})(readStorage("tempImagePos"));
saveStorage("tempImagePos",JSON.stringify(tempImagePos));
/**@type {[number,number]} size of {@linkcode tempImage} `[width, height]` (this array is sealed)*/
const tempImageSize=(storedValue=>{
    "use strict";
    if(storedValue==null)return Object.seal([0,0]);
    const parsed=JSON.parse(storedValue);
    if(
        Array.isArray(parsed)
        &&parsed.length!==2
        &&typeof parsed[0]==="number"
        &&typeof parsed[1]==="number"
    ){
        /**@type {[number,number]}*/
        //@ts-ignore above condition checks for [number,number]
        const checked=Object.seal(parsed);
        return checked;
    }
    return Object.seal([0,0]);
})(readStorage("tempImageSize"));
saveStorage("tempImageSize",JSON.stringify(tempImageSize));

/**
 * ## add a custom overlay to {@linkcode OVERLAYS}, {@linkcode overlayToggles}, {@linkcode overlayContainer}, and saves it in local storage
 * @param {string} name - name of the overlay (check uniqueness first!)
 * @param {string} url - image URL of the overlay template (check uniqueness first!)
 */
const addOverlay=(name,url)=>{
    "use strict";
    OVERLAYS.push(Object.freeze([name,url]));
    saveStorage("customOverlays",JSON.stringify(OVERLAYS.slice(DEFAULT_OVERLAYS)));
    const toggle=createEyeToggle(true),
        text=document.createElement("span"),
        remove=createDelButton(()=>{
            "use strict";
            removeOverlay(name);
        }),
        group=document.createElement("div");
    toggle.addEventListener("change",()=>{
        "use strict";
        saveStorage(`overlay_${name}`,toggle.checked?"true":"false");
    },{passive:true});
    overlayToggles.push(toggle);
    text.textContent=name;
    text.title=url;
    group.id=name;
    group.style.minWidth="max-content";
    group.append(toggle.parentElement,text,remove.parentElement);
    overlayContainer.append(group);
};
/**
 * ## remove a custom overlay from {@linkcode OVERLAYS}, {@linkcode overlayToggles}, {@linkcode overlayContainer}, and local storage
 * _does nothing if it couldn't find the overlay by name_
 * @param {string} name - name of overlay to remove
 */
const removeOverlay=name=>{
    "use strict";
    const overlayIndex=OVERLAYS.findIndex(v=>v[0]===name),
        toggleIndex=overlayToggles[overlayIndex]?.name===name?overlayIndex:overlayToggles.findIndex(v=>v.name===name),
        overlayHTML=overlayContainer.children.namedItem(name);
    if(overlayIndex===-1||toggleIndex===-1||overlayHTML==null)return;
    overlayHTML.remove();
    overlayToggles.splice(toggleIndex,1);
    OVERLAYS.splice(overlayIndex,1);
    saveStorage("customOverlays",JSON.stringify(OVERLAYS.slice(DEFAULT_OVERLAYS)));
    removeStorage(`overlay_${name}`);
};
/**
 * ## take a screenshot of the r/place canvas and download it as a PNG
 * _format: `r_place-[UTC millisecond timestamp from year 0].png`_
 */
const placeCanvasScreenshot=()=>{
    "use strict";
    /**@type {HTMLCanvasElement|null} r/place canvas element*/
    const canvas=document.querySelector("garlic-bread-embed")?.shadowRoot?.querySelector(".layout garlic-bread-canvas")?.shadowRoot?.querySelector("canvas")??null;
    if(canvas==null)throw new ReferenceError("[rPlaceOverlays] place canvas could not be located");
    const a=document.createElement("a");
    a.href=canvas.toDataURL("image/png");
    a.download=`r_place-${(BigInt(Date.now())+0x3880D1649800n).toString()}.png`;
    a.click();
};
/**
 * ## prompts the user for name and URL for a new overlay ({@linkcode OVERLAYS})
 * _checks uniqueness and URL source_
 * @returns {Promise<readonly[string,string]|null>} `[unique name, image URL]` for new overlay or `null` if canceled by user
 */
const promptNewOverlay=async()=>{
    // TODO name & url input fields - check on input if already exists (notice that it can't be changed later) - OK and ABORT button (validate URL when OK button is pressed ! user feedback while waiting ?)
    //? check url → OVERLAYS.every(v=>v[1]!==url)
    //? check name → OVERLAYS.every(v=>v[0]!==name)
    //? validate url (async) → await checkImageURL(url)
    return null;
};
/**
 * ## prompts the user for an image URL for {@linkcode tempImage}
 * _checks URL source_
 * @returns {Promise<string|null>} the image URL for temp image or `null` if canceled by user
 */
const promptSetTempImage=async()=>{
    // TODO url input field - OK and ABORT button (validate URL when OK button is pressed ! user feedback while waiting ?)
    //? validate url (async) → await checkImageURL(url)
    return null;
    // TODO ~ add support for drap drop files https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
    // TODO ~ add support for clipboard image https://stackoverflow.com/a/15369753/13282166
};

//~ start when HTML has finished loading
window.addEventListener("DOMContentLoaded",async()=>{
    "use strict";
    //~ log time
    const timeLoadStart=performance.now();
    console.log("%c[rPlaceOverlays] overlays started loading at %f ms (took %f ms since script loading ended)","background-color:#000;color:#F90;font-style:italic;font-size:larger",timeLoadStart.toFixed(3),(timeLoadStart-timeScriptEnd).toFixed(3));
    //~ find r/place canvas or stop script
    const placeLayout=document.querySelector("garlic-bread-embed")?.shadowRoot?.querySelector(".layout");
    if(placeLayout==null){
        if(window.top!==window.self)throw new ReferenceError("[rPlaceOverlays] place canvas layout couldn't be located");
        return;
    }
    const placeContainer=placeLayout.querySelector("garlic-bread-canvas")?.shadowRoot?.querySelector(".container");
    if(placeContainer==null){
        if(window.top!==window.self)throw new ReferenceError("[rPlaceOverlays] place canvas container couldn't be located");
        return;
    }
    //~ create overlays area
    const overlayArea=document.createElement("fieldset");
    overlayArea.style.display="flex";
    overlayArea.style.flexFlow="column";
    overlayArea.style.gap=".4rem";
    overlayArea.style.borderRadius=".3rem";
    const overlayAreaTitle=document.createElement("legend");
    overlayAreaTitle.textContent="Overlays";
    const overlayOpacity=createSlider("Opacity","Set opacity of all overlays above",readStorage("overlayOpacity")??"1",()=>{
        "use strict";
        saveStorage("overlayOpacity",overlayCanvas.style.opacity=overlayOpacity.value);
    });
    saveStorage("overlayOpacity",overlayCanvas.style.opacity=overlayOpacity.value);
    overlayArea.append(
        overlayAreaTitle,
        createButton("New overlay","Add an overlay to the list below",async()=>{
            "use strict";
            const overlay=await promptNewOverlay();
            if(overlay==null)return;
            addOverlay(...overlay);
            drawOverlays();
        }),
        overlayContainer,
        createButton("Update Overlays","Redraw all overlays above (fetches the images again)",drawOverlays),
        overlayOpacity.parentElement
    );
    //~ create tempoary image area
    const tempImageArea=document.createElement("fieldset");
    tempImageArea.style.display="flex";
    tempImageArea.style.flexFlow="column";
    tempImageArea.style.gap=".4rem";
    tempImageArea.style.borderRadius=".3rem";
    const tempImageAreaTitle=document.createElement("legend");
    tempImageAreaTitle.textContent="Temporary image";
    const tempImageOpacity=createSlider("Opacity","Set opacity for the temporary image overlay",readStorage("tempImageOpacity")??"0",()=>{
        "use strict";
        saveStorage("tempImageOpacity",tempImage.style.opacity=tempImageOpacity.value)
    });
    saveStorage("tempImageOpacity",tempImage.style.opacity=tempImageOpacity.value);
    //~ create temporary image position area
    const tempImagePosArea=document.createElement("fieldset");
    tempImagePosArea.style.display="flex";
    tempImagePosArea.style.flexFlow="row nowrap";
    tempImagePosArea.style.gap=".4rem";
    tempImagePosArea.style.borderRadius=".3rem";
    const tempImagePosAreaTitle=document.createElement("legend");
    tempImagePosAreaTitle.textContent="Position";
    const[tempImagePosX,tempImagePosY,tempImageSizeW,tempImageSizeH,tempImageSizeScale]=[null,null,null,null,null].map(()=>{
        "use strict";
        const input=document.createElement("input");
        input.type="number";
        input.min=Number.MIN_SAFE_INTEGER.toString();
        input.max=Number.MAX_SAFE_INTEGER.toString();
        input.step="1";
        setupStyle(input);
        input.style.width="3rem";
        return input;
    });
    tempImagePosX.value=tempImagePos[0].toString();
    tempImagePosX.title="set X position of temporary image";
    tempImagePosX.addEventListener("input",()=>{
        "use strict";
        tempImagePosX.value=(tempImagePos[0]=Math.max(Math.min(Number(tempImagePosX.value)||0,Number.MAX_SAFE_INTEGER),Number.MIN_SAFE_INTEGER)).toString();
        saveStorage("tempImagePos",JSON.stringify(tempImagePos));
        displayTempImage();
    },{passive:true});
    tempImagePosY.value=tempImagePos[1].toString();
    tempImagePosY.title="set Y position of temporary image";
    tempImagePosY.addEventListener("input",()=>{
        "use strict";
        tempImagePosY.value=(tempImagePos[1]=Math.max(Math.min(Number(tempImagePosY.value)||0,Number.MAX_SAFE_INTEGER),Number.MIN_SAFE_INTEGER)).toString();
        saveStorage("tempImagePos",JSON.stringify(tempImagePos));
        displayTempImage();
    },{passive:true});
    tempImagePosArea.append(
        tempImagePosAreaTitle,
        tempImagePosX,
        tempImagePosY
    );
    //~ create temporary image size area
    const tempImageSizeArea=document.createElement("fieldset");
    tempImageSizeArea.style.display="grid";
    tempImageSizeArea.style.grid="auto / auto auto";
    tempImageSizeArea.style.gap=".4rem";
    tempImageSizeArea.style.borderRadius=".3rem";
    const tempImageSizeAreaTitle=document.createElement("legend");
    tempImageSizeAreaTitle.textContent="Size";
    const tempImageSizeWAuto=createButton("Auto","Scale the width automatically to the height",()=>{
            "use strict";
            if(tempImageSizeWAuto.dataset?.toggle==="1"){
                tempImageSizeW.readOnly=false;
                tempImageSizeW.style.backgroundColor="#333";
                tempImageSizeHAuto.disabled=false;
                tempImageSizeHAuto.style.backgroundColor="#333";
                tempImageSizeWAuto.dataset.toggle="0";
                tempImageSizeWAuto.style.backgroundColor="#333";
                saveStorage("tempImageSizeAuto","N");
            }else{
                tempImageSizeW.readOnly=true;
                tempImageSizeW.style.backgroundColor="#222";
                tempImageSizeHAuto.disabled=true;
                tempImageSizeHAuto.style.backgroundColor="#222";
                tempImageSizeWAuto.dataset.toggle="1";
                tempImageSizeWAuto.style.backgroundColor="#950";
                saveStorage("tempImageSizeAuto","W");
            }
            displayTempImage();
        }),
        tempImageSizeHAuto=createButton("Auto","Scale the height automatically to the width",()=>{
            "use strict";
            if(tempImageSizeHAuto.dataset?.toggle==="1"){
                tempImageSizeH.readOnly=false;
                tempImageSizeH.style.backgroundColor="#333";
                tempImageSizeWAuto.disabled=false;
                tempImageSizeWAuto.style.backgroundColor="#333";
                tempImageSizeHAuto.dataset.toggle="0";
                tempImageSizeHAuto.style.backgroundColor="#333";
                saveStorage("tempImageSizeAuto","N");
            }else{
                tempImageSizeH.readOnly=true;
                tempImageSizeH.style.backgroundColor="#222";
                tempImageSizeWAuto.disabled=true;
                tempImageSizeWAuto.style.backgroundColor="#222";
                tempImageSizeHAuto.dataset.toggle="1";
                tempImageSizeHAuto.style.backgroundColor="#950";
                saveStorage("tempImageSizeAuto","H");
            }
            displayTempImage();
        }),
        tempImageSizeReset=createButton("Reset","Reset image width / height to original values (and turns off auto scale)",()=>{
            "use strict";
            tempImageSizeW.value=(tempImageSize[0]=tempImage.naturalWidth).toString();
            tempImageSizeH.value=(tempImageSize[1]=tempImage.naturalHeight).toString();
            if(tempImageSizeWAuto.dataset?.toggle==="1"){
                tempImageSizeW.readOnly=false;
                tempImageSizeHAuto.disabled=false;
                tempImageSizeWAuto.dataset.toggle="0";
            }else if(tempImageSizeHAuto.dataset?.toggle==="1"){
                tempImageSizeH.readOnly=false;
                tempImageSizeWAuto.disabled=false;
                tempImageSizeHAuto.dataset.toggle="0";
            }
        });
    tempImageSizeWAuto.dataset.toggle="0";
    tempImageSizeHAuto.dataset.toggle="0";
    switch(readStorage("tempImageSizeAuto")){
        case"W":tempImageSizeWAuto.click();break;
        case"H":tempImageSizeHAuto.click();break;
    }
    tempImageSizeReset.style.gridArea="3/1/4/3";
    tempImageSizeW.min="0";
    tempImageSizeW.value=tempImageSize[0].toString();
    tempImageSizeW.title="Set the width of the temporary image";
    tempImageSizeW.addEventListener("input",()=>{
        "use strict";
        tempImageSizeW.value=(tempImageSize[0]=Math.max(Math.min(Number(tempImageSizeW.value)||0,Number.MAX_SAFE_INTEGER),0)).toString();
        saveStorage("tempImageSize",JSON.stringify(tempImageSize));
        displayTempImage();
    },{passive:true});
    tempImageSizeH.min="0";
    tempImageSizeH.value=tempImageSize[1].toString();
    tempImageSizeH.title="Set the height of the temporary image";
    tempImageSizeH.addEventListener("input",()=>{
        "use strict";
        tempImageSizeH.value=(tempImageSize[1]=Math.max(Math.min(Number(tempImageSizeH.value)||0,Number.MAX_SAFE_INTEGER),0)).toString();
        saveStorage("tempImageSize",JSON.stringify(tempImageSize));
        displayTempImage();
    },{passive:true});
    tempImageSizeArea.append(
        tempImageSizeAreaTitle,
        tempImageSizeW,
        tempImageSizeH,
        tempImageSizeWAuto,
        tempImageSizeHAuto,
        tempImageSizeReset
    );
    const tempImageRenderer=createButton("pixelate Image","Toggle pixelated image rendering",()=>{
        "use strict";
        if(tempImageRenderer.dataset?.toggle==="1"){
            tempImage.style.imageRendering="auto";
            tempImageRenderer.dataset.toggle="0";
            tempImageRenderer.style.backgroundColor="#333";
            saveStorage("tempImageRenderer","A");
        }else{
            tempImage.style.imageRendering="pixelated";
            tempImageRenderer.dataset.toggle="1";
            tempImageRenderer.style.backgroundColor="#950";
            saveStorage("tempImageRenderer","P");
        }
    });
    if(readStorage("tempImageRenderer")==="P"){
        tempImage.style.imageRendering="pixelated";
        tempImageRenderer.dataset.toggle="1";
        tempImageRenderer.style.backgroundColor="#950";
        saveStorage("tempImageRenderer","P");
    }else{
        tempImage.style.imageRendering="auto";
        tempImageRenderer.dataset.toggle="0";
        tempImageRenderer.style.backgroundColor="#333";
        saveStorage("tempImageRenderer","A");
    }
    tempImageArea.append(
        tempImageAreaTitle,
        createButton("Set image","Set the temporary image to a new image",async()=>{
            "use strict";
            const input=await promptSetTempImage();
            if(input==null)return;
            tempImage.src=input;
            // TODO save URL with compression
            displayTempImage();
        }),
        tempImagePosArea,
        tempImageSizeArea,
        tempImageRenderer,
        tempImageOpacity.parentElement
    );
    //~ add all to menu and onto HTML then render overlays
    customMenu.append(
        createScreenshotButton(placeCanvasScreenshot),
        overlayArea,
        tempImageArea,
        createButton("Clear stored settings","Removes all saved settings and reloads the page",()=>{
            "use strict";
            clearStorage();
            window.location.reload();
        })
    );
    placeLayout.append(customMenu);
    placeContainer.append(overlayCanvas,tempImage);
    drawOverlays();
    displayTempImage();
    //~ log time
    const timeLoadEnd=performance.now();
    console.log("%c[rPlaceOverlays] overlays fished loading at %f ms (took %f ms)","background-color:#000;color:#F90;font-style:italic;font-size:larger",timeLoadEnd.toFixed(3),(timeLoadEnd-timeLoadStart).toFixed(3));
},{passive:true,once:true});
//~ log time
const timeScriptEnd=performance.now();
console.log("%c[rPlaceOverlays] script loading ended at %f ms (took %f ms)","background-color:#000;color:#F90;font-style:italic;font-size:larger",timeScriptEnd.toFixed(3),(timeScriptEnd-timeScriptStart).toFixed(3));
