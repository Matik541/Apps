// app.js

const dataInput = document.getElementById('data-input');
const separatorSelect = document.getElementById('separator-select');
const fileInput = document.getElementById('file-input');
const headerRowInput = document.getElementById('header-row');
const fixedWidthContainer = document.getElementById('fixed-width-container');
const fixedWidthVisualizer = document.getElementById('fixed-width-visualizer');
const fixedWidthsInput = document.getElementById('fixed-widths');
const impulsDataInput = document.getElementById('impuls-data-input');

const canvas = document.getElementById('pick-and-place-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

// ZMIANA: ZWYKŁY INPUT DLA ROZMIARU PUNKTU, USUNIĘCIE SPAN
const dotSizeInput = document.getElementById('dot-size');
const fontSizeInput = document.getElementById('font-size');
const fontRotationInput = document.getElementById('font-rotation');
// USUNIĘCIE: textStyleSelect
const fontWeightSelect = document.getElementById('font-weight-select');
const fontFamilyInput = document.getElementById('font-family-input');
const colorDefaultInput = document.getElementById('color-default');
// USUNIĘCIE: colorMissingInput, showUnmatchedCheckbox

const displayModeSwitch = document.getElementById('display-mode-switch');
const layerFilterCheckboxes = document.getElementById('layer-filter-checkboxes');
const componentListContainer = document.getElementById('component-list-container');
const copyButton = document.getElementById('copy-canvas-btn');
const mirrorButton = document.getElementById('mirror-canvas-btn');

// NOWA STAŁA: WSPÓŁCZYNNIK SKALOWANIA ROZDZIELCZOŚCI
const SCALING_FACTOR = 5;


let isMirrored = false;
let rawData = "";
let parsedData = [];
let headers = [];
let mappedData = []; // Zostanie posortowane
let impulsData = []; // { designator: '', index: '', name: '' }
let uniqueLayers = new Set();
let layerVisibility = {};
let currentSort = []; // Tablica obiektów sortowania: [{ column: 'designator', direction: 'asc' }]

// Słownik wymaganych kolumn
const REQUIRED_COLUMNS = {
    designator: 'Desygnator',
    layer: 'Warstwa',
    posX: 'Pozycja X',
    posY: 'Pozycja Y',
    rotation: 'Rotacja'
};

// --- Funkcje Sortowania Danych ---

/**
 * Porównuje dwa elementy na podstawie bieżącej konfiguracji sortowania.
 * @param {Object} a 
 * @param {Object} b 
 * @returns {number}
 */
function compareItems(a, b) {
    for (const sortOption of currentSort) {
        const aVal = a[sortOption.column];
        const bVal = b[sortOption.column];

        let comparison = 0;
        if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
            if (aVal === bVal)
                comparison = 0;
            else if (aVal)
                comparison = 1; // true > false
            else
                comparison = -1; // false < true

        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
        } else {
            // Bezpieczne porównanie stringów
            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            if (aStr > bStr) comparison = 1;
            else if (aStr < bStr) comparison = -1;
        }

        if (comparison !== 0) {
            return sortOption.direction === 'asc' ? comparison : -comparison;
        }
    }
    return 0;
}

/**
 * Uruchamia sortowanie i odświeża listę komponentów oraz widok canvas.
 */
function applySorting() {
    if (mappedData.length > 0 && currentSort.length > 0) {
        mappedData.sort(compareItems);
    }
    updateComponentList();
    renderCanvas();
}

/**
 * Obsługuje kliknięcie nagłówka kolumny w celu sortowania.
 * @param {string} columnKey Klucz kolumny do sortowania.
 */
function handleSort(columnKey) {
    const existingIndex = currentSort.findIndex(s => s.column === columnKey);

    if (existingIndex > -1) {
        const existingSort = currentSort[existingIndex];
        if (existingSort.direction === 'asc') {
            // Zmień kierunek na desc
            currentSort[existingIndex].direction = 'desc';
        } else {
            // Usuń sortowanie dla tej kolumny
            currentSort.splice(existingIndex, 1);
        }
    } else {
        // Dodaj nowe sortowanie na początku (pierwszeństwo)
        currentSort.unshift({ column: columnKey, direction: 'asc' });
    }

    // Ogranicz liczbę poziomów sortowania (opcjonalnie, np. do 3)
    if (currentSort.length > 3) {
        currentSort.pop();
    }

    // Aktualizuj ikonki w nagłówku
    updateSortIndicators();

    applySorting();
}

/**
 * Aktualizuje wizualne wskaźniki sortowania w nagłówkach tabeli.
 */
function updateSortIndicators() {
    document.querySelectorAll('.component-list-header').forEach(th => {
        const columnKey = th.dataset.column;
        th.classList.remove('sort-asc', 'sort-desc');
        th.querySelector('.sort-indicator').textContent = '';

        const sortOption = currentSort.find(s => s.column === columnKey);
        if (sortOption) {
            const index = currentSort.findIndex(s => s.column === columnKey);
            th.classList.add(sortOption.direction === 'asc' ? 'sort-asc' : 'sort-desc');
            th.querySelector('.sort-indicator').textContent =
                (index + 1) + (sortOption.direction === 'asc' ? ' ▲' : ' ▼');
        }
    });
}


// --- Funkcje Parsowania Danych (bez zmian w logice parsowania) ---

function getSeparator(separatorType) {
    switch (separatorType) {
        case 'tab': return '\t';
        case ',': return ',';
        case ';': return ';';
        case ' ': return /\s+/; // Użycie regex dla wielu spacji
        default: return null; // Dla 'auto' lub 'fixed'
    }
}

function parseData() {
    rawData = dataInput.value;
    const separatorType = separatorSelect.value;
    const headerRow = parseInt(headerRowInput.value) || 0;

    // ... (Logika parsowania wierszy) ...
    let lines = rawData.trim().split('\n').filter(line => line.trim() !== '');

    if (lines.length === 0) {
        parsedData = [];
        headers = [];
        updateDataPreview();
        updateColumnMapping();
        mapAndRender();
        return;
    }

    // 2. Parsowanie
    let dataRows;
    if (separatorType === 'fixed') {
        const widths = fixedWidthsInput.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)).sort((a, b) => a - b);
        if (widths.length < 1 || widths[0] !== 0) { // Upewnij się, że zaczyna się od 0
            dataRows = lines.map(line => [line]);
        } else {
            dataRows = lines.map(line => {
                let row = [];
                for (let i = 0; i < widths.length; i++) {
                    const start = widths[i];
                    const end = widths[i + 1] || line.length;
                    row.push(line.substring(start, end).trim());
                }
                return row;
            }).filter(row => row.join('').trim() !== ''); // Usuń wiersze, które po podziale są puste
        }
    } else {
        const separator = getSeparator(separatorType);
        dataRows = lines.map(line => {
            if (separatorType === 'CVS' || separatorType === 'Auto' && (line.includes('"') || line.includes(','))) {

                // Proste parsowanie CSV z obsługą cudzysłowów
                const regex = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^\",]+)|,)/g;
                let result = [];
                let match;
                while ((match = regex.exec(line)) !== null) {
                    if (match[1] !== undefined) {
                        result.push(match[1].replace(/\"\"/g, '"')); // Usuwanie podwójnych cudzysłowów
                    } else if (match[2] !== undefined) {
                        result.push(match[2]);
                    }
                }
                return result;
            }

            if (separatorType === 'auto') {
                // sprawdzenie, czy jest to CSV
                if (line.includes('\t')) return line.split('\t');
                if (line.includes(',')) return line.split(',');
                if (line.includes(';')) return line.split(';');
                return line.split(/\s+/).filter(item => item !== '');
            }
            // Zwykłe splitowanie, filtrując puste elementy
            return line.split(separator).map(item => item.trim());
        }).filter(row => row.join('').trim() !== '');
    }

    // 3. Ustalenie nagłówków
    if (headerRow > 0 && dataRows.length >= headerRow) {
        headers = dataRows[headerRow - 1].filter(h => h.trim() !== '');
        parsedData = dataRows.slice(headerRow).filter(row => row.length === headers.length && row.join('').trim() !== '');
    } else {
        const maxCols = dataRows.reduce((max, row) => Math.max(max, row.length), 0);
        headers = Array.from({ length: maxCols }, (_, i) => `Kolumna ${i + 1}`);
        parsedData = dataRows.filter(row => row.length > 0 && row.join('').trim() !== '');
    }

    updateDataPreview();
    updateColumnMapping();
    mapAndRender();
}

function updateDataPreview() {
    const previewDiv = document.getElementById('data-preview');
    if (parsedData.length === 0) {
        previewDiv.innerHTML = "<p>Brak danych do podglądu.</p>";
        return;
    }

    let html = '<table><thead><tr>';
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';

    parsedData.slice(0, 5).forEach(row => {
        html += '<tr>';
        row.forEach(cell => html += `<td>${cell}</td>`);
        html += '</tr>';
    });

    html += '</tbody></table>';
    if (parsedData.length > 5) {
        html += `<p>... i ${parsedData.length - 5} więcej wierszy.</p>`;
    }
    previewDiv.innerHTML = html;
}

// --- Logika Mapowania Kolumn i Impuls ---

function updateColumnMapping() {
    const mappingDiv = document.getElementById('column-mapping');
    mappingDiv.innerHTML = '';

    if (headers.length === 0) {
        mappingDiv.innerHTML = '<p>Brak nagłówków do mapowania.</p>';
        return;
    }

    const headerOptions = headers.map((h, i) => `<option value="${i}">${h}</option>`).join('');

    for (const key in REQUIRED_COLUMNS) {
        const labelText = REQUIRED_COLUMNS[key];
        const html = `
            <div class="input-group">
                <label for="map-${key}">${labelText}:</label>
                <select id="map-${key}" data-key="${key}" class="column-map-select">
                    <option value="-1">-- Wybierz Kolumnę --</option>
                    ${headerOptions}
                </select>
            </div>
        `;
        mappingDiv.innerHTML += html;
    }

    document.querySelectorAll('.column-map-select').forEach(select => {
        select.addEventListener('change', mapAndRender);
    });
}

function mapAndRender() {
    if (parsedData.length === 0) {
        mappedData = [];
        uniqueLayers = new Set();
        updateLayerFilters();
        renderCanvas();
        return;
    }

    const mapping = {};
    let allMapped = true;

    document.querySelectorAll('.column-map-select').forEach(select => {
        const key = select.dataset.key;
        const index = parseInt(select.value);
        mapping[key] = index;
        if (index === -1 && key !== 'rotation') allMapped = false;
    });

    if (!allMapped) {
        mappedData = [];
        uniqueLayers = new Set();
        updateLayerFilters();
        renderCanvas();
        return;
    }

    uniqueLayers.clear();
    mappedData = parsedData.map(row => {
        const item = {
            designator: row[mapping.designator]?.trim() || 'N/A',
            name: 'N/A', // Tymczasowo, zaktualizowane w parseImpulsData
            layer: row[mapping.layer]?.trim() || 'TOP',
            posX: parseFloat(row[mapping.posX]?.replace(',', '.')) || 0,
            posY: parseFloat(row[mapping.posY]?.replace(',', '.')) || 0,
            rotation: parseFloat(row[mapping.rotation]?.replace(',', '.')) || 0,
            visible: true
        };
        uniqueLayers.add(item.layer);
        return item;
    }).filter(item => !isNaN(item.posX) && !isNaN(item.posY));

    // Inicjalizacja widoczności warstw
    uniqueLayers.forEach(layer => {
        if (layerVisibility[layer] === undefined) {
            layerVisibility[layer] = true;
        }
    });

    parseImpulsData();
}

function parseImpulsData() {
    const impulsLines = impulsDataInput.value.trim().split('\n').filter(line => line.trim() !== '');
    impulsData = [] // { designator: '', index: '', name: '' }

    if (impulsLines.length === 0) {
        mappedData.forEach(item => {
            item.name = 'N/A'; // Reset
            item.visible = true
            return item;
        });
        updateLayerFilters();
        applySorting();
        return;
    }

    let indexName = -2; 
    impulsLines.forEach(line => {
        const parts = line.split(/[,\t\s]+/).map(p => p.trim()).filter(p => p !== '');
        if (indexName == -2) {
            indexName = parts.indexOf('Nazwa Indeksu');
        }
        if (parts[0].startsWith('[')) return; 
        if (parts.length > 0) {
            const designator = parts[0];
            const index = parts[1] || '';
            const name = parts.slice(2).join(' ') || '';
            impulsData.push({ designator, index, name });
        }
    });

    let count = 0;
    impulsData.forEach(item => {
        const match = mappedData.find(d => d.designator.toLowerCase() === item.designator.toLowerCase());
        
        if (!match) {
            count++;
            console.log(item.designator)
        }
        if (!match && count <= 5) 
            alert(`Uwaga: Desygnator "${item.designator}" z danych Impuls nie został znaleziony w danych Pick&Place.`);
        if (count == 5) {
            alert('Za dużo brakujących desygnatorów. Przerwano dalsze powiadomienia.');
            return;
        }
    });

    mappedData.forEach(item => {
        item.name = 'N/A'; // Reset
        item.visible = false; // Reset
        const match = impulsData.find(d => d.designator.toLowerCase() === item.designator.toLowerCase());
        if (match) {
            item.visible = true;
            item.name = match.name;
        }

        return item;
    });

    updateLayerFilters();
    applySorting();
}


// --- Logika Kontroli Warstw i Listy Komponentów ---

function updateLayerFilters() {
    layerFilterCheckboxes.innerHTML = '';

    Array.from(uniqueLayers).sort().forEach(layer => {
        const isChecked = layerVisibility[layer] ? 'checked' : '';
        const html = `
            <label>
                <input type="checkbox" data-layer="${layer}" ${isChecked} class="layer-filter-checkbox">
                ${layer}
            </label>
        `;
        layerFilterCheckboxes.innerHTML += html;
    });

    document.querySelectorAll('.layer-filter-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleLayerVisibilityChange);
    });
}

function handleLayerVisibilityChange(event) {
    const layer = event.target.dataset.layer;
    layerVisibility[layer] = event.target.checked;

    mappedData.map(item => {
        item.visible = layerVisibility[item.layer];
        return item;
    })


    updateComponentList();
    renderCanvas();
}

function updateComponentList() {
    componentListContainer.innerHTML = '';

    // Dodanie nagłówków z sortowaniem
    const columnHeaders = [
        { key: 'visible', label: 'Widoczny' },
        { key: 'designator', label: 'Desygnator' },
        { key: 'name', label: 'Nazwa indeksu (Impuls)' },
        { key: 'layer', label: 'Warstwa' },
        { key: 'posX', label: 'X' },
        { key: 'posY', label: 'Y' },
        { key: 'rotation', label: 'Rotacja' },
    ];

    let html = '<table><thead><tr>';
    columnHeaders.forEach(header => {
        // Dodano data-column i klasę do sortowania
        html += `<th class="component-list-header" data-column="${header.key}" onclick="handleSort('${header.key}')">
                    ${header.label} <span class="sort-indicator"></span>
                </th>`;
    });
    html += '</tr></thead><tbody>';

    mappedData.forEach((item, index) => {
        const isChecked = item.visible ? 'checked' : '';
        // Znalezienie oryginalnego indexu w nieposortowanej (lub ostatnio posortowanej) mappedData
        const componentIndex = mappedData.indexOf(item);

        html += `
            <tr> 
                <td><input type="checkbox" data-index="${componentIndex}" ${isChecked} class="component-visibility-checkbox"></td>
                <td>${item.designator}</td>
                <td>${item.name}</td>
                <td>${item.layer}</td>
                <td>${item.posX.toFixed(3)}</td>
                <td>${item.posY.toFixed(3)}</td>
                <td>${item.rotation.toFixed(2)}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    componentListContainer.innerHTML = html;

    // Po wstawieniu HTML, aktualizujemy wskaźniki sortowania
    updateSortIndicators();

    document.querySelectorAll('.component-visibility-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleVisibilityChange);
    });
}

// Globalnie, aby mogło być wywołane z onclick
window.handleSort = handleSort;


function handleVisibilityChange(event) {
    const index = parseInt(event.target.dataset.index);
    mappedData[index].visible = event.target.checked;

    renderCanvas();
}


// --- Logika Canvas i Wizualizacji (Główne Zmiany) ---

function resizeCanvas() {
    // Ustawienie rozmiaru wyświetlanego (CSS) na rozmiar kontenera
    const visualWidth = container.clientWidth;
    const visualHeight = Math.max(container.clientHeight, 600);

    // Ustawienie natywnej rozdzielczości (width/height atrybuty)
    // Canvas jest skalowany 10x
    canvas.width = visualWidth * SCALING_FACTOR;
    canvas.height = visualHeight * SCALING_FACTOR;

    // Ustawienie CSS by zapobiec dziwnemu rozciąganiu
    canvas.style.width = `${visualWidth}px`;
    canvas.style.height = `${visualHeight}px`;

    // Ustawienie transformacji, aby wszystkie operacje rysowania były skalowane

    renderCanvas();
}

function renderCanvas() {
    // Wyczyść używając rozmiarów WIZUALNYCH (bo kontekst jest już przeskalowany)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mappedData.length === 0) {
        ctx.font = 20 * SCALING_FACTOR + 'px sans-serif';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        // Użyj rozmiarów WIZUALNYCH
        ctx.fillText('Załaduj i zmapuj dane Pick&Place', canvas.width / 2, canvas.height / 2);
        return;
    }

    // ZMIANA: USUNIĘTO showUnmatched
    const dotSize = parseFloat(dotSizeInput.value); // ZMIANA: Z range na number
    const fontSize = parseInt(fontSizeInput.value);
    const fontRotation = parseInt(fontRotationInput.value) || 0;
    if (fontRotation == -360 || fontRotation == 360) fontRotationInput.value = 0;

    // USUNIĘCIE: textStyle
    const fontWeight = fontWeightSelect.value;
    const fontFamily = fontFamilyInput.value || 'sans-serif';
    const colorDefault = colorDefaultInput.value;
    // USUNIĘCIE: colorMissing
    const displayMode = displayModeSwitch.value;

    // 1. Normalizacja/Skalowanie
    const filteredData = mappedData.filter(item => {
        const passesLayerFilter = layerVisibility[item.layer];
        // ZMIANA: Usunięcie filtrowania 'unmatched'
        return passesLayerFilter;
    });

    // ... (Logika skalowania i obliczania offsetu - bez zmian) ...
    const allX = filteredData.map(d => d.posX).filter(n => !isNaN(n));
    const allY = filteredData.map(d => d.posY).filter(n => !isNaN(n));
    if (allX.length === 0 || allY.length === 0) {
        ctx.font = '32px sans-serif';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('Brak widocznych komponentów po przefiltrowaniu.', canvas.width / 2, canvas.height / 2);
        return;
    }

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    const dataWidth = maxX - minX;
    const dataHeight = maxY - minY;

    const margin = 50 * SCALING_FACTOR; // ZMIANA: Margines 50px
    // ZMIANA: Użycie rozmiarów WIZUALNYCH
    const drawWidth = canvas.width - 2 * margin;
    const drawHeight = canvas.height - 2 * margin;

    const scaleX = dataWidth > 0 ? drawWidth / dataWidth : 1;
    const scaleY = dataHeight > 0 ? drawHeight / dataHeight : 1;
    const scale = Math.min(scaleX, scaleY); // ZMIANA: Skalowanie 10x

    const scaledDataWidth = dataWidth * scale;
    const scaledDataHeight = dataHeight * scale;
    const offsetX = margin + (drawWidth - scaledDataWidth) / 2;
    const offsetY = margin + (drawHeight - scaledDataHeight) / 2;

    // ZMIANA: USUNIĘTO RYSOWANIE RAMKI SKALOWANIA
    /*
    if (dataWidth > 0 && dataHeight > 0) {
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(offsetX, offsetY, scaledDataWidth, scaledDataHeight);
    }
    */

    // 2. Rysowanie punktów
    filteredData.forEach(item => {
        if (!item.visible) return;

        // Transformacja
        const canvasX = (offsetX + (item.posX - minX) * scale) * (isMirrored ? -1 : 1) + (isMirrored ? canvas.width : 0);
        const canvasY = offsetY + (maxY - item.posY) * scale;

        let color = colorDefault;
        if (item.designator.toUpperCase().startsWith('D') || item.designator.toUpperCase().startsWith('LD') || item.name.toLowerCase().includes('LED')) {
            color = document.getElementById('color-led').value || '#FF0000'; // Pomarańczowy dla diod
        }
        let directionalKeywords = [
            'jednokier',
            'unidirect',
            'uni-direct',
            ' direct'
        ];
        if (directionalKeywords.some(kw => item.name.toLowerCase().includes(kw))) {
            color = document.getElementById('color-directional').value || '#FFA500'; // Czerwony dla elementów kierunkowych
        }


        // Rysowanie kropki
        if (displayMode === 'dot' || displayMode === 'both') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, dotSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Rysowanie nazwy (desygnatora)
        if (displayMode === 'designator' || displayMode === 'both') {
            ctx.fillStyle = color;
            // Ustawienie pełnego stylu czcionki
            // ZMIANA: Usunięto textStyle (zawsze 'normal')
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

            // Punkt P&P (canvasX, canvasY) jest środkiem tekstu (0,0 rotacji)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Rotacja
            const rotationRad = (displayMode === 'both') ? 0 : (item.rotation % 180) * (Math.PI / 180) + fontRotation * (Math.PI / 180);

            // Zapisz stan, przesuń, obróć, narysuj, przywróć
            ctx.save();
            ctx.translate(canvasX, canvasY - (displayMode === 'both' ? dotSize + 5 : 0)); // Mały offset w dół, jeśli jest kropka
            ctx.rotate(-rotationRad);

            // Rysowanie tekstu na (0, 0) - nowym środku
            ctx.fillText(item.designator, 0, 0);

            ctx.restore();
        }
    });
}


// --- Funkcje Obsługi Przycisku Zapisywania i Kopiowania ---

function copyCanvasToClipboard() {
    // ZMIANA: Wykorzystanie natywnej rozdzielczości
    canvas.toBlob(blob => {
        if (!blob) {
            alert('Wystąpił błąd podczas generowania obrazu.');
            return;
        }
        try {
            const item = new ClipboardItem({ "image/png": blob });
            navigator.clipboard.write([item]);
        } catch (error) {
            console.error('Błąd kopiowania do schowka: ', error);
            alert('Błąd: Nie udało się skopiować obrazu do schowka. Spróbuj zapisać obraz.');
        }
    }, 'image/png');
}

function mirrorCanvasHorizontally() {
    isMirrored = !isMirrored;
    renderCanvas();
}

// --- Logika Fixed Width Visualizer (bez zmian) ---

function getSampleLine() {
    const lines = dataInput.value.trim().split('\n').filter(line => line.trim() !== '');
    return lines.length > 0 ? lines[0] : "Wklej dane, aby zobaczyć podgląd...";
}

function updateFixedWidthVisualizer() {
    const sampleLine = getSampleLine();
    fixedWidthVisualizer.innerHTML = '';

    let widths = [0];
    if (fixedWidthsInput.value.trim() !== '') {
        widths = fixedWidthsInput.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)).sort((a, b) => a - b);
        if (widths[0] !== 0) widths.unshift(0);
    } else {
        fixedWidthsInput.value = '0';
    }

    const pre = document.createElement('pre');
    pre.textContent = sampleLine;
    pre.className = 'fixed-width-line';
    pre.style.position = 'relative';
    fixedWidthVisualizer.appendChild(pre);

    widths.forEach((pos, index) => {
        if (pos > 0 && pos <= sampleLine.length) {
            const marker = document.createElement('div');
            marker.className = 'fixed-width-marker';
            marker.style.left = `${pos * 9}px`;
            marker.title = `Kolumna zaczyna się na pozycji: ${pos}`;
            marker.dataset.position = pos;

            if (pos !== 0) {
                const deleteBtn = document.createElement('span');
                deleteBtn.className = 'delete-marker';
                deleteBtn.textContent = 'x';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    removeFixedWidth(pos);
                };
                marker.appendChild(deleteBtn);
            }
            pre.appendChild(marker);
        }
    });
}

function addFixedWidth(position) {
    let widths = fixedWidthsInput.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    if (!widths.includes(position)) {
        widths.push(position);
        widths.sort((a, b) => a - b);
        fixedWidthsInput.value = widths.join(',');
        updateFixedWidthVisualizer();
        parseData();
    }
}

function removeFixedWidth(position) {
    let widths = fixedWidthsInput.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    const index = widths.indexOf(position);
    if (index > -1) {
        widths.splice(index, 1);
        fixedWidthsInput.value = widths.join(',');
        updateFixedWidthVisualizer();
        parseData();
    }
}

// Obsługa kliknięcia w wizualizer (dodanie znacznika)
fixedWidthVisualizer.addEventListener('click', (e) => {
    if (separatorSelect.value !== 'fixed') return;
    const preElement = e.target.closest('.fixed-width-line');
    if (!preElement) return;

    const rect = preElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const charPos = Math.round(clickX / 9);

    if (charPos > 0 && charPos < getSampleLine().length) {
        addFixedWidth(charPos);
    }
});

// --- Listenery i Inicjalizacja ---

dataInput.addEventListener('input', () => {
    if (separatorSelect.value === 'fixed') updateFixedWidthVisualizer();
    parseData();
});
separatorSelect.addEventListener('change', () => {
    const isFixed = separatorSelect.value === 'fixed';
    fixedWidthContainer.style.display = isFixed ? 'block' : 'none';
    if (isFixed) updateFixedWidthVisualizer();
    parseData();
});
headerRowInput.addEventListener('input', parseData);

fixedWidthsInput.addEventListener('change', () => {
    updateFixedWidthVisualizer();
    parseData();
});

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            dataInput.value = e.target.result;
            if (separatorSelect.value === 'fixed') updateFixedWidthVisualizer();
            parseData();
        };
        reader.readAsText(file);
    }
});

impulsDataInput.addEventListener('input', parseImpulsData);

// Listenery dla opcji wizualizacji
// ZMIANA: Listener dla zwykłego input number
dotSizeInput.addEventListener('input', renderCanvas);

fontSizeInput.addEventListener('input', renderCanvas);
fontRotationInput.addEventListener('input', renderCanvas);
// USUNIĘCIE: textStyleSelect.addEventListener('change', renderCanvas);
fontWeightSelect.addEventListener('change', renderCanvas);
fontFamilyInput.addEventListener('input', renderCanvas);
colorDefaultInput.addEventListener('input', renderCanvas);
// USUNIĘCIE: colorMissingInput, showUnmatchedCheckbox
displayModeSwitch.addEventListener('change', renderCanvas);
copyButton.addEventListener('click', copyCanvasToClipboard);
mirrorButton.addEventListener('click', mirrorCanvasHorizontally);


window.addEventListener('resize', resizeCanvas);
resizeCanvas();
// parseData();