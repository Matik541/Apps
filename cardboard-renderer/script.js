import * as THREE from "three"
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const container = document.getElementById('render-container');
let scene, camera, renderer, combGroup;
let isRotating = false;
let isPanning = false;
let mouseX = 0, mouseY = 0;
let rotationSpeed = 0.005;
let panSpeed = 0.5;
let target = new THREE.Vector3(0, 0, 0);
let orthoCamera, perspectiveCamera;
let isOrtho = false;


const cardboardsData = [
    {
        "id": 0,
        "name": "Wymyślony karton",
        "width": 355,
        "length": 355,
        "depth": 202,
        "price": 999
    }
];
const combsData = [
    {
        "id": 0,
        "name": "Wymyślony grzebień",
        "bind": -1,
        "strict": false,
        "width": 350,
        "depth": 200,
        "tooths": [10, 15, 50, 50, 50, 50, 50, 15, 10],
        "gap": 3,
        "margin": 10,
        "price": 999
    },
]

async function fetchCombsData() {
    if (url === undefined) {
        console.error("Cant resolve request.");
        init();
        animate();

        return;
    }
    try {
        const response = await fetch(url);
        const data = await response.json();

        const cardboards = data.cardboards || [];
        cardboardsData.push(...cardboards);
        console.log("Fetched cardboard data:", combsData);

        const combs = data.combs || [];
        combsData.push(...combs);
        console.log("Fetched comb data:", combsData);

        init();
        animate();

    } catch (error) {
        console.error("Error fetching comb data:", error);
    }
}
fetchCombsData();
let selectedCombs

let selectedNotches = {
    axis1: {},
    axis2: {}
};

let THICKNESS = combsData[0].thickness ?? 3;

let elementDimensions = { w: 50, d: 50, h: 50, m: 2, q: 10 };

function init() {
    selectedCombs = {
        axis1: combsData[0].id,
        axis2: combsData[0].id
    };

    perspectiveCamera = new THREE.PerspectiveCamera(
        75, container.clientWidth / container.clientHeight, 0.1, 2000
    );
    perspectiveCamera.position.set(-250, 300, 250);
    perspectiveCamera.lookAt(target);

    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 500;
    orthoCamera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        -2000, 2000
    );
    orthoCamera.position.set(-250, 300, 250);
    orthoCamera.lookAt(target);

    camera = perspectiveCamera;


    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(-250, 300, 250);
    camera.lookAt(target);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);


    combGroup = new THREE.Group();
    scene.add(combGroup);

    for (const axis of ['axis1', 'axis2']) {
        combsData.forEach(c => {
            selectedNotches[axis][c.id] = new Array(c.tooths.length + 1).fill(c.strict);
        });
    }

    setupControlsUI();
    renderLattice();
}

function setupControlsUI() {
    const panelsContainer = document.getElementById('comb-panels');
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
                <h2 class="text-xl font-semibold mb-4 text-center">Karton Oś ${axisIndex == 1 ? 'Pionowa (X)' : 'Pozioma (Z)'}</h2>
                <div class="mb-4">
                    <label for="select-comb-${axisIndex}" class="block text-sm font-medium text-gray-700 mb-1">Wybierz typ kartonu:</label>
                    <select id="select-comb-${axisIndex}" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md"></select>
                </div>
                <div id="notches-container-${axisIndex}" class="notch-grid-container"></div>
            `;
    parent.appendChild(panel);

    const selectEl = panel.querySelector(`#select-comb-${axisIndex}`);
    combsData.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name;
        selectEl.appendChild(option);
    });
    selectEl.value = selectedCombs[`axis${axisIndex}`];

    selectEl.addEventListener('change', (e) => {
        const selectedId = parseInt(e.target.value);
        selectedCombs[`axis${axisIndex}`] = selectedId;

        const currentComb = combsData.find(c => c.id === selectedId);
        if (currentComb && currentComb.bind !== -1) {
            const otherAxis = axisIndex === 1 ? 2 : 1;
            const bindId = currentComb.bind;

            selectedCombs[`axis${otherAxis}`] = bindId;
            const otherSelectEl = document.getElementById(`select-comb-${otherAxis}`);
            if (otherSelectEl) {
                otherSelectEl.value = bindId;
                updateNotchPanel(otherAxis);
            }
        }

        updateNotchPanel(axisIndex);
        renderLattice();
    });

    updateNotchPanel(axisIndex);
}

function updateNotchPanel(axisIndex) {
    const containerId = `notches-container-${axisIndex}`;
    const notchesContainer = document.getElementById(containerId);
    notchesContainer.innerHTML = '';

    const selectedId = selectedCombs[`axis${axisIndex}`];
    const comb = combsData.find(c => c.id === selectedId);

    if (!selectedNotches[`axis${axisIndex}`][selectedId]) {
        selectedNotches[`axis${axisIndex}`][selectedId] = new Array(comb.tooths.length + 1).fill(comb.strict);
    }

    const isBound = comb.bind !== -1;
    const otherAxis = axisIndex === 1 ? 2 : 1;
    const otherCombId = selectedCombs[`axis${otherAxis}`];
    const otherComb = combsData.find(c => c.id === otherCombId);
    const isStrictlyBound = otherComb && otherComb.bind === comb.id;


    for (let i = 0; i < comb.tooths.length + 1; i++) {
        const chip = document.createElement('label');
        const isDisabled = comb.strict || isStrictlyBound;

        chip.className = 'chip';
        chip.innerHTML = `
        <input type="checkbox" id="cb-${axisIndex}-${i}" ${isDisabled ? 'disabled' : ''}
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

function getNotchPositions(comb) {
    const positions = [];
    let currentPos = -comb.width / 2;

    currentPos += comb.margin;
    positions.push(currentPos);
    currentPos += comb.gap;

    comb.tooths.forEach(toothLength => {
        currentPos += toothLength;
        positions.push(currentPos);
        currentPos += comb.gap;
    });

    return positions;
}

function createCombMesh(comb, isHorizontal) {
    const shape = new THREE.Shape();
    shape.moveTo(-comb.width / 2, -comb.depth / 2);
    shape.lineTo(comb.width / 2, -comb.depth / 2);
    shape.lineTo(comb.width / 2, comb.depth / 2);
    shape.lineTo(-comb.width / 2, comb.depth / 2);
    shape.lineTo(-comb.width / 2, -comb.depth / 2);

    const notchHeight = comb.depth / 2;
    const notchsX = getNotchPositions(comb);

    for (let notchX of notchsX) {
        const notchShape = new THREE.Path();
        if (isHorizontal) {
            notchShape.moveTo(notchX - THICKNESS / 2, comb.depth / 2);
            notchShape.lineTo(notchX + THICKNESS / 2, comb.depth / 2);
            notchShape.lineTo(notchX + THICKNESS / 2, comb.depth / 2 - notchHeight);
            notchShape.lineTo(notchX - THICKNESS / 2, comb.depth / 2 - notchHeight);
        } else {
            notchShape.moveTo(notchX + THICKNESS / 2, -comb.depth / 2);
            notchShape.lineTo(notchX + THICKNESS * 1.5, -comb.depth / 2);
            notchShape.lineTo(notchX + THICKNESS * 1.5, -comb.depth / 2 + notchHeight);
            notchShape.lineTo(notchX + THICKNESS / 2, -comb.depth / 2 + notchHeight);
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
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function renderLattice(shouldRenderFiller = false) {
    combGroup.children.forEach(mesh => mesh.geometry.dispose());
    combGroup.clear();

    const comb1 = combsData.find(c => c.id === selectedCombs.axis1);
    const comb2 = combsData.find(c => c.id === selectedCombs.axis2);

    const notchesPositions1 = getNotchPositions(comb1);
    const notchesPositions2 = getNotchPositions(comb2);

    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

    selectedNotches.axis2[comb2.id].forEach((isChecked, i) => {
        if (isChecked) {
            const notchPos = notchesPositions2[i];
            const geometry = createCombMesh(comb1, true);
            const material = new THREE.MeshLambertMaterial({ color: hsl0x(34, 56 + i / 2, 60 + i / 2) });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(0, 0, notchPos);

            combGroup.add(mesh);

            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(edges, outlineMaterial);
            line.position.copy(mesh.position);
            line.rotation.copy(mesh.rotation);
            combGroup.add(line);
        }
    });

    selectedNotches.axis1[comb1.id].forEach((isChecked, i) => {
        if (isChecked) {
            const notchPos = notchesPositions1[i];
            const geometry = createCombMesh(comb2, false);
            const material = new THREE.MeshLambertMaterial({ color: hsl0x(34, 52 + i / 2, 60 + i / 2) });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.y = Math.PI / 2;
            mesh.position.set(notchPos, 0, 0);

            combGroup.add(mesh);

            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(edges, outlineMaterial);
            line.position.copy(mesh.position);
            line.rotation.copy(mesh.rotation);
            combGroup.add(line);
        }
    });

    renderDimensions(comb1, comb2, notchesPositions1, notchesPositions2);
    if (shouldRenderFiller) {
        renderTiles(comb1, comb2, notchesPositions1, notchesPositions2);
    }
}


function renderTiles(comb1, comb2, notchesPositions1, notchesPositions2) {
    const { w, d, h, m } = elementDimensions;

    const selected1 = selectedNotches.axis1[comb1.id];
    const selected2 = selectedNotches.axis2[comb2.id];
    const active1 = notchesPositions1.filter((_, i) => selected1[i]);
    const active2 = notchesPositions2.filter((_, i) => selected2[i]);

    const heightFree = Math.min(comb1.depth, comb2.depth);


    for (let i = 0; i < active1.length - 1; i++) {
        for (let j = 0; j < active2.length - 1; j++) {
            const freeSpaceW = Math.abs(active1[i + 1] - active1[i]) - THICKNESS;
            const freeSpaceD = Math.abs(active2[j + 1] - active2[j]) - THICKNESS;

            const maxLuzW = freeSpaceW - w;
            const maxLuzD = freeSpaceD - d;

            if (maxLuzW >= 0 && maxLuzD >= 0 && heightFree >= h && maxLuzW <= 2 * m && maxLuzD <= 2 * m) {

                const geometry = new THREE.BoxGeometry(w, h, d);
                let material = new THREE.MeshLambertMaterial({ color: 0x326ecf, opacity: 0.8, transparent: true });

                const box = new THREE.Mesh(geometry, material);

                const startX = active1[i] + THICKNESS / 2 + maxLuzW / 2;
                const centerW = startX + w / 2;

                const startZ = active2[j] + THICKNESS / 2 + maxLuzD / 2;
                const centerZ = startZ + d / 2;

                box.position.set(centerW, -comb1.depth / 2 + h / 2, centerZ);
                combGroup.add(box);
            }
        }
    }
}
function calculateScore(config1, config2, c1, c2, elementDimensions) {
    const notches1 = getNotchPositions(c1);
    const notches2 = getNotchPositions(c2);
    const { w, d, h, m } = elementDimensions;

    const cellHeight = Math.min(c1.depth, c2.depth);
    if (cellHeight < h) return 0;

    const active1 = notches1.filter((_, i) => config1[i]);
    const active2 = notches2.filter((_, i) => config2[i]);

    if (active1.length < 2 || active2.length < 2) return 0;

    let tileCount = 0;

    for (let i = 0; i < active1.length - 1; i++) {
        for (let j = 0; j < active2.length - 1; j++) {
            const freeSpaceW = Math.abs(active1[i + 1] - active1[i]) - THICKNESS;
            const freeSpaceD = Math.abs(active2[j + 1] - active2[j]) - THICKNESS;

            const luzW = freeSpaceW - w;
            const luzD = freeSpaceD - d;

            if (luzW >= 0 && luzD >= 0 && luzW <= 2 * m && luzD <= 2 * m) {
                tileCount++;
            }
        }
    }

    return tileCount;
};
function findBestCardboardOption(latticeWidth, latticeDepth, itemsPerLattice, requiredQuantity, availableCardboards) {
    let bestOption = {
        cardboard: null,
        totalCost: Infinity,
        boxesNeeded: 0,
        totalCapacity: 0,
        costPerSlot: Infinity
    };

    for (const cardboard of availableCardboards) {
        if (cardboard.depth < Math.max(latticeWidth, latticeDepth)) {
            // Zakładamy, że głębokość kartonu musi pomieścić wysokość kratownicy, która leży płasko
            // Tę logikę można dostosować, jeśli kratownice mogą być wkładane pionowo
        }

        // Sprawdzenie dopasowania w obu orientacjach
        const fit_option1 = Math.floor(cardboard.width / latticeWidth) * Math.floor(cardboard.length / latticeDepth);
        const fit_option2 = Math.floor(cardboard.width / latticeDepth) * Math.floor(cardboard.length / latticeWidth);
        const latticesPerBox = Math.max(fit_option1, fit_option2);

        if (latticesPerBox === 0) {
            continue; // Kratownica nie mieści się w tym kartonie
        }

        const itemsPerBox = latticesPerBox * itemsPerLattice;
        const boxesNeeded = Math.ceil(requiredQuantity / itemsPerBox);
        const totalCost = boxesNeeded * cardboard.price;
        const totalCapacity = boxesNeeded * itemsPerBox;
        const costPerSlot = totalCost / totalCapacity;

        if (costPerSlot < bestOption.costPerSlot) {
            bestOption = { cardboard, totalCost, boxesNeeded, totalCapacity, costPerSlot };
        } else if (costPerSlot === bestOption.costPerSlot && totalCapacity > bestOption.totalCapacity) {
            // Przy tym samym koszcie na miejsce, wybierz opcję z większą pojemnością
            bestOption = { cardboard, totalCost, boxesNeeded, totalCapacity, costPerSlot };
        }
    }

    return bestOption.cardboard ? bestOption : null;
}
function optimizeLattice() {
    const w = parseFloat(document.getElementById('tile-width').value);
    const d = parseFloat(document.getElementById('tile-depth').value);
    const h = parseFloat(document.getElementById('tile-height').value);
    const m = parseFloat(document.getElementById('tile-margin').value);
    const q = parseInt(document.getElementById('tile-quantity').value);

    elementDimensions = { w, d, h, m, q };

    let bestSolution = {
        score: Infinity, // Niższy score (koszt/miejsce) jest lepszy
        config1: null,
        config2: null,
        comb1: null,
        comb2: null,
        cardboardInfo: null,
        count: 0
    };

    const availableCombs = combsData.filter(c => c.depth >= h);

    if (availableCombs.length === 0) {
        alert("Brak grzebieni o wystarczającej wysokości dla podanego elementu.");
        return;
    }

    for (const c1 of availableCombs) {
        for (const c2 of availableCombs) {
            // Pomiń niekompatybilne pary
            if (c1.bind !== -1 && c1.bind !== c2.id) continue;
            if (c2.bind !== -1 && c2.bind !== c1.id) continue;

            const notches1 = getNotchPositions(c1);
            const notches2 = getNotchPositions(c2);

            let config1, config2;

            // Dla grzebieni 'strict' konfiguracja jest stała - wszystkie nacięcia są używane
            if (c1.strict) {
                config1 = new Array(c1.tooths.length + 1).fill(true);
            } else {
                const minNotchDistW = w + THICKNESS;
                const maxNotchDistW = w + 2 * m + THICKNESS;
                config1 = new Array(c1.tooths.length + 1).fill(false);
                config1[0] = true;
                let lastNotchPos = notches1[0];
                for (let i = 1; i < notches1.length; i++) {
                    if (notches1[i] - lastNotchPos >= minNotchDistW && notches1[i] - lastNotchPos <= maxNotchDistW) {
                        config1[i] = true;
                        lastNotchPos = notches1[i];
                    }
                }
                if (!config1[notches1.length - 1] && notches1.length > 0) config1[notches1.length - 1] = true;
            }

            if (c2.strict) {
                config2 = new Array(c2.tooths.length + 1).fill(true);
            } else {
                const minNotchDistD = d + THICKNESS;
                const maxNotchDistD = d + 2 * m + THICKNESS;
                config2 = new Array(c2.tooths.length + 1).fill(false);
                config2[0] = true;
                let lastNotchPos = notches2[0];
                for (let i = 1; i < notches2.length; i++) {
                    if (notches2[i] - lastNotchPos >= minNotchDistD && notches2[i] - lastNotchPos <= maxNotchDistD) {
                        config2[i] = true;
                        lastNotchPos = notches2[i];
                    }
                }
                if (!config2[notches2.length - 1] && notches2.length > 0) config2[notches2.length - 1] = true;
            }

            const itemCount = calculateScore(config1, config2, c1, c2, elementDimensions);
            if (itemCount === 0) continue;

            const combsCost = (config1.filter(Boolean).length * c1.price) + (config2.filter(Boolean).length * c2.price);

            // Znajdź najlepszy karton zbiorczy dla tej konfiguracji kratownicy
            const cardboardInfo = findBestCardboardOption(c1.width, c2.width, itemCount, q, cardboardsData);

            if (!cardboardInfo) continue; // Nie znaleziono pasującego kartonu zbiorczego

            const totalCost = combsCost * cardboardInfo.boxesNeeded * Math.ceil(itemCount / itemCount) + cardboardInfo.totalCost;
            const currentScore = totalCost / cardboardInfo.totalCapacity; // Ocena = koszt na jedno miejsce

            if (currentScore < bestSolution.score) {
                bestSolution = {
                    score: currentScore,
                    config1: config1,
                    config2: config2,
                    comb1: c1,
                    comb2: c2,
                    cardboardInfo: cardboardInfo,
                    count: itemCount
                };
            }
        }
    }

    if (bestSolution.comb1) {
        const { comb1, comb2, config1, config2, count, cardboardInfo } = bestSolution;
        selectedCombs.axis1 = comb1.id;
        selectedCombs.axis2 = comb2.id;
        selectedNotches.axis1[comb1.id] = config1;
        selectedNotches.axis2[comb2.id] = config2;

        document.getElementById('select-comb-1').value = comb1.id;
        document.getElementById('select-comb-2').value = comb2.id;
        updateNotchPanel(1);
        updateNotchPanel(2);

//         alert(`Znaleziono optymalne rozwiązanie:
// - Kratownica: ${comb1.name} x ${comb2.name}
// - Pojemność kratownicy: ${count} elementów.
// - Opakowanie zbiorcze: ${cardboardInfo.cardboard.name}
// - Potrzebne kartony: ${cardboardInfo.boxesNeeded} szt.
// - Całkowita pojemność: ${cardboardInfo.totalCapacity} elementów.
// - Koszt całkowity (kratownice + kartony): ${bestSolution.score.toFixed(2) * cardboardInfo.totalCapacity}
// - Koszt na 1 miejsce: ${bestSolution.score.toFixed(2)}`);

        document.getElementById('optimize-lattice-dimensions').innerText = `Wymiary kratownicy: ${comb1.width} x ${comb2.width} mm (szer. x dług.)`;
        document.getElementById('optimize-lattice-capacity').innerText = `Pojemność kratownicy: ${count} elementów`;
        document.getElementById('optimize-lattice-cardboard').innerText = `Opakowanie zbiorcze: ${cardboardInfo.cardboard.name}, potrzebne kartony: ${cardboardInfo.boxesNeeded} szt. (całk. pojemność: ${cardboardInfo.totalCapacity} elementów)`;
        document.getElementById('optimize-lattice-cost').innerText = `Koszt całkowity (kratownice + kartony): ${bestSolution.score.toFixed(2) * cardboardInfo.totalCapacity} zł (koszt na 1 miejsce: ${bestSolution.score.toFixed(2)} zł)`;
        

        renderLattice(true);
    } else {
        alert("Nie znaleziono konfiguracji spełniającej podane wymagania.");
        renderLattice(false);
    }
}
function renderDimensions(comb1, comb2, notchesPositions1, notchesPositions2) {
    const outlineMaterial = new THREE.MeshBasicMaterial({ color: scene.background });
    const dimMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const loader = new FontLoader();

    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font) {

        const selected1 = selectedNotches.axis1[comb1.id];
        const activeNotches1 = notchesPositions1.filter((_, i) => selected1[i]);
        for (let i = 0; i < activeNotches1.length - 1; i++) {
            const startPos = activeNotches1[i];
            const endPos = activeNotches1[i + 1];
            const distance = Math.abs(endPos - startPos - THICKNESS).toFixed(1)
            const midPos = (startPos + endPos) / 2;
            const yOffset = comb1.depth / 2;
            const zOffset = comb2.width / 2 + 10;
            const zOffsetOpposite = -comb2.width / 2 - 10;
            const extLineLength = 5;

            const points1 = [
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffset),
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffset - extLineLength)
            ];
            const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
            const line1 = new THREE.Line(geometry1, dimMaterial);
            combGroup.add(line1);

            const points2 = [
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffset),
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffset - extLineLength)
            ];
            const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
            const line2 = new THREE.Line(geometry2, dimMaterial);
            combGroup.add(line2);

            const dimPoints = [
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffset),
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffset)
            ];
            const dimGeometry = new THREE.BufferGeometry().setFromPoints(dimPoints);
            const dimLine = new THREE.Line(dimGeometry, dimMaterial);
            combGroup.add(dimLine);

            const points3 = [
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffsetOpposite),
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffsetOpposite + extLineLength)
            ];
            const geometry3 = new THREE.BufferGeometry().setFromPoints(points3);
            const line3 = new THREE.Line(geometry3, dimMaterial);
            combGroup.add(line3);

            const points4 = [
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffsetOpposite),
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffsetOpposite + extLineLength)
            ];
            const geometry4 = new THREE.BufferGeometry().setFromPoints(points4);
            const line4 = new THREE.Line(geometry4, dimMaterial);
            combGroup.add(line4);

            const dimPoints2 = [
                new THREE.Vector3(startPos + THICKNESS / 2, yOffset, zOffsetOpposite),
                new THREE.Vector3(endPos - THICKNESS / 2, yOffset, zOffsetOpposite)
            ];
            const dimGeometry2 = new THREE.BufferGeometry().setFromPoints(dimPoints2);
            const dimLine2 = new THREE.Line(dimGeometry2, dimMaterial);
            combGroup.add(dimLine2);

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
            combGroup.add(textMesh);

            const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outlineMesh.position.set(midPos - textWidth / 2, yOffset + 0.1, zOffset + textHeight + 3);
            outlineMesh.rotation.x = -Math.PI / 2;
            combGroup.add(outlineMesh);

            const textMesh2 = new THREE.Mesh(textGeometry, textMaterial);
            textMesh2.position.set(midPos - textWidth / 2, yOffset + 3, zOffsetOpposite);
            combGroup.add(textMesh2);

            const outlineMesh2 = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outlineMesh2.position.set(midPos - textWidth / 2, yOffset + 3, zOffsetOpposite + 0.1);
            combGroup.add(outlineMesh2);
        }

        const selected2 = selectedNotches.axis2[comb2.id];
        const activeNotches2 = notchesPositions2.filter((_, i) => selected2[i]);
        for (let i = 0; i < activeNotches2.length - 1; i++) {
            const startPos = activeNotches2[i];
            const endPos = activeNotches2[i + 1];
            const distance = Math.abs(endPos - startPos - THICKNESS).toFixed(1);
            const midPos = (startPos + endPos) / 2;
            const xOffset = -comb1.width / 2 - 10;
            const xOffsetOpposite = comb1.width / 2 + 10;
            const yOffset = comb2.depth / 2;
            const extLineLength = 5;

            const points1 = [
                new THREE.Vector3(xOffset, yOffset, startPos + THICKNESS / 2),
                new THREE.Vector3(xOffset + extLineLength, yOffset, startPos + THICKNESS / 2)
            ];
            const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
            const line1 = new THREE.Line(geometry1, dimMaterial);
            combGroup.add(line1);

            const points2 = [
                new THREE.Vector3(xOffset, yOffset, endPos - THICKNESS / 2),
                new THREE.Vector3(xOffset + extLineLength, yOffset, endPos - THICKNESS / 2)
            ];
            const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
            const line2 = new THREE.Line(geometry2, dimMaterial);
            combGroup.add(line2);

            const dimPoints = [
                new THREE.Vector3(xOffset, yOffset, startPos + THICKNESS / 2),
                new THREE.Vector3(xOffset, yOffset, endPos - THICKNESS / 2)
            ];
            const dimGeometry = new THREE.BufferGeometry().setFromPoints(dimPoints);
            const dimLine = new THREE.Line(dimGeometry, dimMaterial);
            combGroup.add(dimLine);

            const points3 = [
                new THREE.Vector3(xOffsetOpposite, yOffset, startPos + THICKNESS / 2),
                new THREE.Vector3(xOffsetOpposite - extLineLength, yOffset, startPos + THICKNESS / 2)
            ];
            const geometry3 = new THREE.BufferGeometry().setFromPoints(points3);
            const line3 = new THREE.Line(geometry3, dimMaterial);
            combGroup.add(line3);
            const points4 = [
                new THREE.Vector3(xOffsetOpposite, yOffset, endPos - THICKNESS / 2),
                new THREE.Vector3(xOffsetOpposite - extLineLength, yOffset, endPos - THICKNESS / 2)
            ];
            const geometry4 = new THREE.BufferGeometry().setFromPoints(points4);
            const line4 = new THREE.Line(geometry4, dimMaterial);
            combGroup.add(line4);
            const dimPoints2 = [
                new THREE.Vector3(xOffsetOpposite, yOffset, startPos + THICKNESS / 2),
                new THREE.Vector3(xOffsetOpposite, yOffset, endPos - THICKNESS / 2)
            ];
            const dimGeometry2 = new THREE.BufferGeometry().setFromPoints(dimPoints2);
            const dimLine2 = new THREE.Line(dimGeometry2, dimMaterial);
            combGroup.add(dimLine2);

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
            combGroup.add(textMesh);

            const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outlineMesh.position.set(xOffset - textHeight - 3, yOffset, midPos - textWidth / 2);
            outlineMesh.rotation.z = -Math.PI / 2;
            outlineMesh.rotation.x = -Math.PI / 2;
            combGroup.add(outlineMesh);

            const textMesh2 = new THREE.Mesh(textGeometry, textMaterial);
            textMesh2.position.set(xOffsetOpposite, yOffset + 3, midPos - textWidth / 2);
            textMesh2.rotation.y = -Math.PI / 2;
            combGroup.add(textMesh2);

            const outlineMesh2 = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outlineMesh2.position.set(xOffsetOpposite - 0.1, yOffset + 3, midPos - textWidth / 2);
            outlineMesh2.rotation.y = -Math.PI / 2;
            combGroup.add(outlineMesh2);
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
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
        spherical.phi = Math.max(0.001, Math.min(Math.PI - 0.001, spherical.phi));
        camera.position.setFromSpherical(spherical).add(target);
        camera.lookAt(target);
    }

    if (isPanning) {
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

    const distance = camera.position.distanceTo(target);
    const direction = camera.position.clone().sub(target).normalize();

    let newDistance = distance + delta * zoomSpeed;
    newDistance = Math.max(10, newDistance);

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
        let comb1 = combsData.find(c => c.id === selectedCombs.axis1);
        let comb2 = combsData.find(c => c.id === selectedCombs.axis2);

        renderer.render(scene, camera);
        renderer.domElement.toBlob(function (blob) {
            var a = document.createElement('a');
            var url = URL.createObjectURL(blob);
            a.href = url;
            a.download = `${comb1.name} x ${comb2.name}`;
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
        perspectiveCamera.position.copy(camera.position);
        perspectiveCamera.quaternion.copy(camera.quaternion);
        camera = perspectiveCamera;
        isOrtho = false;
    } else {
        orthoCamera.position.copy(camera.position);
        orthoCamera.quaternion.copy(camera.quaternion);
        camera = orthoCamera;
        isOrtho = true;
    }
});

document.getElementById("hide-filler").addEventListener("click", () => {
    renderLattice(false);
});