const board = document.getElementById("board");
const world = document.getElementById("world");
const yarnLayer = document.getElementById("yarn-layer");

const contextMenu = document.getElementById("context-menu");
const stringMenu = document.getElementById("string-menu");
const colorWheel = document.getElementById("color-wheel");

const menuSticky = document.getElementById("menu-sticky");
const menuDocument = document.getElementById("menu-document");
const menuEvidence = document.getElementById("menu-evidence");
const menuPhoto = document.getElementById("menu-photo");
const menuWebclip = document.getElementById("menu-webclip");
const menuTack = document.getElementById("menu-tack");
const menuCenter = document.getElementById("menu-center");
const menuSaveFile = document.getElementById("menu-save-file");
const menuLoadFile = document.getElementById("menu-load-file");
const menuClear = document.getElementById("menu-clear");

const stringAddLabel = document.getElementById("string-add-label");
const stringDelete = document.getElementById("string-delete");

const imageInput = document.getElementById("image-input");
const boardFileInput = document.getElementById("board-file-input");

const markerTool = document.getElementById("marker-tool");
const eraserTool = document.getElementById("eraser-tool");
const boardSearch = document.getElementById("board-search");

const minimap = document.getElementById("minimap");
const minimapCtx = minimap ? minimap.getContext("2d") : null;

const STORAGE_KEY = "corkboardV2";
const WORLD_SIZE = 20000;

let nextId = 1;

let camera = {
    x: -9000,
    y: -9000,
    zoom: 1
};

let spawnX = 10000;
let spawnY = 10000;

let yarns = [];
let yarnStartTack = null;
let activeYarn = null;
let activeYarnPath = null;
let selectedStringHit = null;

let activeTwang = null;
let audioContext = null;

let isPanning = false;
let panStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };
let spaceHeld = false;

let touchMode = null;
let lastTouchDistance = null;
let lastTouchMidpoint = null;

let activeTool = null;
let isDrawing = false;
let currentCanvas = null;
let currentContext = null;
let lastDrawPoint = null;
let markerColor = "#ff0000";

let selectedItems = new Set();
let isSavingFile = false;
let isAddingWebclip = false;

let lastBoardState = null;

setup();
loadBoard();
updateCamera();

function setup() {
    setupMenus();
    setupCamera();
    setupYarnDrawing();
    setupDrawingTools();
    setupSearch();
    setupMinimap();
}

function setupMenus() {
    window.addEventListener("contextmenu", (e) => {
        e.preventDefault();

        if (e.target.closest("#tool-dock")) return;

        if (activeTool === "marker") {
            hideContextMenu();
            hideStringMenu();

            showColorWheel("marker", e.clientX, e.clientY, yarnColorOptions());
            return;
        }

        const clickedTack = e.target.closest(".tack");

        if (clickedTack) {
            yarnStartTack = clickedTack;

            hideContextMenu();
            hideStringMenu();

            showColorWheel("yarn", e.clientX, e.clientY, yarnColorOptions());
            return;
        }

        if (!isNearAnyTack(e.clientX, e.clientY, 36)) {
            const stringHit = findYarnSegmentNearScreenPoint(e.clientX, e.clientY, 24);

            if (stringHit) {
                selectedStringHit = stringHit;

                hideContextMenu();
                hideColorWheel();

                showMenu(stringMenu, e.clientX, e.clientY);
                return;
            }
        }

        const clickedBoardArea =
            e.target === board ||
            e.target === world ||
            e.target === yarnLayer ||
            e.target.classList.contains("draw-layer") ||
            e.target.closest(".board-item");

        if (!clickedBoardArea) return;

        const pos = screenToWorld(e.clientX, e.clientY);
        spawnX = pos.x;
        spawnY = pos.y;

        hideColorWheel();
        hideStringMenu();
        showMenu(contextMenu, e.clientX, e.clientY);
    });

    menuSticky.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        hideContextMenu();

        showColorWheel("sticky", e.clientX, e.clientY, [
            { name: "red", value: "#ff6b6b" },
            { name: "orange", value: "#ffb347" },
            { name: "yellow", value: "#fff799" },
            { name: "green", value: "#b9ffb0" },
            { name: "cyan", value: "#9ff7ff" },
            { name: "blue", value: "#aee5ff" },
            { name: "purple", value: "#d6b3ff" },
            { name: "pink", value: "#ffb6d5" },
            { name: "white", value: "#f7f7f7" }
        ]);
    });

    menuDocument.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        createDocument(spawnX, spawnY, "Untitled Document", "", true);
        hideContextMenu();
    });

    menuEvidence.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        createEvidence(spawnX, spawnY, "Evidence", "Unknown", "", true);
        hideContextMenu();
    });

    menuTack.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        createTack(spawnX, spawnY, true);
        hideContextMenu();
    });

    menuPhoto.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideContextMenu();
        imageInput.click();
    });

    menuWebclip.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isAddingWebclip) return;
        isAddingWebclip = true;

        hideContextMenu();

        const url = prompt("Paste web link:");

        if (!url) {
            isAddingWebclip = false;
            return;
        }

        const clip = makeWebClipData(url);

        createWebClip(
            spawnX,
            spawnY,
            clip.title,
            clip.url,
            clip.image,
            "",
            true
        );

        saveBoard();

        setTimeout(() => {
            isAddingWebclip = false;
        }, 300);
    });

    menuCenter.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        centerCamera();
        hideContextMenu();
        saveBoard();
    });

    menuSaveFile.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideContextMenu();
        saveBoardToFile();
    });

    menuLoadFile.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideContextMenu();
        boardFileInput.click();
    });

    menuClear.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideContextMenu();

        if (!confirm("Clear the whole board?")) return;

        clearBoard();
    });

    stringAddLabel.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!selectedStringHit) return;

        const current = selectedStringHit.yarn.label?.text || "";
        const text = prompt("String label:", current);

        if (text !== null) {
            setStringLabel(
                selectedStringHit.yarn,
                text.trim(),
                selectedStringHit.segmentIndex,
                selectedStringHit.t,
                selectedStringHit.pathRatio
            );

            saveBoard();
        }

        hideStringMenu();
    });

    stringDelete.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!selectedStringHit) return;

        deleteStringWithAnimation(selectedStringHit.yarn);
        hideStringMenu();
    });

    imageInput.addEventListener("change", () => {
        const file = imageInput.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            createPhoto(spawnX, spawnY, reader.result, true);
            imageInput.value = "";
        };

        reader.readAsDataURL(file);
    });

    boardFileInput.addEventListener("change", () => {
        const file = boardFileInput.files[0];
        if (!file) return;

        loadBoardFromFile(file);
        boardFileInput.value = "";
    });

    document.addEventListener("click", (e) => {
        if (!contextMenu.contains(e.target)) hideContextMenu();
        if (!colorWheel.contains(e.target)) hideColorWheel();
        if (!stringMenu.contains(e.target)) hideStringMenu();

        if (
            e.target === board ||
            e.target === world ||
            e.target === yarnLayer
        ) {
            clearSelection();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (
            e.ctrlKey &&
            e.key.toLowerCase() === "z" &&
            !e.shiftKey
        ) {
            e.preventDefault();
            undoLastAction();
        }
    });

}

function yarnColorOptions() {
    return [
        { name: "red", value: "#ff0000" },
        { name: "orange", value: "#ff8800" },
        { name: "yellow", value: "#ffd400" },
        { name: "green", value: "#00cc44" },
        { name: "cyan", value: "#00d9ff" },
        { name: "blue", value: "#0066ff" },
        { name: "purple", value: "#9b4dff" },
        { name: "black", value: "#000000" },
        { name: "white", value: "#ffffff" }
    ];
}

function setupCamera() {
    window.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
            spaceHeld = true;
            document.body.style.cursor = "grab";
        }

        if (e.code === "Escape" && activeYarn) {
            cancelActiveYarn();
        }
    });

    window.addEventListener("keyup", (e) => {
        if (e.code === "Space") {
            spaceHeld = false;
            document.body.style.cursor = "default";
        }
    });

    board.addEventListener("wheel", (e) => {
        e.preventDefault();

        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        zoomAtPoint(e.clientX, e.clientY, zoomFactor);

        saveBoard();
    }, { passive: false });

    board.addEventListener("mousedown", (e) => {
        if (activeYarn || activeTool) return;

        const emptyBoard =
            e.target === board ||
            e.target === world ||
            e.target === yarnLayer;

        if (e.button === 1 || spaceHeld || emptyBoard) {
            e.preventDefault();

            isPanning = true;

            panStart.x = e.clientX;
            panStart.y = e.clientY;

            cameraStart.x = camera.x;
            cameraStart.y = camera.y;

            document.body.style.cursor = "grabbing";
        }
    });

    window.addEventListener("mousemove", (e) => {
        if (!isPanning) return;

        camera.x = cameraStart.x + (e.clientX - panStart.x);
        camera.y = cameraStart.y + (e.clientY - panStart.y);

        updateCamera();
    });

    window.addEventListener("mouseup", () => {
        if (!isPanning) return;

        isPanning = false;
        document.body.style.cursor = spaceHeld ? "grab" : "default";

        saveBoard();
    });

    board.addEventListener("touchstart", handleTouchStart, { passive: false });
    board.addEventListener("touchmove", handleTouchMove, { passive: false });
    board.addEventListener("touchend", handleTouchEnd);
    board.addEventListener("touchcancel", handleTouchEnd);
}

function handleTouchStart(e) {
    if (activeYarn || activeTool) return;

    if (e.touches.length === 1) {
        const target = e.target;

        const emptyBoard =
            target === board ||
            target === world ||
            target === yarnLayer;

        if (!emptyBoard) return;

        e.preventDefault();

        touchMode = "pan";

        panStart.x = e.touches[0].clientX;
        panStart.y = e.touches[0].clientY;

        cameraStart.x = camera.x;
        cameraStart.y = camera.y;
    }

    if (e.touches.length === 2) {
        e.preventDefault();

        touchMode = "pinch";

        lastTouchDistance = getTouchDistance(e.touches);
        lastTouchMidpoint = getTouchMidpoint(e.touches);
    }
}

function handleTouchMove(e) {
    if (touchMode === "pan" && e.touches.length === 1) {
        e.preventDefault();

        camera.x = cameraStart.x + (e.touches[0].clientX - panStart.x);
        camera.y = cameraStart.y + (e.touches[0].clientY - panStart.y);

        updateCamera();
    }

    if (e.touches.length === 2) {
        e.preventDefault();

        const newDistance = getTouchDistance(e.touches);
        const newMidpoint = getTouchMidpoint(e.touches);

        if (lastTouchDistance) {
            const zoomFactor = newDistance / lastTouchDistance;
            zoomAtPoint(newMidpoint.x, newMidpoint.y, zoomFactor, false);
        }

        if (lastTouchMidpoint) {
            camera.x += newMidpoint.x - lastTouchMidpoint.x;
            camera.y += newMidpoint.y - lastTouchMidpoint.y;
            updateCamera();
        }

        lastTouchDistance = newDistance;
        lastTouchMidpoint = newMidpoint;
    }
}

function handleTouchEnd() {
    if (touchMode) saveBoard();

    touchMode = null;
    lastTouchDistance = null;
    lastTouchMidpoint = null;
}

function createNote(x, y, text = "", color = "yellow", shouldSave = false, id = null, tackId = null, rotation = null, drawing = null) {
    const note = document.createElement("div");

    note.className = `board-item note note-${color}`;
    note.dataset.type = "note";
    note.dataset.color = color;
    note.dataset.id = id || getNewId();
    note.dataset.rotation = rotation ?? getRandomRotation();

    note.style.left = x + "px";
    note.style.top = y + "px";
    note.style.transform = `rotate(${note.dataset.rotation}deg)`;

    note.innerHTML = `
        <button class="delete-btn">×</button>
        <textarea placeholder="Write something...">${text || ""}</textarea>
    `;

    world.appendChild(note);

    setupBoardItem(note, tackId, 88, -16);
    addDrawLayer(note, drawing);

    const textarea = note.querySelector("textarea");

    autoResizeTextarea(textarea);

    textarea.addEventListener("input", () => {
        autoResizeTextarea(textarea);
        resizeItemDrawing(note);
        saveBoard();
    });

    if (shouldSave) saveBoard();

    return note;
}

function createDocument(x, y, title = "Untitled Document", body = "", shouldSave = false, id = null, tackId = null, rotation = null, drawing = null) {
    const doc = document.createElement("div");

    doc.className = "board-item document";
    doc.dataset.type = "document";
    doc.dataset.id = id || getNewId();
    doc.dataset.rotation = rotation ?? getRandomRotation();

    doc.style.left = x + "px";
    doc.style.top = y + "px";
    doc.style.transform = `rotate(${doc.dataset.rotation}deg)`;

    doc.innerHTML = `
        <button class="delete-btn">×</button>
        <input class="document-title" value="${escapeHtml(title)}">
        <textarea class="document-body" placeholder="Document text...">${body || ""}</textarea>
    `;

    world.appendChild(doc);

    setupBoardItem(doc, tackId, 108, -16);
    addDrawLayer(doc, drawing);

    doc.querySelector(".document-title").addEventListener("input", saveBoard);
    doc.querySelector(".document-body").addEventListener("input", saveBoard);

    if (shouldSave) saveBoard();

    return doc;
}

function createEvidence(x, y, title = "Evidence", tag = "Unknown", body = "", shouldSave = false, id = null, tackId = null, rotation = null, drawing = null) {
    const evidence = document.createElement("div");

    evidence.className = "board-item evidence";
    evidence.dataset.type = "evidence";
    evidence.dataset.id = id || getNewId();
    evidence.dataset.rotation = rotation ?? getRandomRotation();

    evidence.style.left = x + "px";
    evidence.style.top = y + "px";
    evidence.style.transform = `rotate(${evidence.dataset.rotation}deg)`;

    evidence.innerHTML = `
        <button class="delete-btn">×</button>
        <input class="evidence-title" value="${escapeHtml(title)}">
        <select class="evidence-tag">
            <option>Unknown</option>
            <option>Suspect</option>
            <option>Location</option>
            <option>Witness</option>
            <option>Object</option>
            <option>Event</option>
            <option>Important</option>
        </select>
        <textarea class="evidence-body" placeholder="Details...">${body || ""}</textarea>
    `;

    world.appendChild(evidence);
    evidence.querySelector(".evidence-tag").value = tag;

    setupBoardItem(evidence, tackId, 108, -16);
    addDrawLayer(evidence, drawing);

    evidence.querySelector(".evidence-title").addEventListener("input", saveBoard);
    evidence.querySelector(".evidence-tag").addEventListener("change", saveBoard);
    evidence.querySelector(".evidence-body").addEventListener("input", saveBoard);

    if (shouldSave) saveBoard();

    return evidence;
}

function createPhoto(x, y, src, shouldSave = false, id = null, tackId = null, rotation = null, drawing = null) {
    const photo = document.createElement("div");

    photo.className = "board-item photo";
    photo.dataset.type = "photo";
    photo.dataset.id = id || getNewId();
    photo.dataset.rotation = rotation ?? getRandomRotation();

    photo.style.left = x + "px";
    photo.style.top = y + "px";
    photo.style.transform = `rotate(${photo.dataset.rotation}deg)`;

    photo.innerHTML = `
        <button class="delete-btn">×</button>
        <img src="${src}" alt="Board photo" draggable="false">
    `;

    world.appendChild(photo);

    setupBoardItem(photo, tackId, 108, -16);
    addDrawLayer(photo, drawing);

    if (shouldSave) saveBoard();

    return photo;
}

function makeWebClipData(rawUrl) {
    let url = rawUrl.trim();

    if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
    }

    return {
        title: getHostnameTitle(url),
        url,
        image: "blank.png"
    };
}

function getHostnameTitle(url) {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, "");
        return hostname.split(".")[0]
            .replaceAll("-", " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    } catch {
        return "Web Clipping";
    }
}

function createWebClip(x, y, title = "Web Clipping", url = "", image = "blank.png", notes = "", shouldSave = false, id = null, tackId = null, rotation = null, drawing = null) {
    const clip = document.createElement("div");

    clip.className = "board-item webclip";
    clip.dataset.type = "webclip";
    clip.dataset.id = id || getNewId();
    clip.dataset.rotation = rotation ?? getRandomRotation();

    clip.style.left = x + "px";
    clip.style.top = y + "px";
    clip.style.transform = `rotate(${clip.dataset.rotation}deg)`;

    clip.innerHTML = `
        <button class="delete-btn">×</button>
        <img class="webclip-image" alt="Web preview" draggable="false">
        <input class="webclip-title">
        <a class="webclip-url" target="_blank" rel="noopener noreferrer"></a>
        <textarea class="webclip-notes" placeholder="Notes..."></textarea>
    `;

    world.appendChild(clip);

    const img = clip.querySelector(".webclip-image");
    img.src = image || "blank.png";
    img.onerror = () => {
        img.onerror = null;
        img.src = "blank.png";
    };

    const titleInput = clip.querySelector(".webclip-title");
    titleInput.value = title;

    const link = clip.querySelector(".webclip-url");
    link.href = url;
    link.textContent = url;

    const notesBox = clip.querySelector(".webclip-notes");
    notesBox.value = notes || "";

    setupBoardItem(clip, tackId, 118, -16);
    addDrawLayer(clip, drawing);

    titleInput.addEventListener("input", saveBoard);
    notesBox.addEventListener("input", saveBoard);

    if (shouldSave) saveBoard();

    return clip;
}

function setupBoardItem(item, tackId, tackOffsetX, tackOffsetY) {
    makeDraggable(item, () => {
        moveAttachedTacks(item);
        updateAllYarns();
        saveBoard();
    });

    item.querySelector(".delete-btn").addEventListener("click", () => {
        deleteObject(item);
    });

    createAttachedTack(item, tackOffsetX, tackOffsetY, tackId);
}

function createTack(x, y, shouldSave = false, id = null) {
    const tack = document.createElement("div");

    tack.className = "tack";
    tack.dataset.id = id || getNewId();

    tack.style.left = x + "px";
    tack.style.top = y + "px";

    world.appendChild(tack);

    makeDraggable(tack, () => {
        updateAllYarns();
        saveBoard();
    });

    tack.addEventListener("dblclick", () => {
        if (activeYarn) return;
        deleteObject(tack);
    });

    if (shouldSave) saveBoard();

    return tack;
}

function createAttachedTack(parent, offsetX, offsetY, id = null) {
    const tack = createTack(
        parent.offsetLeft + offsetX,
        parent.offsetTop + offsetY,
        false,
        id
    );

    tack.dataset.attachedTo = parent.dataset.id;
    tack.dataset.offsetX = offsetX;
    tack.dataset.offsetY = offsetY;

    tack.classList.add("attached-tack");

    return tack;
}

function moveAttachedTacks(parent) {
    const attachedTacks = document.querySelectorAll(`.tack[data-attached-to="${parent.dataset.id}"]`);

    attachedTacks.forEach(tack => {
        tack.style.left = parent.offsetLeft + Number(tack.dataset.offsetX) + "px";
        tack.style.top = parent.offsetTop + Number(tack.dataset.offsetY) + "px";
    });
}

function setupYarnDrawing() {
    window.addEventListener("pointermove", (e) => {
        if (!activeYarn) return;

        updateActiveYarnPreview(e.clientX, e.clientY);
        checkYarnWrap(e.clientX, e.clientY);
    });

    window.addEventListener("dblclick", (e) => {
        if (!activeYarn) return;

        e.preventDefault();
        finishActiveYarn();
    });

    window.addEventListener("pointerdown", startYarnTwang);
    window.addEventListener("pointermove", moveYarnTwang);
    window.addEventListener("pointerup", releaseYarnTwang);
}

function beginFreeYarn(startTack, color) {
    const startPoint = getTackCenter(startTack);

    activeYarn = {
        color,
        tackIds: [startTack.dataset.id],
        points: [startPoint],
        cursorPoint: startPoint
    };

    activeYarnPath = createYarnPath(color);
    yarnLayer.appendChild(activeYarnPath);

    startTack.classList.add("selected");

    renderActiveYarn();
}

function updateActiveYarnPreview(screenX, screenY) {
    if (!activeYarn) return;

    activeYarn.cursorPoint = screenToWorld(screenX, screenY);
    renderActiveYarn();
}

function checkYarnWrap(screenX, screenY) {
    if (!activeYarn) return;

    const lastPoint = activeYarn.points[activeYarn.points.length - 1];
    const cursorPoint = screenToWorld(screenX, screenY);

    const tacks = [...document.querySelectorAll(".tack")];

    for (const tack of tacks) {
        if (activeYarn.tackIds.includes(tack.dataset.id)) continue;

        const center = getTackCenter(tack);
        const distance = distanceFromPointToSegment(center, lastPoint, cursorPoint);

        if (distance <= 18) {
            lockYarnToTack(tack);
            return;
        }
    }
}

function lockYarnToTack(tack) {
    if (!activeYarn) return;

    const point = getTackCenter(tack);

    activeYarn.tackIds.push(tack.dataset.id);
    activeYarn.points.push(point);

    tack.classList.add("selected");

    renderActiveYarn();
}

function renderActiveYarn() {
    if (!activeYarn || !activeYarnPath) return;

    const points = [...activeYarn.points, activeYarn.cursorPoint];
    setYarnGroupPath(activeYarnPath, buildPolylinePath(points));
}

function finishActiveYarn() {
    if (!activeYarn || activeYarn.tackIds.length < 2) {
        cancelActiveYarn();
        return;
    }

    const finishedPath = activeYarnPath;

    yarns.push({
        color: activeYarn.color,
        tackIds: [...activeYarn.tackIds],
        path: finishedPath,
        label: null,
        labelElement: null
    });

    updateAllYarns();
    clearAllTackSelections();

    activeYarn = null;
    activeYarnPath = null;

    saveBoard();
}

function cancelActiveYarn() {
    if (activeYarnPath) activeYarnPath.remove();

    activeYarn = null;
    activeYarnPath = null;

    clearAllTackSelections();
}

function startYarnTwang(e) {
    if (activeYarn || activeTool) return;
    if (e.button !== 0) return;

    const hit = findYarnSegmentNearScreenPoint(e.clientX, e.clientY, 30);

    if (!hit) return;

    e.preventDefault();
    e.stopPropagation();

    const basePoint = getYarnPointAtRatio(hit.yarn, hit.pathRatio);

    activeTwang = {
        yarn: hit.yarn,
        segmentIndex: hit.segmentIndex,
        pathRatio: hit.pathRatio,
        basePoint,
        pullPoint: basePoint,
        releasePoint: null,
        frame: 0
    };

    updateAllYarns();
}

function moveYarnTwang(e) {
    if (!activeTwang) return;
    if (activeTwang.releasePoint) return;

    const cursor = screenToWorld(e.clientX, e.clientY);
    const base = activeTwang.basePoint;

    const maxStretch = 180;

    const dx = cursor.x - base.x;
    const dy = cursor.y - base.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxStretch) {
        const scale = maxStretch / distance;

        activeTwang.pullPoint = {
            x: base.x + dx * scale,
            y: base.y + dy * scale
        };
    } else {
        activeTwang.pullPoint = cursor;
    }

    updateAllYarns();
}

function releaseYarnTwang() {
    if (!activeTwang) return;

    activeTwang.releasePoint = { ...activeTwang.pullPoint };
    activeTwang.frame = 0;

    const points = getYarnPoints(activeTwang.yarn);
    const a = points[activeTwang.segmentIndex];
    const b = points[activeTwang.segmentIndex + 1];

    if (a && b) {
        const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
        const stretchAmount = Math.hypot(
            activeTwang.releasePoint.x - activeTwang.basePoint.x,
            activeTwang.releasePoint.y - activeTwang.basePoint.y
        );

        playTwangSound(segmentLength, stretchAmount);
    }

    animateYarnTwang();
}

function animateYarnTwang() {
    if (!activeTwang) return;

    const base = activeTwang.basePoint;

    if (!base) {
        activeTwang = null;
        updateAllYarns();
        return;
    }

    const strength = Math.exp(-activeTwang.frame / 12);
    const wave = Math.cos(activeTwang.frame * 0.75) * strength;

    activeTwang.pullPoint = {
        x: base.x + (activeTwang.releasePoint.x - base.x) * wave,
        y: base.y + (activeTwang.releasePoint.y - base.y) * wave
    };

    updateAllYarns();

    activeTwang.frame++;

    if (strength < 0.03) {
        activeTwang = null;
        updateAllYarns();
        return;
    }

    requestAnimationFrame(animateYarnTwang);
}

function updateAllYarns() {
    yarns.forEach(yarn => {
        const points = getYarnPoints(yarn);

        if (activeTwang && activeTwang.yarn === yarn) {
            const twangPoints = [...points];
            twangPoints.splice(activeTwang.segmentIndex + 1, 0, activeTwang.pullPoint);
            setYarnGroupPath(yarn.path, buildStraightPath(twangPoints));
        } else {
            setYarnGroupPath(yarn.path, buildPolylinePath(points));
        }
    });

    updateAllStringLabels();
    updateMinimap();
}

function getYarnPoints(yarn) {
    return yarn.tackIds
        .map(id => document.querySelector(`.tack[data-id="${id}"]`))
        .filter(Boolean)
        .map(tack => getTackCenter(tack));
}

function createYarnPath(color) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const shadow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    shadow.setAttribute("stroke", "rgba(0,0,0,0.45)");
    shadow.setAttribute("stroke-width", "7");
    shadow.setAttribute("stroke-linecap", "round");
    shadow.setAttribute("stroke-linejoin", "round");
    shadow.setAttribute("fill", "none");
    shadow.setAttribute("transform", "translate(2, 2)");

    const base = document.createElementNS("http://www.w3.org/2000/svg", "path");
    base.setAttribute("stroke", color);
    base.setAttribute("stroke-width", "4");
    base.setAttribute("stroke-linecap", "round");
    base.setAttribute("stroke-linejoin", "round");
    base.setAttribute("fill", "none");

    const hatch = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hatch.setAttribute("stroke", "rgba(255,255,255,0.35)");
    hatch.setAttribute("stroke-width", "1.2");
    hatch.setAttribute("stroke-linecap", "round");
    hatch.setAttribute("stroke-linejoin", "round");
    hatch.setAttribute("stroke-dasharray", "3 6");
    hatch.setAttribute("fill", "none");

    group.appendChild(shadow);
    group.appendChild(base);
    group.appendChild(hatch);

    group.shadowPath = shadow;
    group.mainPath = base;
    group.hatchPath = hatch;

    return group;
}

function setYarnGroupPath(group, pathData) {
    group.shadowPath.setAttribute("d", pathData);
    group.mainPath.setAttribute("d", pathData);
    group.hatchPath.setAttribute("d", pathData);
}

function setStringLabel(yarn, text, segmentIndex, t, pathRatio = null) {
    if (!text) {
        if (yarn.labelElement) yarn.labelElement.remove();

        yarn.label = null;
        yarn.labelElement = null;
        return;
    }

    yarn.label = {
        text,
        segmentIndex,
        t,
        pathRatio
    };

    if (!yarn.labelElement) {
        yarn.labelElement = document.createElement("div");
        yarn.labelElement.className = "string-label";
        world.appendChild(yarn.labelElement);
    }

    yarn.labelElement.textContent = text;

    updateStringLabel(yarn);
}

function updateStringLabel(yarn) {
    if (!yarn.label || !yarn.labelElement || !yarn.path?.mainPath) return;

    const path = yarn.path.mainPath;
    const totalLength = path.getTotalLength();

    const ratio = yarn.label.pathRatio ?? 0.5;
    const length = totalLength * ratio;

    const point = path.getPointAtLength(length);
    const ahead = path.getPointAtLength(Math.min(totalLength, length + 3));
    const behind = path.getPointAtLength(Math.max(0, length - 3));

    const angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
    const labelAngle = angle + Math.PI / 2;

    yarn.labelElement.style.left = point.x + "px";
    yarn.labelElement.style.top = point.y + "px";
    yarn.labelElement.style.transform =
        `translate(0, -50%) rotate(${labelAngle}rad)`;
}

function updateAllStringLabels() {
    yarns.forEach(updateStringLabel);
}

function hideStringMenu() {
    stringMenu.style.display = "none";
    selectedStringHit = null;
}

function deleteStringWithAnimation(yarn) {
    if (yarn.path) yarn.path.classList.add("string-cutting");
    if (yarn.labelElement) yarn.labelElement.classList.add("string-cutting");

    setTimeout(() => {
        if (yarn.path) yarn.path.remove();
        if (yarn.labelElement) yarn.labelElement.remove();

        yarns = yarns.filter(existing => existing !== yarn);
        saveBoard();
        updateMinimap();
    }, 300);
}

function buildPolylinePath(points) {
    if (!points || points.length === 0) return "";

    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];

        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;

        const dx = b.x - a.x;
        const dy = b.y - a.y;

        const distance = Math.sqrt(dx * dx + dy * dy);
        const slack = Math.min(35, distance * 0.08);

        const controlX = midX;
        const controlY = midY + slack;

        d += ` Q ${controlX} ${controlY} ${b.x} ${b.y}`;
    }

    return d;
}

function buildStraightPath(points) {
    if (!points || points.length === 0) return "";

    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`;
    }

    return d;
}

function findYarnSegmentNearScreenPoint(screenX, screenY, radius) {
    const point = screenToWorld(screenX, screenY);

    let closest = null;
    let closestDistance = Infinity;

    yarns.forEach(yarn => {
        if (!yarn.path?.mainPath) return;

        const path = yarn.path.mainPath;
        const totalLength = path.getTotalLength();
        const step = 8;

        for (let length = 0; length <= totalLength; length += step) {
            const pathPoint = path.getPointAtLength(length);

            const distance = Math.hypot(
                point.x - pathPoint.x,
                point.y - pathPoint.y
            );

            if (distance < closestDistance && distance <= radius / camera.zoom) {
                const segmentInfo = getNearestStraightSegmentInfo(yarn, pathPoint);

                closestDistance = distance;

                closest = {
                    yarn,
                    segmentIndex: segmentInfo.segmentIndex,
                    t: segmentInfo.t,
                    pathRatio: totalLength === 0 ? 0 : length / totalLength
                };
            }
        }
    });

    return closest;
}

function getNearestStraightSegmentInfo(yarn, point) {
    const points = getYarnPoints(yarn);

    let best = {
        segmentIndex: 0,
        t: 0
    };

    let bestDistance = Infinity;

    for (let i = 0; i < points.length - 1; i++) {
        const result = distanceAndTFromPointToSegment(
            point,
            points[i],
            points[i + 1]
        );

        if (result.distance < bestDistance) {
            bestDistance = result.distance;

            best = {
                segmentIndex: i,
                t: result.t
            };
        }
    }

    return best;
}

function getYarnPointAtRatio(yarn, ratio) {
    if (!yarn.path?.mainPath) return null;

    const path = yarn.path.mainPath;
    const totalLength = path.getTotalLength();

    return path.getPointAtLength(totalLength * ratio);
}

function distanceFromPointToSegment(point, a, b) {
    return distanceAndTFromPointToSegment(point, a, b).distance;
}

function distanceAndTFromPointToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    if (dx === 0 && dy === 0) {
        return {
            distance: Math.hypot(point.x - a.x, point.y - a.y),
            t: 0
        };
    }

    const rawT =
        ((point.x - a.x) * dx + (point.y - a.y) * dy) /
        (dx * dx + dy * dy);

    const t = Math.max(0, Math.min(1, rawT));

    const closestX = a.x + t * dx;
    const closestY = a.y + t * dy;

    return {
        distance: Math.hypot(point.x - closestX, point.y - closestY),
        t
    };
}

function isNearAnyTack(screenX, screenY, radius) {
    const tacks = [...document.querySelectorAll(".tack")];

    return tacks.some(tack => {
        const rect = tack.getBoundingClientRect();

        const tackX = rect.left + rect.width / 2;
        const tackY = rect.top + rect.height / 2;

        const dx = screenX - tackX;
        const dy = screenY - tackY;

        return Math.hypot(dx, dy) <= radius;
    });
}

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (
            window.AudioContext ||
            window.webkitAudioContext
        )();
    }

    return audioContext;
}

function playTwangSound(segmentLength, stretchAmount) {
    const audio = getAudioContext();

    const osc = audio.createOscillator();
    const gain = audio.createGain();

    const minLength = 100;
    const maxLength = 1200;

    const clampedLength = Math.max(minLength, Math.min(maxLength, segmentLength));
    const normalizedLength = (clampedLength - minLength) / (maxLength - minLength);

    const pitchMultiplier = 1.8 - (normalizedLength * 1.2);
    const frequency = 220 * pitchMultiplier;

    const volume = Math.min(0.25, stretchAmount / 800);

    osc.type = "triangle";
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(audio.destination);

    osc.start();
    osc.stop(audio.currentTime + 0.25);
}

function setupDrawingTools() {
    markerTool.addEventListener("click", () => {
        setActiveTool(activeTool === "marker" ? null : "marker");
    });

    eraserTool.addEventListener("click", () => {
        setActiveTool(activeTool === "eraser" ? null : "eraser");
    });
}

function setActiveTool(tool) {
    activeTool = tool;

    markerTool.classList.toggle("active", tool === "marker");
    eraserTool.classList.toggle("active", tool === "eraser");

    document.body.classList.toggle("marker-active", tool === "marker");
    document.body.classList.toggle("eraser-active", tool === "eraser");
}

function addDrawLayer(item, savedDrawing = null) {
    const canvas = document.createElement("canvas");
    canvas.className = "draw-layer";

    item.appendChild(canvas);

    resizeDrawCanvas(item, canvas);

    if (savedDrawing) {
        const img = new Image();

        img.onload = () => {
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };

        img.src = savedDrawing;
    }

    canvas.addEventListener("pointerdown", startDrawing);
    canvas.addEventListener("pointermove", drawOnCanvas);
    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointercancel", stopDrawing);
}

function resizeDrawCanvas(item, canvas) {
    const oldImage = canvas.toDataURL();

    canvas.width = item.offsetWidth;
    canvas.height = item.offsetHeight;

    if (oldImage && oldImage !== "data:,") {
        const img = new Image();

        img.onload = () => {
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };

        img.src = oldImage;
    }
}

function resizeItemDrawing(item) {
    const canvas = item.querySelector(".draw-layer");
    if (!canvas) return;

    resizeDrawCanvas(item, canvas);
}

function getCanvasPoint(canvas, e) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function startDrawing(e) {
    if (!activeTool) return;

    e.preventDefault();
    e.stopPropagation();

    isDrawing = true;
    currentCanvas = e.target;
    currentContext = currentCanvas.getContext("2d");

    lastDrawPoint = getCanvasPoint(currentCanvas, e);

    currentCanvas.setPointerCapture(e.pointerId);
}

function drawOnCanvas(e) {
    if (!isDrawing || !currentCanvas || !currentContext) return;

    e.preventDefault();
    e.stopPropagation();

    const point = getCanvasPoint(currentCanvas, e);

    currentContext.lineCap = "round";
    currentContext.lineJoin = "round";

    if (activeTool === "marker") {
        currentContext.globalCompositeOperation = "source-over";
        currentContext.strokeStyle = markerColor;
        currentContext.lineWidth = 5;
    }

    if (activeTool === "eraser") {
        currentContext.globalCompositeOperation = "destination-out";
        currentContext.lineWidth = 18;
    }

    currentContext.beginPath();
    currentContext.moveTo(lastDrawPoint.x, lastDrawPoint.y);
    currentContext.lineTo(point.x, point.y);
    currentContext.stroke();

    lastDrawPoint = point;
}

function stopDrawing(e) {
    if (!isDrawing) return;

    if (currentCanvas && currentCanvas.hasPointerCapture(e.pointerId)) {
        currentCanvas.releasePointerCapture(e.pointerId);
    }

    isDrawing = false;
    currentCanvas = null;
    currentContext = null;
    lastDrawPoint = null;

    saveBoard();
}

function makeDraggable(element, onMove) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    let lastX = 0;
    let lastY = 0;
    let groupStartPositions = [];

    element.addEventListener("pointerdown", (e) => {
        if (activeYarn || activeTool) return;
        if (e.button !== 0) return;
        if (e.target.tagName === "TEXTAREA") return;
        if (e.target.tagName === "INPUT") return;
        if (e.target.tagName === "SELECT") return;
        if (e.target.classList.contains("delete-btn")) return;
        if (element.classList.contains("attached-tack")) return;

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();

            toggleItemSelection(element);
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (selectedItems.size > 0 && !selectedItems.has(element)) {
            clearSelection();
        }

        const worldPos = screenToWorld(e.clientX, e.clientY);

        offsetX = worldPos.x - element.offsetLeft;
        offsetY = worldPos.y - element.offsetTop;

        groupStartPositions = [...selectedItems].map(item => ({
            item,
            x: item.offsetLeft,
            y: item.offsetTop
        }));

        isDragging = true;
        element.style.cursor = "grabbing";

        lastX = e.clientX;
        lastY = e.clientY;
        element.classList.add("dragging");

        element.setPointerCapture(e.pointerId);
    });

    element.addEventListener("pointermove", (e) => {
        if (!isDragging) return;

        const worldPos = screenToWorld(e.clientX, e.clientY);

        const newX = worldPos.x - offsetX;
        const newY = worldPos.y - offsetY;

        if (selectedItems.size > 0 && selectedItems.has(element)) {
            const draggedStart = groupStartPositions.find(entry => entry.item === element);

            const moveX = newX - draggedStart.x;
            const moveY = newY - draggedStart.y;

            groupStartPositions.forEach(entry => {
                entry.item.style.left = entry.x + moveX + "px";
                entry.item.style.top = entry.y + moveY + "px";

                moveAttachedTacks(entry.item);
            });
        } else {
            element.style.left = newX + "px";
            element.style.top = newY + "px";

            if (onMove) onMove();
        }

        const dx = e.clientX - lastX;
        const dragTilt = Math.max(-8, Math.min(8, dx * 0.35));
        const baseRotation = Number(element.dataset.rotation || 0);

        element.style.transform = `rotate(${baseRotation + dragTilt}deg)`;

        lastX = e.clientX;
        lastY = e.clientY;

        updateAllYarns();
    });

    element.addEventListener("pointerup", (e) => {
        if (!isDragging) return;

        isDragging = false;
        element.style.cursor = "grab";
        element.classList.remove("dragging");

        const baseRotation = Number(element.dataset.rotation || 0);
        element.style.transform = `rotate(${baseRotation}deg)`;

        if (element.hasPointerCapture(e.pointerId)) {
            element.releasePointerCapture(e.pointerId);
        }

        updateAllYarns();
        saveBoard();
    });

    element.addEventListener("pointercancel", () => {
        isDragging = false;
        element.style.cursor = "grab";
        element.classList.remove("dragging");

        const baseRotation = Number(element.dataset.rotation || 0);
        element.style.transform = `rotate(${baseRotation}deg)`;
    });
}

function toggleItemSelection(item) {
    if (selectedItems.has(item)) {
        selectedItems.delete(item);
        item.classList.remove("multi-selected");
    } else {
        selectedItems.add(item);
        item.classList.add("multi-selected");
    }
}

function clearSelection() {
    selectedItems.forEach(item => {
        item.classList.remove("multi-selected");
    });

    selectedItems.clear();
}

function deleteObject(element) {
    const id = element.dataset.id;

    const attachedTacks = document.querySelectorAll(`.tack[data-attached-to="${id}"]`);
    attachedTacks.forEach(tack => deleteObject(tack));

    yarns = yarns.filter(yarn => {
        const connected = yarn.tackIds.includes(id);

        if (connected) {
            if (yarn.path) yarn.path.remove();
            if (yarn.labelElement) yarn.labelElement.remove();
        }

        return !connected;
    });

    selectedItems.delete(element);
    element.remove();
    saveBoard();
    updateMinimap();
}

function autoResizeTextarea(textarea) {
    textarea.style.height = "auto";

    const maxHeight = 360;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = newHeight + "px";

    if (textarea.scrollHeight > maxHeight) {
        textarea.style.overflowY = "auto";
    } else {
        textarea.style.overflowY = "hidden";
    }
}

function clearAllTackSelections() {
    document.querySelectorAll(".tack.selected").forEach(tack => {
        tack.classList.remove("selected");
    });
}

function getTackCenter(tack) {
    return {
        x: tack.offsetLeft + tack.offsetWidth / 2,
        y: tack.offsetTop + tack.offsetHeight / 2
    };
}

function getBoardData() {
    const items = [...document.querySelectorAll(".board-item")].map(item => {
        const tack = document.querySelector(`.tack[data-attached-to="${item.dataset.id}"]`);

        const base = {
            id: item.dataset.id,
            type: item.dataset.type,
            x: item.offsetLeft,
            y: item.offsetTop,
            rotation: item.dataset.rotation,
            tackId: tack ? tack.dataset.id : null,
            drawing: item.querySelector(".draw-layer")?.toDataURL() || null
        };

        if (item.dataset.type === "note") {
            base.color = item.dataset.color;
            base.text = item.querySelector("textarea").value;
        }

        if (item.dataset.type === "document") {
            base.title = item.querySelector(".document-title").value;
            base.body = item.querySelector(".document-body").value;
        }

        if (item.dataset.type === "evidence") {
            base.title = item.querySelector(".evidence-title").value;
            base.tag = item.querySelector(".evidence-tag").value;
            base.body = item.querySelector(".evidence-body").value;
        }

        if (item.dataset.type === "photo") {
            base.src = item.querySelector("img").src;
        }

        if (item.dataset.type === "webclip") {
            base.title = item.querySelector(".webclip-title").value;
            base.url = item.querySelector(".webclip-url").href;
            base.image = item.querySelector(".webclip-image").src;
            base.notes = item.querySelector(".webclip-notes").value;
        }

        return base;
    });

    const looseTacks = [...document.querySelectorAll(".tack")]
        .filter(tack => !tack.dataset.attachedTo)
        .map(tack => ({
            id: tack.dataset.id,
            x: tack.offsetLeft,
            y: tack.offsetTop
        }));

    const savedYarns = yarns.map(yarn => ({
        color: yarn.color,
        tackIds: [...yarn.tackIds],
        label: yarn.label || null
    }));

    return {
        app: "Corkboard V2",
        version: 1,
        items,
        looseTacks,
        yarns: savedYarns,
        nextId,
        camera,
        hasStarterNote: true
    };
}

function saveBoard() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(getBoardData()));
    } catch (error) {
        console.warn("Save failed. Image or drawing may be too large.", error);
    }

    updateMinimap();
}

function saveUndoState() {
    try {
        lastBoardState = JSON.stringify(getBoardData());
    } catch (error) {
        console.warn("Failed to create undo state.", error);
    }
}

function undoLastAction() {
    if (!lastBoardState) return;

    try {
        const data = JSON.parse(lastBoardState);

        clearBoard(false);
        loadBoardData(data);

        saveBoard();

        lastBoardState = null;
    } catch (error) {
        console.warn("Failed to undo action.", error);
    }
}

function saveBoardToFile() {
    if (isSavingFile) return;

    isSavingFile = true;

    const data = getBoardData();
    const json = JSON.stringify(data, null, 2);

    const blob = new Blob([json], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);

    const link = document.createElement("a");
    link.href = url;
    link.download = `corkboard-${date}.corkboard`;

    document.body.appendChild(link);
    link.click();

    link.remove();
    URL.revokeObjectURL(url);

    setTimeout(() => {
        isSavingFile = false;
    }, 1000);
}

function loadBoard() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
        centerCamera();

        createNote(
            10000,
            10000,
            "Right click to add notes, images, or tacks.\n\nRight click the tacks and select the color to start a string, then drag the string around the next tack to connect it, then double click to end string.\n\nEnjoy your brainstorming.",
            "yellow",
            true
        );

        return;
    }

    const data = JSON.parse(saved);
    loadBoardData(data);
}

function loadBoardData(data) {
    document.querySelectorAll(".board-item, .tack, .string-label").forEach(el => el.remove());

    yarnLayer.innerHTML = "";
    yarns = [];
    activeYarn = null;
    activeYarnPath = null;
    activeTwang = null;
    clearSelection();

    if (!data.hasStarterNote) {
        data.items = data.items || [];

        data.items.push({
            id: getNewId(),
            type: "note",
            x: 10000,
            y: 10000,
            rotation: "0",
            color: "yellow",
            text: "Right click to add notes, images, or tacks.\n\nRight click the tacks and select the color to start a string, then drag the string around the next tack to connect it, then double click to end string.\n\nEnjoy your brainstorming.",
            tackId: getNewId(),
            drawing: null
        });

        data.hasStarterNote = true;
    }

    nextId = data.nextId || 1;
    camera = data.camera || camera;

    data.items?.forEach(item => {
        if (item.type === "note") {
            createNote(item.x, item.y, item.text, item.color, false, item.id, item.tackId, item.rotation, item.drawing);
        }

        if (item.type === "document") {
            createDocument(item.x, item.y, item.title, item.body, false, item.id, item.tackId, item.rotation, item.drawing);
        }

        if (item.type === "evidence") {
            createEvidence(item.x, item.y, item.title, item.tag, item.body, false, item.id, item.tackId, item.rotation, item.drawing);
        }

        if (item.type === "photo") {
            createPhoto(item.x, item.y, item.src, false, item.id, item.tackId, item.rotation, item.drawing);
        }

        if (item.type === "webclip") {
            createWebClip(item.x, item.y, item.title, item.url, item.image, item.notes, false, item.id, item.tackId, item.rotation, item.drawing);
        }
    });

    data.looseTacks?.forEach(tack => {
        createTack(tack.x, tack.y, false, tack.id);
    });

    data.yarns?.forEach(savedYarn => {
        const path = createYarnPath(savedYarn.color);
        yarnLayer.appendChild(path);

        const yarn = {
            color: savedYarn.color,
            tackIds: savedYarn.tackIds,
            path,
            label: savedYarn.label || null,
            labelElement: null
        };

        yarns.push(yarn);

        if (yarn.label) {
            yarn.labelElement = document.createElement("div");
            yarn.labelElement.className = "string-label";
            yarn.labelElement.textContent = yarn.label.text;
            world.appendChild(yarn.labelElement);
        }
    });

    updateAllYarns();
    updateCamera();
    saveBoard();
}

function loadBoardFromFile(file) {
    const reader = new FileReader();

    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);

            if (!data.items || !data.looseTacks || !data.yarns) {
                alert("This does not look like a valid corkboard file.");
                return;
            }

            loadBoardData(data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(getBoardData()));
        } catch (error) {
            console.error(error);
            alert("Could not load this board file.");
        }
    };

    reader.readAsText(file);
}

function clearBoard() {
    document.querySelectorAll(".board-item, .tack, .string-label").forEach(el => el.remove());

    yarnLayer.innerHTML = "";
    yarns = [];
    activeYarn = null;
    activeYarnPath = null;
    activeTwang = null;
    clearSelection();

    nextId = 1;
    centerCamera();

    localStorage.removeItem(STORAGE_KEY);
    updateMinimap();
}

function centerCamera() {
    camera.zoom = 1;
    camera.x = window.innerWidth / 2 - 10000;
    camera.y = window.innerHeight / 2 - 10000;

    updateCamera();
}

function updateCamera() {
    world.style.transform =
        `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;

    updateMinimap();
}

function zoomAtPoint(screenX, screenY, zoomFactor, shouldSave = true) {
    const oldZoom = camera.zoom;
    const newZoom = clamp(oldZoom * zoomFactor, 0.2, 3);

    const worldX = (screenX - camera.x) / oldZoom;
    const worldY = (screenY - camera.y) / oldZoom;

    camera.zoom = newZoom;

    camera.x = screenX - worldX * newZoom;
    camera.y = screenY - worldY * newZoom;

    updateCamera();

    if (shouldSave) saveBoard();
}

function screenToWorld(screenX, screenY) {
    return {
        x: (screenX - camera.x) / camera.zoom,
        y: (screenY - camera.y) / camera.zoom
    };
}

function setupSearch() {
    if (!boardSearch) return;

    boardSearch.addEventListener("input", () => {
        applySearch(boardSearch.value);
    });
}

function applySearch(query) {
    const search = query.trim().toLowerCase();

    clearSearchVisuals();

    if (!search) return;

    document.querySelectorAll(".board-item").forEach(item => {
        const text = getItemSearchText(item);

        if (text.includes(search)) {
            item.classList.add("search-match");
        } else {
            item.classList.add("search-dim");
        }
    });

    yarns.forEach(yarn => {
        const labelText = yarn.label?.text?.toLowerCase() || "";

        if (labelText.includes(search)) {
            if (yarn.labelElement) {
                yarn.labelElement.classList.add("search-label-match");
            }
        } else {
            if (yarn.path) yarn.path.classList.add("search-dim");
            if (yarn.labelElement) yarn.labelElement.classList.add("search-dim");
        }
    });
}

function clearSearchVisuals() {
    document.querySelectorAll(".search-dim").forEach(el => el.classList.remove("search-dim"));
    document.querySelectorAll(".search-match").forEach(el => el.classList.remove("search-match"));
    document.querySelectorAll(".search-label-match").forEach(el => el.classList.remove("search-label-match"));
}

function getItemSearchText(item) {
    let text = "";

    if (item.dataset.type === "note") {
        text += item.querySelector("textarea")?.value || "";
    }

    if (item.dataset.type === "document") {
        text += " " + (item.querySelector(".document-title")?.value || "");
        text += " " + (item.querySelector(".document-body")?.value || "");
    }

    if (item.dataset.type === "evidence") {
        text += " " + (item.querySelector(".evidence-title")?.value || "");
        text += " " + (item.querySelector(".evidence-tag")?.value || "");
        text += " " + (item.querySelector(".evidence-body")?.value || "");
    }

    if (item.dataset.type === "photo") {
        text += " photo image";
    }

    if (item.dataset.type === "webclip") {
        text += " " + (item.querySelector(".webclip-title")?.value || "");
        text += " " + (item.querySelector(".webclip-url")?.textContent || "");
        text += " " + (item.querySelector(".webclip-notes")?.value || "");
    }

    return text.toLowerCase();
}

function setupMinimap() {
    if (!minimap || !minimapCtx) return;

    minimap.width = 190;
    minimap.height = 190;

    minimap.addEventListener("click", (e) => {
        const rect = minimap.getBoundingClientRect();

        const mx = (e.clientX - rect.left) * (minimap.width / rect.width);
        const my = (e.clientY - rect.top) * (minimap.height / rect.height);

        const worldPos = minimapToWorld(mx, my);

        camera.x = window.innerWidth / 2 - worldPos.x * camera.zoom;
        camera.y = window.innerHeight / 2 - worldPos.y * camera.zoom;

        updateCamera();
        saveBoard();
    });

    updateMinimap();
}

function updateMinimap() {
    if (!minimap || !minimapCtx) return;

    minimapCtx.clearRect(0, 0, minimap.width, minimap.height);

    minimapCtx.fillStyle = "rgba(20,20,20,0.6)";
    minimapCtx.fillRect(0, 0, minimap.width, minimap.height);

    drawMinimapGrid();

    minimapCtx.globalAlpha = 0.65;
    drawMinimapYarns();
    drawMinimapItems();
    minimapCtx.globalAlpha = 1;

    drawMinimapCamera();
}

function drawMinimapGrid() {
    minimapCtx.strokeStyle = "rgba(255,255,255,0.08)";
    minimapCtx.lineWidth = 1;

    for (let i = 0; i <= minimap.width; i += 38) {
        minimapCtx.beginPath();
        minimapCtx.moveTo(i, 0);
        minimapCtx.lineTo(i, minimap.height);
        minimapCtx.stroke();

        minimapCtx.beginPath();
        minimapCtx.moveTo(0, i);
        minimapCtx.lineTo(minimap.width, i);
        minimapCtx.stroke();
    }
}

function drawMinimapYarns() {
    yarns.forEach(yarn => {
        const points = getYarnPoints(yarn);
        if (points.length < 2) return;

        minimapCtx.strokeStyle = yarn.color || "#ff0000";
        minimapCtx.lineWidth = 1.5;
        minimapCtx.beginPath();

        points.forEach((point, index) => {
            const mini = worldToMinimap(point.x, point.y);

            if (index === 0) {
                minimapCtx.moveTo(mini.x, mini.y);
            } else {
                minimapCtx.lineTo(mini.x, mini.y);
            }
        });

        minimapCtx.stroke();
    });
}

function drawMinimapItems() {
    document.querySelectorAll(".board-item").forEach(item => {
        const mini = worldToMinimap(
            item.offsetLeft + item.offsetWidth / 2,
            item.offsetTop + item.offsetHeight / 2
        );

        if (item.dataset.type === "note") {
            minimapCtx.fillStyle = "#fff799";
            minimapCtx.fillRect(mini.x - 4, mini.y - 4, 8, 8);
        }

        if (item.dataset.type === "document") {
            minimapCtx.fillStyle = "#eeeeee";
            minimapCtx.fillRect(mini.x - 4, mini.y - 5, 8, 10);
        }

        if (item.dataset.type === "evidence") {
            minimapCtx.fillStyle = "#ff6b6b";
            minimapCtx.fillRect(mini.x - 5, mini.y - 3, 10, 6);
        }

        if (item.dataset.type === "photo") {
            drawMinimapPolaroid(mini.x, mini.y);
        }

        if (item.dataset.type === "webclip") {
            minimapCtx.fillStyle = "#f3ead8";
            minimapCtx.fillRect(mini.x - 5, mini.y - 5, 10, 10);
            minimapCtx.fillStyle = "#111";
            minimapCtx.fillRect(mini.x - 3, mini.y - 3, 6, 3);
        }
    });

    document.querySelectorAll(".tack").forEach(tack => {
        const mini = worldToMinimap(
            tack.offsetLeft + tack.offsetWidth / 2,
            tack.offsetTop + tack.offsetHeight / 2
        );

        minimapCtx.fillStyle = "#bbbbbb";
        minimapCtx.beginPath();
        minimapCtx.arc(mini.x, mini.y, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    });
}

function drawMinimapPolaroid(x, y) {
    const w = 10;
    const h = 13;
    const border = 2;

    minimapCtx.fillStyle = "#f5f5f5";
    minimapCtx.fillRect(x - w / 2, y - h / 2, w, h);

    minimapCtx.fillStyle = "#111";
    minimapCtx.fillRect(
        x - w / 2 + border,
        y - h / 2 + border,
        w - border * 2,
        w - border * 2
    );
}

function drawMinimapCamera() {
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(window.innerWidth, window.innerHeight);

    const a = worldToMinimap(topLeft.x, topLeft.y);
    const b = worldToMinimap(bottomRight.x, bottomRight.y);

    minimapCtx.strokeStyle = "white";
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
}

function worldToMinimap(x, y) {
    return {
        x: (x / WORLD_SIZE) * minimap.width,
        y: (y / WORLD_SIZE) * minimap.height
    };
}

function minimapToWorld(x, y) {
    return {
        x: (x / minimap.width) * WORLD_SIZE,
        y: (y / minimap.height) * WORLD_SIZE
    };
}

function showMenu(menu, x, y) {
    hideColorWheel();

    menu.style.display = "flex";

    const padding = 8;
    const rect = menu.getBoundingClientRect();

    let finalX = x;
    let finalY = y;

    if (finalX + rect.width > window.innerWidth - padding) {
        finalX = window.innerWidth - rect.width - padding;
    }

    if (finalY + rect.height > window.innerHeight - padding) {
        finalY = window.innerHeight - rect.height - padding;
    }

    if (finalX < padding) finalX = padding;
    if (finalY < padding) finalY = padding;

    menu.style.left = finalX + "px";
    menu.style.top = finalY + "px";
}

function hideContextMenu() {
    contextMenu.style.display = "none";
}

function showColorWheel(mode, screenX, screenY, colors) {
    colorWheel.innerHTML = "";
    colorWheel.style.left = screenX + "px";
    colorWheel.style.top = screenY + "px";

    const radius = 65;

    colors.forEach((color, index) => {
        const angle = (Math.PI * 2 * index) / colors.length - Math.PI / 2;

        const button = document.createElement("button");
        button.className = "color-choice";

        button.style.background = color.value;
        button.style.setProperty("--x", Math.cos(angle) * radius + "px");
        button.style.setProperty("--y", Math.sin(angle) * radius + "px");
        button.title = color.name;

        button.addEventListener("click", (e) => {
            e.stopPropagation();

            if (mode === "sticky") {
                createNote(spawnX, spawnY, "", color.name, true);
            }

            if (mode === "yarn") {
                if (yarnStartTack) {
                    beginFreeYarn(yarnStartTack, color.value);
                    yarnStartTack = null;
                }
            }

            if (mode === "marker") {
                markerColor = color.value;
            }

            hideColorWheel();
        });

        colorWheel.appendChild(button);
    });

    colorWheel.style.display = "block";

    requestAnimationFrame(() => {
        colorWheel.classList.add("open");
    });
}

function hideColorWheel() {
    colorWheel.classList.remove("open");

    setTimeout(() => {
        if (!colorWheel.classList.contains("open")) {
            colorWheel.style.display = "none";
            colorWheel.innerHTML = "";
        }
    }, 150);
}

function getNewId() {
    return String(nextId++);
}

function getRandomRotation() {
    return ((Math.random() * 6) - 3).toFixed(2);
}

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;

    return Math.sqrt(dx * dx + dy * dy);
}

function getTouchMidpoint(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function escapeHtml(text) {
    return String(text ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
