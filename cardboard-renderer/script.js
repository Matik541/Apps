import * as THREE from "three"
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const container = document.getElementById('render-container');
let scene, camera, renderer, cardboardGroup;
let isRotating = false;
let isPanning = false;
let mouseX = 0, mouseY = 0;
let rotationSpeed = 0.005;
let panSpeed = 0.5;
let target = new THREE.Vector3(0, 0, 0); // Nowy punkt docelowy kamery
let orthoCamera, perspectiveCamera;
let isOrtho = false;



const cardboardData = [
    {
        "id": "Wymyślony karton",
        "name": "Wymyślony karton",
        "width": 350,
        "depth": 200,
        "tooths": [10, 15, 50, 50, 50, 50, 50, 15, 10],
        "gap": 3,
        "margin": 10
    },
]

async function fetchCardboardData() {
    if (url === undefined) {
        console.error("URL not defined. Create a secret.js file with the URL variable.");
        return;
    }
    try {
        const response = await fetch(url);
        const data = await response.json();

        cardboardData.push(...data);
        console.log("Fetched cardboard data:", cardboardData);

        init();
        animate();

    } catch (error) {
        console.error("Error fetching cardboard data:", error);
    }
}
fetchCardboardData();

let selectedCardboards

let selectedNotches = {
    axis1: {},
    axis2: {}
};

let THICKNESS = cardboardData[0].thickness ?? 3;

let tileDimensions = { w: 50, d: 50, h: 50, m: 2 };

function init() {
    selectedCardboards = {
        axis1: cardboardData[0].id,
        axis2: cardboardData[0].id
    };

    // Kamera perspektywiczna
    perspectiveCamera = new THREE.PerspectiveCamera(
        75, container.clientWidth / container.clientHeight, 0.1, 2000
    );
    perspectiveCamera.position.set(-250, 300, 250);
    perspectiveCamera.lookAt(target);

    // Kamera ortograficzna (izometryczna)
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 500; // wielkość sceny w ortho
    orthoCamera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        -2000, 2000
    );
    orthoCamera.position.set(-250, 300, 250);
    orthoCamera.lookAt(target);

    // Domyślnie używamy perspektywicznej
    camera = perspectiveCamera;


    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(-250, 300, 250);
    camera.lookAt(target); // Kamera patrzy na punkt docelowy

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // add light
    const ambientLight = new THREE.AmbientLight(0xffffff); // soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);


    cardboardGroup = new THREE.Group();
    scene.add(cardboardGroup);

    // Usunięto początkową rotację cardboardGroup

    for (const axis of ['axis1', 'axis2']) {
        cardboardData.forEach(c => {
            selectedNotches[axis][c.id] = new Array(c.tooths.length + 1).fill(false);
        });
    }

    setupControlsUI();
    renderLattice();
}

function setupControlsUI() {
    const panelsContainer = document.getElementById('cardboard-panels');
    panelsContainer.innerHTML = '';

    createPanel(panelsContainer, 1);
    createPanel(panelsContainer, 2);

    document.getElementById('optimize-lattice').addEventListener('click', optimizeLattice);
    document.getElementById('render-container').classList.add('active');
}

function createPanel(parent, axisIndex) {
    const panel = document.createElement('div');
    panel.className = 'bg-gray-100 p-6 rounded-xl mb-6 shadow-sm';
    panel.innerHTML = `
                <h2 class="text-xl font-semibold mb-4 text-center">Karton Oś ${axisIndex == 1 ? 'Pionowa' : 'Pozioma'}</h2>
                <div class="mb-4">
                    <label for="select-cardboard-${axisIndex}" class="block text-sm font-medium text-gray-700 mb-1">Wybierz typ kartonu:</label>
                    <select id="select-cardboard-${axisIndex}" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md"></select>
                </div>
                <div id="notches-container-${axisIndex}" class="notch-grid-container"></div>
            `;
    parent.appendChild(panel);

    const selectEl = panel.querySelector(`#select-cardboard-${axisIndex}`);
    cardboardData.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name;
        selectEl.appendChild(option);
    });
    selectEl.value = selectedCardboards[`axis${axisIndex}`];

    selectEl.addEventListener('change', (e) => {
        selectedCardboards[`axis${axisIndex}`] = e.target.value;
        updateNotchPanel(axisIndex);
        renderLattice();
    });

    updateNotchPanel(axisIndex);
}

function updateNotchPanel(axisIndex) {
    const containerId = `notches-container-${axisIndex}`;
    const notchesContainer = document.getElementById(containerId);
    notchesContainer.innerHTML = '';

    const selectedId = selectedCardboards[`axis${axisIndex}`];
    const cardboard = cardboardData.find(c => c.id === selectedId);

    if (!selectedNotches[`axis${axisIndex}`][selectedId]) {
        selectedNotches[`axis${axisIndex}`][selectedId] = new Array(cardboard.tooths.length + 1).fill(false);
    }

    for (let i = 0; i < cardboard.tooths.length + 1; i++) {
        const chip = document.createElement('label');
        chip.className = 'chip';
        chip.innerHTML = `
        <input type="checkbox" id="cb-${axisIndex}-${i}"
            ${selectedNotches[`axis${axisIndex}`][selectedId][i] ? 'checked' : ''}>
        #${i + 1}
    `;

        const input = chip.querySelector('input');
        if (input.checked) chip.classList.add('chip-checked');

        input.addEventListener('change', (e) => {
            selectedNotches[`axis${axisIndex}`][selectedId][i] = e.target.checked;
            chip.classList.toggle('chip-checked', e.target.checked);
            renderLattice();
        });

        notchesContainer.appendChild(chip);
    }

}

function getNotchPositions(cardboard) {
    const positions = [];
    let currentPos = -cardboard.width / 2;

    currentPos += cardboard.margin;
    positions.push(currentPos);
    currentPos += cardboard.gap;

    cardboard.tooths.forEach(toothLength => {
        currentPos += toothLength;
        positions.push(currentPos);
        currentPos += cardboard.gap;
    });

    return positions;
}

function createCardboardMesh(cardboard, isHorizontal) {
    const shape = new THREE.Shape();
    shape.moveTo(-cardboard.width / 2, -cardboard.depth / 2);
    shape.lineTo(cardboard.width / 2, -cardboard.depth / 2);
    shape.lineTo(cardboard.width / 2, cardboard.depth / 2);
    shape.lineTo(-cardboard.width / 2, cardboard.depth / 2);
    shape.lineTo(-cardboard.width / 2, -cardboard.depth / 2);

    const notchHeight = cardboard.depth / 2;
    const notchsX = getNotchPositions(cardboard);

    for (let notchX of notchsX) {
        const notchShape = new THREE.Path();
        if (isHorizontal) {
            notchShape.moveTo(notchX - THICKNESS / 2, cardboard.depth / 2);
            notchShape.lineTo(notchX + THICKNESS / 2, cardboard.depth / 2);
            notchShape.lineTo(notchX + THICKNESS / 2, cardboard.depth / 2 - notchHeight);
            notchShape.lineTo(notchX - THICKNESS / 2, cardboard.depth / 2 - notchHeight);
        } else {
            notchShape.moveTo(notchX + THICKNESS / 2, -cardboard.depth / 2);
            notchShape.lineTo(notchX + THICKNESS * 1.5, -cardboard.depth / 2);
            notchShape.lineTo(notchX + THICKNESS * 1.5, -cardboard.depth / 2 + notchHeight);
            notchShape.lineTo(notchX + THICKNESS / 2, -cardboard.depth / 2 + notchHeight);
        }
        shape.holes.push(notchShape);
    }

    const extrudeSettings = {
        steps: 1,
        depth: THICKNESS,
        bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    return geometry;
}

function hsl0x(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');   // convert to Hex and prefix "0" if needed
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function renderLattice(shouldRenderFiller = false) {
    cardboardGroup.children.forEach(mesh => mesh.geometry.dispose());
    cardboardGroup.clear();

    const cardboard1 = cardboardData.find(c => c.id === selectedCardboards.axis1);
    const cardboard2 = cardboardData.find(c => c.id === selectedCardboards.axis2);

    const notchesPositions1 = getNotchPositions(cardboard1);
    const notchesPositions2 = getNotchPositions(cardboard2);

    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

    // Rendering poziomych kartonów
    selectedNotches.axis2[cardboard2.id].forEach((isChecked, i) => {
        if (isChecked) {
            const notchPos = notchesPositions2[i];
            const geometry = createCardboardMesh(cardboard1, true);
            const material = new THREE.MeshLambertMaterial({ color: hsl0x(34, 56 + i/2, 60 + i/2) });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(0, 0, notchPos);

            cardboardGroup.add(mesh);

            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(edges, outlineMaterial);
            line.position.copy(mesh.position);
            line.rotation.copy(mesh.rotation);
            cardboardGroup.add(line);
        }
    });

    // Rendering pionowych kartonów
    selectedNotches.axis1[cardboard1.id].forEach((isChecked, i) => {
        if (isChecked) {
            const notchPos = notchesPositions1[i];
            const geometry = createCardboardMesh(cardboard2, false);
            const material = new THREE.MeshLambertMaterial({ color: hsl0x(34, 52 + i/2, 60 + i/2) });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.y = Math.PI / 2;
            mesh.position.set(notchPos, 0, 0);

            cardboardGroup.add(mesh);

            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(edges, outlineMaterial);
            line.position.copy(mesh.position);
            line.rotation.copy(mesh.rotation);
            cardboardGroup.add(line);
        }
    });

    renderDimensions(cardboard1, cardboard2, notchesPositions1, notchesPositions2);

    // Warunkowe renderowanie wypełnienia (płytek)
    if (shouldRenderFiller) {
        renderTiles(cardboard1, cardboard2, notchesPositions1, notchesPositions2);
    }
}


// NOWA FUNKCJA: Renderowanie Płytek (Wypełnienia)
function renderTiles(cardboard1, cardboard2, notchesPositions1, notchesPositions2) {
    const { w, d, h, m } = tileDimensions;

    // Pobranie aktualnie aktywnych nacięć
    const selected1 = selectedNotches.axis1[cardboard1.id];
    const selected2 = selectedNotches.axis2[cardboard2.id];
    const active1 = notchesPositions1.filter((_, i) => selected1[i]);
    const active2 = notchesPositions2.filter((_, i) => selected2[i]);

    // Minimalna wysokość komórki
    const heightFree = Math.min(cardboard1.depth, cardboard2.depth);


    for (let i = 0; i < active1.length - 1; i++) {
        for (let j = 0; j < active2.length - 1; j++) {
            const widthFree = Math.abs(active1[i + 1] - active1[i]) - THICKNESS - 2 * m;
            const depthFree = Math.abs(active2[j + 1] - active2[j]) - THICKNESS - 2 * m;

            // Sprawdzenie, czy kieszeń jest wystarczająco duża
            if (widthFree >= w && depthFree >= d && heightFree >= h) {
                // Rysowanie płytki, która się mieści
                const geometry = new THREE.BoxGeometry(w, h, d);
                // Niebieski kolor (mieści się)
                let material = new THREE.MeshLambertMaterial({ color: 0x326ecf, opacity: 0.8, transparent: true });

                const box = new THREE.Mesh(geometry, material);

                // Wyliczenie pozycji środka wolnej przestrzeni (bez marginesów)
                const startX = active1[i] + THICKNESS / 2 + m;
                const endX = active1[i + 1] - THICKNESS / 2 - m;
                const centerX = (startX + endX) / 2;

                const startZ = active2[j] + THICKNESS / 2 + m;
                const endZ = active2[j + 1] - THICKNESS / 2 - m;
                const centerZ = (startZ + endZ) / 2;

                // box.position.set(centerX, yOffset, centerZ);
                // Płytka jest na spodzie, więc Y to h/2 (bo box jest wycentrowany)
                box.position.set(centerX, -cardboard1.depth / 2 + h / 2, centerZ);
                cardboardGroup.add(box);
            }
        }
    }
}
function optimizeLattice() {
    // 1. Pobierz wymiary płytki
    const w = parseFloat(document.getElementById('tile-width').value);
    const d = parseFloat(document.getElementById('tile-depth').value);
    const h = parseFloat(document.getElementById('tile-height').value);
    const m = parseFloat(document.getElementById('tile-margin').value);

    tileDimensions = { w, d, h, m };

    let bestScore = -1;
    let bestConfig = null;
    let bestCardboard1 = null;
    let bestCardboard2 = null;

    // Iteracja po wszystkich kombinacjach kartonów (zakładamy, że wysokość kartonów jest głębokością w osi Y)
    // Oś Pionowa (X-axis) - cardboard1 - kontroluje Szerokość (W)
    // Oś Pozioma (Z-axis) - cardboard2 - kontroluje Głębokość (D)

    // Filtrowanie kartonów, których głębokość (Y-axis) nie jest wystarczająca dla wysokości płytki (H)
    const availableCardboards = cardboardData.filter(c => Math.min(c.depth, cardboardData[0].depth) >= h);

    if (availableCardboards.length === 0) {
        alert("Brak kartonów o wystarczającej wysokości dla płytki.");
        return;
    }

    for (const c1 of availableCardboards) {
        for (const c2 of availableCardboards) {

            // Wymóg: Wysokość musi się zgadzać (zakładamy, że głębokość c1 musi być wystarczająca dla c2)
            // Jeśli oba kartony mają różne głębokości, to wysokość komórki jest mniejszą z nich.
            const cellHeight = Math.min(c1.depth, c2.depth);
            if (cellHeight < h) continue; // Ponowna kontrola na wszelki wypadek

            const notches1 = getNotchPositions(c1);
            const notches2 = getNotchPositions(c2);

            // Generowanie wszystkich możliwych kombinacji nacięć
            // 2^(ilość nacięć) to za dużo, ograniczymy się do kombinacji, które generują komórki 
            // wystarczająco duże dla płytki (w * d)

            // Funkcja pomocnicza do obliczania wyniku dla danej konfiguracji nacięć
            const calculateScore = (config1, config2) => {
                const active1 = notches1.filter((_, i) => config1[i]);
                const active2 = notches2.filter((_, i) => config2[i]);

                if (active1.length < 2 || active2.length < 2) return 0;

                let tileCount = 0;

                for (let i = 0; i < active1.length - 1; i++) {
                    for (let j = 0; j < active2.length - 1; j++) {
                        const widthFree = Math.abs(active1[i + 1] - active1[i]) - THICKNESS - 2 * m;
                        const depthFree = Math.abs(active2[j + 1] - active2[j]) - THICKNESS - 2 * m;

                        if (widthFree >= w && depthFree >= d) {
                            tileCount++;
                        }
                    }
                }
                return tileCount;
            };

            // Zbudowanie idealnej konfiguracji nacięć dla minimalnej odległości
            const minSpaceW = w + 2 * m + THICKNESS;
            const minSpaceD = d + 2 * m + THICKNESS;

            // Optimalizacja dla Osi 1 (szerokość)
            let idealConfig1 = new Array(c1.tooths.length + 1).fill(false);
            idealConfig1[0] = true; // Zawsze bierzemy pierwsze nacięcie
            let lastNotchPos = notches1[0];
            for (let i = 1; i < notches1.length; i++) {
                if (notches1[i] - lastNotchPos >= minSpaceW) {
                    idealConfig1[i] = true;
                    lastNotchPos = notches1[i];
                }
            }
            // Zapewnienie, że ostatnie nacięcie (dla krawędzi) jest wzięte, jeśli jest blisko.
            if (!idealConfig1[notches1.length - 1]) idealConfig1[notches1.length - 1] = true;


            // Optimalizacja dla Osi 2 (głębokość)
            let idealConfig2 = new Array(c2.tooths.length + 1).fill(false);
            idealConfig2[0] = true; // Zawsze bierzemy pierwsze nacięcie
            lastNotchPos = notches2[0];
            for (let i = 1; i < notches2.length; i++) {
                if (notches2[i] - lastNotchPos >= minSpaceD) {
                    idealConfig2[i] = true;
                    lastNotchPos = notches2[i];
                }
            }
            if (!idealConfig2[notches2.length - 1]) idealConfig2[notches2.length - 1] = true;


            const currentScore = calculateScore(idealConfig1, idealConfig2);

            if (currentScore > bestScore) {
                bestScore = currentScore;
                bestConfig = { config1: idealConfig1, config2: idealConfig2 };
                bestCardboard1 = c1.id;
                bestCardboard2 = c2.id;
            }
        }
    }

    // 2. Aplikuj najlepszą konfigurację i odśwież render
    if (bestConfig && bestScore > 0) {
        // Zaznacz wybrane opcje w formularzach
        selectedCardboards.axis1 = bestCardboard1;
        selectedCardboards.axis2 = bestCardboard2;
        selectedNotches.axis1[bestCardboard1] = bestConfig.config1;
        selectedNotches.axis2[bestCardboard2] = bestConfig.config2;

        // Odśwież widok kontroli na podstawie nowej konfiguracji
        updateNotchPanel(1);
        updateNotchPanel(2);

        // Ustawienie wartości w selectach
        document.getElementById('select-cardboard-1').value = bestCardboard1;
        document.getElementById('select-cardboard-2').value = bestCardboard2;

        alert(`Znaleziono najlepszą kratownicę: ${bestCardboard1} (Pionowa) x ${bestCardboard2} (Pozioma), Mieści: ${bestScore} płytek.`);

        renderLattice(true); // Wymuś render z wypełnieniem
    } else {
        alert("Nie można zmieścić żadnej płytki w dostępnych kratownicach.");
        renderLattice(false);
    }
}

function renderDimensions(cardboard1, cardboard2, notchesPositions1, notchesPositions2) {
    const outlineMaterial = new THREE.MeshBasicMaterial({ color: scene.background });
    const dimMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const loader = new FontLoader();

    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font) {

        // Wymiary na osi pionowej z frontu jak i z tyłu (dla karonu 1) 
        const selected1 = selectedNotches.axis1[cardboard1.id];
        const activeNotches1 = notchesPositions1.filter((_, i) => selected1[i]);
        for (let i = 0; i < activeNotches1.length - 1; i++) {
            const startPos = activeNotches1[i];
            const endPos = activeNotches1[i + 1];
            const distance = Math.abs(endPos - startPos - THICKNESS).toFixed(1)
            const midPos = (startPos + endPos) / 2;
            const yOffset = cardboard1.depth / 2;
            const zOffset = cardboard2.width / 2 + 10;
            const zOffsetOpposite = -cardboard2.width / 2 - 10;
            const extLineLength = 5;

            // Linia pomocnicza 1
            const points1 = [
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffset),
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffset - extLineLength)
            ];
            const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
            const line1 = new THREE.Line(geometry1, dimMaterial);
            cardboardGroup.add(line1);

            // Linia pomocnicza 2
            const points2 = [
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffset),
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffset - extLineLength)
            ];
            const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
            const line2 = new THREE.Line(geometry2, dimMaterial);
            cardboardGroup.add(line2);

            // Linia wymiarowa
            const dimPoints = [
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffset),
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffset)
            ];
            const dimGeometry = new THREE.BufferGeometry().setFromPoints(dimPoints);
            const dimLine = new THREE.Line(dimGeometry, dimMaterial);
            cardboardGroup.add(dimLine);

            // Linia pomocnicza 1 tył
            const points3 = [
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffsetOpposite),
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffsetOpposite + extLineLength)
            ];
            const geometry3 = new THREE.BufferGeometry().setFromPoints(points3);
            const line3 = new THREE.Line(geometry3, dimMaterial);
            cardboardGroup.add(line3);
            // Linia pomocnicza 2 tył
            const points4 = [
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffsetOpposite),
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffsetOpposite + extLineLength)
            ];
            const geometry4 = new THREE.BufferGeometry().setFromPoints(points4);
            const line4 = new THREE.Line(geometry4, dimMaterial);
            cardboardGroup.add(line4);
            // Linia wymiarowa
            const dimPoints2 = [
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffsetOpposite),
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffsetOpposite)
            ];
            const dimGeometry2 = new THREE.BufferGeometry().setFromPoints(dimPoints2);
            const dimLine2 = new THREE.Line(dimGeometry2, dimMaterial);
            cardboardGroup.add(dimLine2);

            // Tekst
            const textGeometry = new TextGeometry(distance, {
                font: font,
                size: 7,
                height: 0.1,
                curveSegments: 12,
                depth: 0.5,

            });
            const outlineGeometry = new TextGeometry(distance, {
                font: font,
                size: 7,
                height: 0.25,
                curveSegments: 12,
                depth: .1,
                bevelEnabled: true,
                bevelSize: 0.75,
                bevelThickness: 0.1,
            })

            textGeometry.computeBoundingBox();
            const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
            const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;

            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.set(midPos - textWidth / 2, yOffset, zOffset + textHeight + 3);
            textMesh.rotation.x = -Math.PI / 2;
            cardboardGroup.add(textMesh);

            const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outlineMesh.position.set(midPos - textWidth / 2, yOffset + 0.1, zOffset + textHeight + 3);
            outlineMesh.rotation.x = -Math.PI / 2;
            cardboardGroup.add(outlineMesh);

            const textMesh2 = new THREE.Mesh(textGeometry, textMaterial);
            textMesh2.position.set(midPos - textWidth / 2, yOffset + 3, zOffsetOpposite);
            cardboardGroup.add(textMesh2);

            const outlineMesh2 = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outlineMesh2.position.set(midPos - textWidth / 2, yOffset + 3, zOffsetOpposite + 0.1);
            cardboardGroup.add(outlineMesh2);
        }


        // Wymiary na osi poziomej (dla kartonu 2)
        const selected2 = selectedNotches.axis2[cardboard2.id];
        const activeNotches2 = notchesPositions2.filter((_, i) => selected2[i]);
        for (let i = 0; i < activeNotches2.length - 1; i++) {
            const startPos = activeNotches2[i];
            const endPos = activeNotches2[i + 1];
            const distance = Math.abs(endPos - startPos - THICKNESS).toFixed(1);
            const midPos = (startPos + endPos) / 2;
            const xOffset = -cardboard1.width / 2 - 10;
            const xOffsetOpposite = cardboard1.width / 2 + 10;
            const yOffset = cardboard2.depth / 2;
            const extLineLength = 5;

            // Linia pomocnicza 1
            const points1 = [
                new THREE.Vector3(xOffset, yOffset, startPos + THICKNESS / 2),
                new THREE.Vector3(xOffset + extLineLength, yOffset, startPos + THICKNESS / 2)
            ];
            const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
            const line1 = new THREE.Line(geometry1, dimMaterial);
            cardboardGroup.add(line1);

            // Linia pomocnicza 2
            const points2 = [
                new THREE.Vector3(xOffset, yOffset, endPos - THICKNESS / 2),
                new THREE.Vector3(xOffset + extLineLength, yOffset, endPos - THICKNESS / 2)
            ];
            const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
            const line2 = new THREE.Line(geometry2, dimMaterial);
            cardboardGroup.add(line2);

            // Linia wymiarowa
            const dimPoints = [
                new THREE.Vector3(xOffset, yOffset, startPos + THICKNESS / 2),
                new THREE.Vector3(xOffset, yOffset, endPos - THICKNESS / 2)
            ];
            const dimGeometry = new THREE.BufferGeometry().setFromPoints(dimPoints);
            const dimLine = new THREE.Line(dimGeometry, dimMaterial);
            cardboardGroup.add(dimLine);

            // Linia pomocnicza 1 tył
            const points3 = [
                new THREE.Vector3(xOffsetOpposite, yOffset, startPos + THICKNESS / 2),
                new THREE.Vector3(xOffsetOpposite - extLineLength, yOffset, startPos + THICKNESS / 2)
            ];
            const geometry3 = new THREE.BufferGeometry().setFromPoints(points3);
            const line3 = new THREE.Line(geometry3, dimMaterial);
            cardboardGroup.add(line3);
            // Linia pomocnicza 2 tył
            const points4 = [
                new THREE.Vector3(xOffsetOpposite, yOffset, endPos - THICKNESS / 2),
                new THREE.Vector3(xOffsetOpposite - extLineLength, yOffset, endPos - THICKNESS / 2)
            ];
            const geometry4 = new THREE.BufferGeometry().setFromPoints(points4);
            const line4 = new THREE.Line(geometry4, dimMaterial);
            cardboardGroup.add(line4);
            // Linia wymiarowa
            const dimPoints2 = [
                new THREE.Vector3(xOffsetOpposite, yOffset, startPos + THICKNESS / 2),
                new THREE.Vector3(xOffsetOpposite, yOffset, endPos - THICKNESS / 2)
            ];
            const dimGeometry2 = new THREE.BufferGeometry().setFromPoints(dimPoints2);
            const dimLine2 = new THREE.Line(dimGeometry2, dimMaterial);
            cardboardGroup.add(dimLine2);

            // Tekst
            const textGeometry = new TextGeometry(distance, {
                font: font,
                size: 7,
                height: 0.1,
                curveSegments: 12,
                depth: 0.5

            });
            const outlineGeometry = new TextGeometry(distance, {
                font: font,
                size: 7,
                height: 0.25,
                curveSegments: 12,
                depth: .1,
                bevelEnabled: true,
                bevelSize: 0.75,
                bevelThickness: 0.1,
            })
            textGeometry.computeBoundingBox();
            const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
            const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y

            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.set(xOffset - textHeight - 3, yOffset - 0.1, midPos - textWidth / 2);
            textMesh.rotation.z = -Math.PI / 2;
            textMesh.rotation.x = -Math.PI / 2;
            cardboardGroup.add(textMesh);

            const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outlineMesh.position.set(xOffset - textHeight - 3, yOffset, midPos - textWidth / 2);
            outlineMesh.rotation.z = -Math.PI / 2;
            outlineMesh.rotation.x = -Math.PI / 2;
            cardboardGroup.add(outlineMesh);

            const textMesh2 = new THREE.Mesh(textGeometry, textMaterial);
            textMesh2.position.set(xOffsetOpposite, yOffset + 3, midPos - textWidth / 2);
            textMesh2.rotation.y = -Math.PI / 2;
            cardboardGroup.add(textMesh2);

            const outlineMesh2 = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outlineMesh2.position.set(xOffsetOpposite - 0.1, yOffset + 3, midPos - textWidth / 2);
            outlineMesh2.rotation.y = -Math.PI / 2;
            cardboardGroup.add(outlineMesh2);
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    // Zawsze upewnij się, że kamera patrzy na cel
    camera.lookAt(target);
    renderer.render(scene, camera);
}

function onMouseDown(e) {
    if (e.button === 0) {
        isRotating = true;
    } else if (e.button === 2) {
        isPanning = true;
    }
    mouseX = e.clientX;
    mouseY = e.clientY;
    e.preventDefault();
}

function onMouseUp(e) {
    if (e.button === 0) {
        isRotating = false;
    } else if (e.button === 2) {
        isPanning = false;
    }
}

function onMouseMove(e) {
    if (!isRotating && !isPanning) return;

    const deltaX = e.clientX - mouseX;
    const deltaY = e.clientY - mouseY;
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (isRotating) {
        const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
        spherical.theta += deltaX * rotationSpeed;
        spherical.phi -= deltaY * rotationSpeed;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        camera.position.setFromSpherical(spherical).add(target);
        camera.lookAt(target);
    }

    if (isPanning) {
        // Implementacja ruchu po płaszczyźnie (pan)
        const vector = new THREE.Vector3(deltaX, -deltaY, 0).multiplyScalar(panSpeed);
        vector.applyQuaternion(camera.quaternion);

        const panVector = new THREE.Vector3(-vector.x, 0, -vector.z);
        camera.position.add(panVector);
        target.add(panVector);

        camera.lookAt(target);
    }
}

function onMouseWheel(e) {
    e.preventDefault();
    const delta = e.deltaY;
    const zoomSpeed = 0.5;

    // Zmienna do przechowywania odległości kamery od celu
    const distance = camera.position.distanceTo(target);
    const direction = camera.position.clone().sub(target).normalize();

    // Nowa odległość z limitem, aby uniknąć przejścia przez cel
    let newDistance = distance + delta * zoomSpeed;
    newDistance = Math.max(10, newDistance); // Ustaw minimalną odległość

    // Ustaw nową pozycję kamery, zachowując kierunek
    camera.position.copy(direction.multiplyScalar(newDistance).add(target));
    camera.lookAt(target);
}

window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});


function setCameraView(view) {
    const views = {
        top: new THREE.Vector3(0, 300, 0),
        reset: new THREE.Vector3(-250, 300, 250)
    };

    target.set(0, 0, 0);

    camera.position.copy(views[view]);
    camera.lookAt(target);
}


window.onload = function () {
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('wheel', onMouseWheel);
    container.addEventListener('contextmenu', (e) => e.preventDefault());

    const viewButtons = document.querySelectorAll('#view-controls .view-button');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const view = button.getAttribute('data-view');
            setCameraView(view);
        });
    });

    const viewScreenshot = document.querySelector('#view-screenshot');
    viewScreenshot.addEventListener('click', () => {
        let cardboard1 = cardboardData.find(c => c.id === selectedCardboards.axis1);
        let cardboard2 = cardboardData.find(c => c.id === selectedCardboards.axis2);

        // get scene camera view form threejs renderer and save it as image
        renderer.render(scene, camera);
        renderer.domElement.toBlob(function (blob) {
            var a = document.createElement('a');
            var url = URL.createObjectURL(blob);
            a.href = url;
            a.download = `${cardboard1.name} x ${cardboard2.name}`;
            a.click();
        }, 'image/png', 1.0);
    })

    const viewBackground = document.querySelector('#view-background');
    viewBackground.addEventListener('input', (e) => {
        const background = e.target.value;
        scene.background = new THREE.Color(background);
    });
};

document.getElementById("toggle-camera").addEventListener("click", () => {
    if (isOrtho) {
        // wracamy do perspektywicznej
        perspectiveCamera.position.copy(camera.position);
        perspectiveCamera.quaternion.copy(camera.quaternion);
        camera = perspectiveCamera;
        isOrtho = false;
    } else {
        // przełącz na ortho
        orthoCamera.position.copy(camera.position);
        orthoCamera.quaternion.copy(camera.quaternion);
        camera = orthoCamera;
        isOrtho = true;
    }
});

document.getElementById("hide-filler").addEventListener("click", () => {
    renderLattice(false);
});