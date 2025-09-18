const container = document.getElementById('render-container');
let scene, camera, renderer, cardboardGroup;
let isRotating = false;
let isPanning = false;
let mouseX = 0, mouseY = 0;
let rotationSpeed = 0.005;
let panSpeed = 0.5;
let target = new THREE.Vector3(0, 0, 0); // Nowy punkt docelowy kamery

const cardboardData = []
const TEXT_HEIGHT = 10;

async function fetchCardboardData() {
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

const THICKNESS = 3;

function init() {
    selectedCardboards = {
        axis1: cardboardData.length > 0 ? cardboardData[0].id : null,
        axis2: cardboardData.length > 1 ? cardboardData[1].id : null
    };

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd1d5db);

    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(200, 200, 200);
    camera.lookAt(target); // Kamera patrzy na punkt docelowy

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
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
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'flex items-center space-x-2';
        checkboxDiv.innerHTML = `
                    <input type="checkbox" id="cb-${axisIndex}-${i}" class="rounded"  
                            ${selectedNotches[`axis${axisIndex}`][selectedId][i] ? 'checked' : ''}>
                    <label for="cb-${axisIndex}-${i}" class="text-xs text-gray-700"> #${i + 1}</label>
                `;
        checkboxDiv.querySelector('input').addEventListener('change', (e) => {
            selectedNotches[`axis${axisIndex}`][selectedId][i] = e.target.checked;
            renderLattice();
        });
        notchesContainer.appendChild(checkboxDiv);
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

    console.log(notchsX)
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

function renderLattice() {
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
            const material = new THREE.MeshLambertMaterial({ color: 0xC08F4F });
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
            const material = new THREE.MeshLambertMaterial({ color: 0xCD9F61 });
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
}

function renderDimensions(cardboard1, cardboard2, notchesPositions1, notchesPositions2) {
    const dimMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const loader = new THREE.FontLoader();

    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font) {

        // Wymiary na osi pionowej (dla karonu 1)
        const selected1 = selectedNotches.axis1[cardboard1.id];
        const activeNotches1 = notchesPositions1.filter((_, i) => selected1[i]);
        for (let i = 0; i < activeNotches1.length - 1; i++) {
            const startPos = activeNotches1[i];
            const endPos = activeNotches1[i + 1];
            const distance = Math.abs(endPos - startPos - THICKNESS).toFixed(1)
            const midPos = (startPos + endPos) / 2;
            const yOffset = cardboard1.depth / 2;
            const zOffset = cardboard2.width / 2 + 10;
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

            // Tekst
            const textGeometry = new THREE.TextGeometry(distance, {
                font: font,
                size: 5,
                height: 0.1,
                curveSegments: 12,
            });
            textGeometry.computeBoundingBox();
            const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
            const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.set(midPos - textWidth / 2, yOffset, zOffset + textHeight + 3);
            textMesh.rotation.x = -Math.PI / 2;
            cardboardGroup.add(textMesh);
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

            // Tekst
            const textGeometry = new THREE.TextGeometry(distance, {
                font: font,
                size: 5,
                height: 0.1,
                curveSegments: 12,
            });
            textGeometry.computeBoundingBox();
            const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
            const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.set(xOffset - textHeight - 3, yOffset, midPos - textWidth / 2);
            textMesh.rotation.z = -Math.PI / 2;
            textMesh.rotation.x = -Math.PI / 2;
            cardboardGroup.add(textMesh);
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

    const distance = camera.position.distanceTo(target);

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
        front: new THREE.Vector3(0, 50, 300),
        side: new THREE.Vector3(300, 50, 0),
        reset: new THREE.Vector3(-200, 200, 200)
    };



    // Zresetuj target, ponieważ widoki są ustawione względem (0,0,0)
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
};