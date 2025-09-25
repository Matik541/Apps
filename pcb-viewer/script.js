class Component {
    constructor(id, designator, layer, centerX, centerY, rotation) {
        this.id = id;
        this.designator = designator;
        this.layer = layer;
        this.centerX = centerX;
        this.centerY = centerY;
        this.rotation = rotation;
        this.show = true;
    }
}

const imageContainer = document.querySelector('.image-container');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');

let componentsData = [];
let layers = [];
let axisBounds = { x: [0, 0], y: [0, 0] };
let currentSort = { column: '', direction: 'asc' };
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

const elements = {
    pickPlaceInput: document.getElementById('pickPlaceInput'),
    pcbInput: document.getElementById('PCBInput'),
    image: document.getElementById('image'),
    componentsBody: document.getElementById('componentsBody'),
    layersContainer: document.getElementById('layers'),
    selectedCounter: document.getElementById('selectedCounter'),
    offsetXInput: document.getElementById('offsetX'),
    offsetYInput: document.getElementById('offsetY'),
    scaleInput: document.getElementById('scale'),
    resolutionInput: document.getElementById('resolution'),
    toggleNames: document.getElementById('toggleNames'),
    saveCanvasBtn: document.getElementById('saveCanvasBtn'),
    copyCanvasBtn: document.getElementById('copyCanvasBtn'),
    componentsTable: document.getElementById('components'),
    designatorsInput: document.getElementById('designatorsInput'),
    markButton: document.getElementById('markButton'),
    mirrorXBtn: document.getElementById('mirrorXBtn'), // Nowy przycisk
    mirrorYBtn: document.getElementById('mirrorYBtn'), // Nowy przycisk
    rotationInput: document.getElementById('rotationInput'), // Nowy input
    rotateBtn: document.getElementById('rotateBtn') // Nowy przycisk
};

const state = {
    scale: parseFloat(elements.scaleInput.value),
    zoom: 1,
    offsetX: parseFloat(elements.offsetXInput.value),
    offsetY: parseFloat(elements.offsetYInput.value),
    resolution: parseFloat(elements.resolutionInput.value),
    showNames: true,
    canvasScale: 10,
    mirrorX: false, // Nowy stan dla odbicia w poziomie
    mirrorY: false, // Nowy stan dla odbicia w pionie
    rotation: 0 // Nowy stan dla obrotu
};

function renderTable() {
    elements.componentsBody.innerHTML = '';
    componentsData.forEach(comp => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-100 transition-colors duration-150';
        row.innerHTML = `
                        <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${comp.id}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${comp.designator}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${comp.layer}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${comp.centerX.toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${comp.centerY.toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${comp.rotation.toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">
                            <input type="checkbox" data-designator="${comp.designator}" class="form-checkbox h-4 w-4 text-blue-600 rounded-sm cursor-pointer" ${comp.show ? 'checked' : ''} />
                        </td>
                    `;
        elements.componentsBody.appendChild(row);
    });

    elements.componentsTable.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.column === currentSort.column) {
            th.classList.add(`sort-${currentSort.direction}`);
        }
    });
    drawOverlay();
    updateSelectedCount();
}

function updateSelectedCount() {
    const selectedCount = componentsData.filter(c => c.show).length;
    elements.selectedCounter.innerText = selectedCount;
}

function sortComponents(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }

    const direction = currentSort.direction === 'asc' ? 1 : -1;

    componentsData.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];
        if (typeof valA === 'number' && typeof valB === 'number') {
            return (valA - valB) * direction;
        }
        return valA.localeCompare(valB) * direction;
    });

    renderTable();
}

function updateCanvasDimensions() {
    const img = elements.image;
    const containerWidth = img.offsetWidth;
    const containerHeight = img.offsetHeight;

    imageContainer.style.width = `${containerWidth}px`;
    imageContainer.style.height = `${containerHeight}px`;

    overlay.width = containerWidth * state.canvasScale;
    overlay.height = containerHeight * state.canvasScale;

    overlay.style.width = `${containerWidth}px`;
    overlay.style.height = `${containerHeight}px`;
}

function rotatePoint(x, y, angle) {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const newX = x * cos - y * sin;
    const newY = x * sin + y * cos;
    return { x: newX, y: newY };
}

function drawOverlay() {
    const img = elements.image;
    if (!img.complete || !img.naturalWidth) return;

    updateCanvasDimensions();

    const pcbWidth = axisBounds.x[1] - axisBounds.x[0];
    const pcbHeight = axisBounds.y[1] - axisBounds.y[0];

    const scaleX = overlay.width / pcbWidth;
    const scaleY = overlay.height / pcbHeight;
    const baseScale = Math.min(scaleX, scaleY);
    const effectiveScale = baseScale * (state.resolution / 10);
    const zoomScale = state.zoom * effectiveScale;

    const offsetX = state.offsetX * effectiveScale;
    const offsetY = state.offsetY * effectiveScale;

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.fillStyle = 'red';
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2 * state.scale * state.canvasScale;
    ctx.font = effectiveScale * state.scale * 1.5 + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const filteredComponents = componentsData.filter(comp => comp.show);
    const midX = (axisBounds.x[0] + axisBounds.x[1]) / 2;
    const midY = (axisBounds.y[0] + axisBounds.y[1]) / 2;

    const currentRotation = parseFloat(elements.rotationInput.value);

    filteredComponents.forEach(comp => {
        let compX = comp.centerX;
        let compY = comp.centerY;
        let compRotation = comp.rotation;

        if (state.mirrorX) {
            compX = axisBounds.x[1] + axisBounds.x[0] - compX;
            compRotation = 180 - compRotation;
        }

        if (state.mirrorY) {
            compY = axisBounds.y[1] + axisBounds.y[0] - compY;
            compRotation = 360 - compRotation;
        }

        const rotatedComp = rotatePoint(compX - midX, compY - midY, currentRotation);

        let x = rotatedComp.x * zoomScale + overlay.width / 2 + offsetX;
        let y = rotatedComp.y * zoomScale + overlay.height / 2 + offsetY;
        y = overlay.height - y;

        compRotation += currentRotation;

        if (state.showNames) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((-compRotation % 180) * Math.PI / 180);
            ctx.fillText(comp.designator, 0, 0);
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.arc(x, y, effectiveScale * state.scale * 0.5, 0, 2 * Math.PI);
            ctx.fill();
        }
    });
}

elements.pcbInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            elements.image.onload = () => {
                updateCanvasDimensions();
                drawOverlay();
            };
            elements.image.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

elements.pickPlaceInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            console.log(content);
            const lines = content.split('\n');

            componentsData = [];
            layers = [];
            axisBounds = { x: [Infinity, -Infinity], y: [Infinity, -Infinity] };

            let tableStarted = false;
            let id = 0;
            let headers = [];

            lines.forEach(line => {
                console.log(line)
                line = line.trim();
                if (line.startsWith('"Designator"')) {
                    headers = line.split('","').map(h => h.replace(/"/g, '').trim());
                    tableStarted = true;
                    console.log(headers)
                    return;
                }
                if (tableStarted && line) {
                    const values = line.split('","').map(v => v.replace(/"/g, '').trim());
                    console.log(values, headers.length)
                    if (values.length === headers.length) {
                        const entry = {};
                        headers.forEach((header, index) => {
                            entry[header] = values[index];
                        });

                        const designator = entry['Designator'];
                        const layer = entry['Layer'];
                        const centerX = parseFloat(entry['Center-X(mm)']);
                        const centerY = parseFloat(entry['Center-Y(mm)']);
                        const rotation = parseFloat(entry['Rotation']);

                        if (!isNaN(centerX) && !isNaN(centerY) && !isNaN(rotation)) {
                            componentsData.push(new Component(id++, designator, layer, centerX, centerY, rotation));

                            if (!layers.includes(layer)) {
                                layers.push(layer);
                            }

                            if (centerX < axisBounds.x[0]) axisBounds.x[0] = centerX;
                            if (centerX > axisBounds.x[1]) axisBounds.x[1] = centerX;
                            if (centerY < axisBounds.y[0]) axisBounds.y[0] = centerY;
                            if (centerY > axisBounds.y[1]) axisBounds.y[1] = centerY;
                        }
                    }
                }
            });

            renderTable();
            renderLayers();
            drawOverlay();
        };
        reader.readAsText(file);
    }
});

function renderLayers() {
    elements.layersContainer.innerHTML = '';
    layers.forEach(layer => {
        const label = document.createElement('label');
        label.className = 'inline-flex items-center text-sm font-medium text-gray-700';
        label.innerHTML = `
                        <input type="checkbox" data-layer="${layer}" class="form-checkbox h-4 w-4 text-blue-600 rounded-sm cursor-pointer mr-1" checked />
                        ${layer}
                    `;
        elements.layersContainer.appendChild(label);
    });
}

function markComponents() {
    const designatorsText = elements.designatorsInput.value;
    const designatorList = designatorsText.split(/[\s,;]+/).map(d => d.trim()).filter(d => d.length > 0);

    if (designatorList.length > 0) {
        componentsData.forEach(comp => {
            comp.show = designatorList.includes(comp.designator);
        });
    } else {
        componentsData.forEach(comp => {
            comp.show = true;
        });
    }
    renderTable();
    drawOverlay();
}

elements.componentsTable.addEventListener('click', (event) => {
    const header = event.target.closest('th[data-column]');
    if (header) {
        sortComponents(header.dataset.column);
    }
});

elements.componentsBody.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[type="checkbox"]');
    if (checkbox) {
        const designator = checkbox.dataset.designator;
        const component = componentsData.find(c => c.designator === designator);
        if (component) {
            component.show = checkbox.checked;
            updateSelectedCount();
            drawOverlay();
        }
    }
});

elements.layersContainer.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[type="checkbox"]');
    if (checkbox) {
        const layer = checkbox.dataset.layer;
        componentsData.forEach(comp => {
            if (comp.layer === layer) {
                comp.show = checkbox.checked;
            }
        });
        renderTable();
        drawOverlay();
    }
});

elements.markButton.addEventListener('click', markComponents);

elements.offsetXInput.addEventListener('input', (e) => {
    state.offsetX = parseFloat(e.target.value);
    drawOverlay();
});
elements.offsetYInput.addEventListener('input', (e) => {
    state.offsetY = parseFloat(e.target.value);
    drawOverlay();
});
elements.scaleInput.addEventListener('input', (e) => {
    state.scale = parseFloat(e.target.value);
    drawOverlay();
});
elements.resolutionInput.addEventListener('input', (e) => {
    state.resolution = parseFloat(e.target.value);
    drawOverlay();
});
elements.toggleNames.addEventListener('change', (e) => {
    state.showNames = e.target.checked;
    drawOverlay();
});

elements.saveCanvasBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'overlay.png';
    link.href = overlay.toDataURL();
    link.click();
};

elements.copyCanvasBtn.onclick = async () => {
    overlay.toBlob(async (blob) => {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            alert('Obraz skopiowany do schowka!');
        } catch (e) {
            alert('Kopiowanie nie powiodło się: ' + e);
        }
    });
};

elements.mirrorXBtn.addEventListener('click', () => {
    state.mirrorX = !state.mirrorX;
    drawOverlay();
});

elements.mirrorYBtn.addEventListener('click', () => {
    state.mirrorY = !state.mirrorY;
    drawOverlay();
});

elements.rotateBtn.addEventListener('click', () => {
    drawOverlay();
});

elements.rotationInput.addEventListener('input', () => {
    drawOverlay();
});

// Obsługa myszy do przesuwania i skalowania
imageContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

imageContainer.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    const pcbWidth = axisBounds.x[1] - axisBounds.x[0];
    const pcbHeight = axisBounds.y[1] - axisBounds.y[0];
    const scaleX = overlay.width / pcbWidth;
    const scaleY = overlay.height / pcbHeight;
    const baseScale = Math.min(scaleX, scaleY);
    const effectiveScale = baseScale * (state.resolution / 10);
    const zoomScale = state.zoom * effectiveScale;

    state.offsetX += dx / zoomScale;
    state.offsetY -= dy / zoomScale;

    elements.offsetXInput.value = state.offsetX.toFixed(2);
    elements.offsetYInput.value = state.offsetY.toFixed(2);

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    drawOverlay();
});

imageContainer.addEventListener('mouseup', () => {
    isDragging = false;
});

imageContainer.addEventListener('mouseleave', () => {
    isDragging = false;
});

imageContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    if (e.deltaY < 0) {
        state.zoom *= zoomFactor;
    } else {
        state.zoom /= zoomFactor;
    }
    state.zoom = Math.max(0.1, state.zoom);
    drawOverlay();
});

window.addEventListener('resize', drawOverlay);
elements.image.onload = drawOverlay;