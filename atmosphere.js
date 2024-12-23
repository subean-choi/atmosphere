// atmosphere.js

import { loadWeightsData, processWeights, applyWeightForData, saveToProcessData } from './algorithm.js';


// 전역 변수 선언
let map; // OpenStreetMap 객체를 저장할 변수
let gridSize = 1; // 그리드 크기를 저장할 변수, 기본값은 1
let fixedTopLeft, fixedBottomRight; // 고정된 좌상단, 우하단 좌표를 저장할 변수

let gridVisible = false; // 그리드가 보이는지 여부를 저장할 변수, 초기값은 false
let gridLayer = null; // 그리드 레이어를 저장할 변수

let existingStations = []; // 기존의 충전소 정보를 저장할 배열
let redGridData = { grids: [] }; // 빨간색 그리드 데이터를 저장할 객체
let dataCoords = []; // 도로 좌표를 저장할 배열
let newstation = 10; // 새로운 충전소의 수를 저장할 변수
let BoundarygeoJsonData = null; // 전역 변수로 BoundarygeoJsonData 추가


let negativeTwoMarkers = []; // -2 가중치 마커를 저장할 배열

// Ulaanbaatar and Darkhan 추가
const ulaanbaatarCoords = {
    topLeft: { lat: 48.270201, lng: 106.338580 },   // Adjust these values
    bottomRight: { lat: 47.309328, lng: 108.572522 }
};

const darkhanCoords = {
    topLeft: { lat: 49.539873, lng: 105.859706 },   // Adjust these values
    bottomRight: { lat: 49.404230, lng: 106.055400 }
};

// OpenStreetMap을 초기화하는 함수
function initMap() {
    
    const defaultLat = 37.592621;
    const defaultLng = 126.984812;

    
    // 유효한 위도, 경도 값인지 확인하는 함수
    function isValidLatLng(lat, lng) {
        return typeof lat === 'number' && typeof lng === 'number' && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }

    // 유효한 중심 좌표를 설정
    const centerLat = isValidLatLng(defaultLat, defaultLng) ? defaultLat : 0;
    const centerLng = isValidLatLng(defaultLat, defaultLng) ? defaultLng : 0;

    // 유효하지 않은 경우 오류 메시지 출력
    if (!isValidLatLng(centerLat, centerLng)) {
        console.error("Invalid center coordinates:", centerLat, centerLng);
        return;
    }

    // OpenStreetMap 객체 생성
    map = L.map('map').setView([centerLat, centerLng], 9);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // drawGrid(); // 그리드 그리기
}

// DOM이 로드되었을 때 실행되는 코드
document.addEventListener('DOMContentLoaded', () => {

    initMap();
    
    // 그리드 크기 조정 토굴 이벤트 리스너
    const gridSizeToggle = document.getElementById('grid-size-toggle');
    const gridSizeList = document.getElementById('grid-size-list');
    
    gridSizeToggle.addEventListener('click', () => {
        gridSizeList.classList.toggle('hidden');  // Toggle visibility of the list
    });

    gridSizeList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const selectedSize = e.target.getAttribute('data-size');
            gridSize = parseFloat(selectedSize);  // Apply the selected grid size
            gridSizeToggle.textContent = `격자 크기: ${selectedSize}`;  // Change button text
            gridSizeList.classList.add('hidden');  // Hide the list

            if (gridVisible) {
                drawGrid();  // Redraw grid if already visible
            }
        }
    });

    
    // 새로운 충전소 개수 선택을 위한 토글 이벤트 리스너
    const stationCountInput = document.getElementById('station-count-input');
    
    stationCountInput.addEventListener('change', () => {
        const selectedCount = parseInt(stationCountInput.value, 10);
        newstation = selectedCount;  // Update the number of new stations
        console.log(`New station count set to: ${newstation}`);
    });

    // 울란바토르 버튼 이벤트 리스너 추가
    document.getElementById('ulaanbaatar-btn').addEventListener('click', () => {
        moveMapToCoordinates(ulaanbaatarCoords);
        resetGridToggle();  // 격자 토글 초기화
    });
    
    // 다르항 버튼 이벤트 리스너 추가
    document.getElementById('darkhan-btn').addEventListener('click', () => {
        moveMapToCoordinates(darkhanCoords);
        resetGridToggle();  // 격자 토글 초기화
    });

    // 격자 ON, OFF 토굴 이벤트 리스너 추가
    const toggleGridCheckbox = document.getElementById('toggle-grid-btn');
    const toggleText = document.getElementById('toggle-text');
    
    if (toggleGridCheckbox && toggleText) {
        // 격자 ON, OFF 토글 스위치 상태에 따라 텍스트 변경
        toggleGridCheckbox.addEventListener('change', function() {
            if (this.checked) {
                toggleText.textContent = '격자 ON';
                drawGrid();  // 그리드 추가
            } else {
                toggleText.textContent = '격자 OFF';
    
                if (gridLayer) {
                    map.removeLayer(gridLayer);  // 그리드 제거
                    gridVisible = false;
                }
            }
        });
    } else {
        console.error("toggle-grid-btn or toggle-text element is not found in the DOM.");
    }
    
    // 행정구역 데이터 이벤트 리스너 추가
    document.getElementById('Boundaries_data').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                BoundarygeoJsonData = JSON.parse(event.target.result); // 'Boundaries_data' 파일을 BoundarygeoJsonData에 저장
                console.log("Parsed boundary Boundaries_data GeoJSON data:", BoundarygeoJsonData);
                dataCoords = extractDataCoordinates(BoundarygeoJsonData);
                addGeoJsonLayer_boundary(BoundarygeoJsonData);
                
                // 데이터 업로드 후 가중치 처리 함수 호출
                processAndSaveWeights(false);
            } catch (err) {
                console.error("Error parsing GeoJSON or adding layer:", err);
            }
        };
        reader.readAsText(file);
    });

    // 도로 데이터 이벤트 리스너 추가
    document.getElementById('Roads_data').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const RoadgeoJsonData = JSON.parse(event.target.result);
                console.log("Parsed GeoJSON data:", RoadgeoJsonData);
                dataCoords = extractDataCoordinates(RoadgeoJsonData);
                addGeoJsonLayer_road(RoadgeoJsonData);

                // 데이터 업로드 후 가중치 처리 함수 호출
                processAndSaveWeights(false);
            } catch (err) {
                console.error("Error parsing GeoJSON or adding layer:", err);
            }
        };
        reader.readAsText(file);
    });

    // 수로 데이터 이벤트 리스너 추가
    document.getElementById('Waterways_data').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const waterway = JSON.parse(event.target.result);
                console.log("Parsed GeoJSON data:", waterway);
                dataCoords = extractDataCoordinates(waterway);
                addGeoJsonLayer_waterway(waterway);

                // 데이터 업로드 후 가중치 처리 함수 호출
                processAndSaveWeights(false);
            } catch (err) {
                console.error("Error parsing GeoJSON or adding layer:", err);
            }
        };
        reader.readAsText(file);
    });

    // 지형 데이터 이벤트 리스너 추가
    document.getElementById('Terrain_data').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const naturaldata = JSON.parse(event.target.result);
                console.log("Parsed GeoJSON data:", naturaldata);
                addGeoJsonLayer_natural(naturaldata);

                // 데이터 업로드 후 가중치 처리 함수 호출
                processAndSaveWeights(false);
            } catch (err) {
                console.error("Error parsing GeoJSON or adding layer:", err);
            }
        };
        reader.readAsText(file);
    });

    // 기존 관측소 데이터 이벤트 리스너 추가
    document.getElementById('Station_data').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                existingStations = JSON.parse(event.target.result);
                console.log("Loaded existing stations:", existingStations);
                addMarkersWithInfo(existingStations);

                // 데이터 업로드 후 가중치 처리 함수 호출
                processAndSaveWeights(false);
            } catch (err) {
                console.error("Error parsing JSON:", err);
            }
        };
        reader.readAsText(file);
    });

    // 발전소 데이터 이벤트 리스너 추가
    document.getElementById('PowerPlants_data').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const powerplant = JSON.parse(event.target.result);
                console.log("Parsed GeoJSON data:", powerplant);
                dataCoords = extractDataCoordinates(powerplant);
                addGeoJsonLayer_powerplant(powerplant);

                // 데이터 업로드 후 가중치 처리 함수 호출
                processAndSaveWeights(false);
            } catch (err) {
                console.error("Error parsing GeoJSON or adding layer:", err);
            }
        };
        reader.readAsText(file);
    });

    // 시작 버튼 이벤트 리스너 추가
    document.getElementById('start-btn').addEventListener('click', () => {
        if (fixedTopLeft && fixedBottomRight) {  // 좌표가 설정된 경우에만
            setFixedCoordinatesFromCoords({ topLeft: fixedTopLeft, bottomRight: fixedBottomRight });
            saveGridCoordinates(); // 그리드 좌표 저장
            // saveRedGridData(); // 빨간 그리드 데이터 저장
            processAndSaveWeights(true); // 가중치 처리 및 저장
        } else {
            console.error('좌표가 설정되지 않았습니다. 도시를 선택하거나 좌표를 설정하세요.');
        }
    });
});

// 울란바토르, 다르항 버튼에 따른 지도 이동
function moveMapToCoordinates(coords) {

    // 좌상단과 우하단을 기반으로 경계 설정
    const bounds = L.latLngBounds([coords.topLeft.lat, coords.topLeft.lng], [coords.bottomRight.lat, coords.bottomRight.lng]);

    map.fitBounds(bounds);
    
    // 올바르게 좌표 설정
    fixedTopLeft = coords.topLeft;
    fixedBottomRight = coords.bottomRight;
    console.log("지도 이동 완료:", fixedTopLeft, fixedBottomRight);
    drawGrid();
}


// 좌표 설정 함수
function setFixedCoordinatesFromCoords(coords) {
    if (coords && coords.topLeft && coords.bottomRight) {
        fixedTopLeft = coords.topLeft;
        fixedBottomRight = coords.bottomRight;
        console.log('고정된 좌표가 설정되었습니다:', fixedTopLeft, fixedBottomRight);
    } else {
        console.error('setFixedCoordinatesFromCoords 함수에 잘못된 좌표가 전달되었습니다');
    }
}

// 격자 토굴 OFF로 변경(울란바토르 및 다르항 버튼 클릭 시)
function resetGridToggle() {
    const toggleGridCheckbox = document.getElementById('toggle-grid-btn');
    const toggleText = document.getElementById('toggle-text');

    toggleGridCheckbox.checked = false;  // 격자 토글을 OFF 상태로 설정
    toggleText.textContent = '격자 OFF';  // 텍스트를 OFF로 변경
    if (gridVisible) {
        toggleGrid();  // 격자가 보이는 경우 제거
    }
}

// 격자 토글 스위치 체크 상태에 따라 그리드를 추가 또는 제거하는 함수
function toggleGrid() {
    if (gridVisible) {
        if (gridLayer) {
            map.removeLayer(gridLayer);
        }
        gridVisible = false;
    } else {
        drawGrid();
        gridVisible = true;
    }
}

// 그리드를 그리는 함수
function drawGrid() {
    if (!fixedTopLeft || !fixedBottomRight) {
        console.error("고정된 좌표가 설정되지 않았습니다.");
        return;
    }

    // 그리드를 그릴 때 사용할 새로운 pane을 생성하고 z-index를 낮게 설정
    if (!map.getPane('gridPane')) {
        map.createPane('gridPane');
        map.getPane('gridPane').style.zIndex = 400; // 낮은 zIndex 설정 (기본 레이어보다 아래)
    }

    const adjustedGridSizeLat = gridSize * 0.009;
    const adjustedGridSizeLng = gridSize * 0.009 / Math.cos(fixedTopLeft.lat * Math.PI / 180);

    const startLat = fixedTopLeft.lat;
    const startLng = fixedTopLeft.lng;
    const endLat = fixedBottomRight.lat;
    const endLng = fixedBottomRight.lng;

    if (gridLayer) {
        map.removeLayer(gridLayer);
    }

    // 새로운 gridLayer를 생성하고 해당 pane에 추가
    gridLayer = L.layerGroup().addTo(map);

    // 수평 라인
    for (let lat = startLat; lat >= endLat; lat -= adjustedGridSizeLat) {
        const latlngs = [[lat, startLng], [lat, endLng]];
        L.polyline(latlngs, { color: 'red' }).addTo(gridLayer);
    }

    // 수직 라인
    for (let lng = startLng; lng <= endLng; lng += adjustedGridSizeLng) {
        const latlngs = [[startLat, lng], [endLat, lng]];
        L.polyline(latlngs, { color: 'red' }).addTo(gridLayer);
    }

    gridLayer.addTo(map);  // 그리드 레이어 추가
    gridVisible = true;  // 그리드가 표시됨
    console.log("Grid drawn successfully.");
}

// 각 데이터의 좌표를 추출하는 함수
function extractDataCoordinates(geoJsonData) {
    let coordinates = [];
    geoJsonData.features.forEach(feature => {
        if (feature.geometry.type === "LineString") {
            coordinates = coordinates.concat(feature.geometry.coordinates);
        } else if (feature.geometry.type === "MultiLineString") {
            feature.geometry.coordinates.forEach(line => {
                coordinates = coordinates.concat(line);
            });
        }
    });
    return coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));
}


///////////////////////////////////////////////////////////////////////////////////////
// GeoJSON 레이어를 추가하는 함수
// 공통 스타일 적용 및 레이어 추가 로직을 재사용할 수 있도록 분리
// GeoJSON 레이어를 추가하는 함수
function addGeoJsonLayer(geoJsonData, color = 'black', paneName = 'defaultPane', zIndex = 450) {
    // GeoJSON 데이터가 유효한지 검사
    if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
        console.error("Invalid GeoJSON data: ", geoJsonData);
        return;
    }

    // pane 생성 (이미 존재하는 경우 생략)
    if (!map.getPane(paneName)) {
        map.createPane(paneName);
        map.getPane(paneName).style.zIndex = zIndex; // 지정된 z-index 설정
    }

    // GeoJSON 데이터를 주어진 pane에 추가하고 스타일 설정
    const geoJsonLayer = L.geoJSON(geoJsonData, {
        style: function (feature) {
            return {
                fillColor: 'transparent',
                color: color,
                weight: 2
            };
        },
        pane: paneName
    });

    // 지도에 레이어 추가
    geoJsonLayer.addTo(map);
    console.log(`${paneName} GeoJSON layer has been added to the map.`);
}


// 도로 데이터를 추가하는 함수
function addGeoJsonLayer_road(RoadgeoJsonData) {
    addGeoJsonLayer(RoadgeoJsonData, 'gray', 'roadPane', 450);
}

// 행정구역 경계선을 추가하는 함수
function addGeoJsonLayer_boundary(boundarygeoJsonData) {
    addGeoJsonLayer(boundarygeoJsonData, 'black', 'boundaryPane', 470);
}

// 수로 데이터를 추가하는 함수
function addGeoJsonLayer_waterway(waterwaygeoJsonData) {
    addGeoJsonLayer(waterwaygeoJsonData, 'blue', 'waterwayPane', 460);
}

// 지형 데이터를 추가하는 함수
function addGeoJsonLayer_natural(naturalgeojson) {
    addGeoJsonLayer(naturalgeojson, 'green', 'naturalPane', 480);
}

// 발전소 데이터를 추가하는 함수
function addGeoJsonLayer_powerplant(powerplantgeoJsonData) {
    addGeoJsonLayer(powerplantgeoJsonData, 'purple', 'powerPlantPane', 490);
}

///////////////////////////////////////////////////////////////////////////////////////

// 가중치를 처리하고 저장하는 함수 (weightsData.json과 processData.json로 저장)
export function processAndSaveWeights(visualize = false) {
    if (!BoundarygeoJsonData || !existingStations.length) {
        console.warn("필요한 데이터가 부족하여 가중치를 처리할 수 없습니다.");
        return;
    }

    loadWeightsData()
        .then(originalData => {
            if (originalData && originalData.weights && Array.isArray(originalData.weights)) {
                const processedWeights = JSON.parse(JSON.stringify(originalData.weights));
                const accumulatedWeights = JSON.parse(JSON.stringify(originalData.weights)); // Copy for weightsData.json

                // dataCoords가 정의되었는지 확인
                if (Array.isArray(dataCoords) && dataCoords.length > 0) {
                    dataCoords.forEach(coord => {
                        applyWeightForData(coord.lat, coord.lng, processedWeights, gridSize, fixedTopLeft, fixedBottomRight);
                        applyWeightForData(coord.lat, coord.lng, accumulatedWeights, gridSize, fixedTopLeft, fixedBottomRight);
                    });
                } else {
                    console.warn('dataCoords is either undefined or empty.');
                }

                // Save to weightsData.json without -2 marking
                saveWeights(accumulatedWeights, originalData.topLeft, originalData.bottomRight);

                // Process and save to processData.json with -2 marking
                const result = processWeights(processedWeights, newstation, existingStations, fixedTopLeft, fixedBottomRight, gridSize);

                saveToProcessData({
                    topLeft: originalData.topLeft,
                    bottomRight: originalData.bottomRight,
                    weights: result.processedWeights // With -2 marking
                });

                if (visualize) {
                    addNegativeTwoMarkers(result.negativeTwoCoords);
                    console.log('Visualization of processed weights and station markers completed.');
                }
            } else {
                console.error('Invalid weight data format in weightsData.json.');
            }
        })
        .catch(err => {
            console.error('Error processing weights:', err);
        });
}

// 사용자 정의 아이콘 생성
const new_marker = L.icon({
    iconUrl: './marker.png',  // 마커로 사용할 이미지 경로
    iconSize: [35, 35],  // 고정된 마커 크기
    iconAnchor: [17.5, 17.5],  // 마커의 중심 좌표
    popupAnchor: [0, -10]  // 팝업이 뜨는 위치
});

// 기존 관측소 마커는 OpenStreetMap에서 제공하는 기본 마커를 사용하므로 따로 변경하지 않습니다.
// 가중치가 -2인 좌표에 마커를 추가하는 함수
function addNegativeTwoMarkers(coords) {
    if (!Array.isArray(coords)) {
        console.error('Invalid coordinates format:', coords);
        return;
    }

    // 기존 마커 제거
    negativeTwoMarkers.forEach(marker => map.removeLayer(marker));
    negativeTwoMarkers = [];

    const adjustedGridSizeLat = gridSize * 0.009;
    const adjustedGridSizeLng = gridSize * 0.009 / Math.cos(fixedTopLeft.lat * Math.PI / 180);

    // 좌표 변환 후 마커 추가
    coords.forEach(coord => {
        // 격자 중심 좌표 계산
        const lat = fixedTopLeft.lat - (coord.lat * adjustedGridSizeLat) - (adjustedGridSizeLat / 2);
        const lng = fixedTopLeft.lng + (coord.lng * adjustedGridSizeLng) + (adjustedGridSizeLng / 2);

        // 경계 내에 위치한 경우에만 마커 추가
        if (lat >= fixedBottomRight.lat && lat <= fixedTopLeft.lat &&
            lng >= fixedTopLeft.lng && lng <= fixedBottomRight.lng) {
            const marker = L.marker([lat, lng], {
                icon: new_marker  // 새로운 마커에 이미지 아이콘 적용
            }).addTo(map);
            
            negativeTwoMarkers.push(marker);
        }
    });
}


// 빨간색 그리드 데이터를 저장하는 함수
function saveRedGridData() {
    const redGridDataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(redGridData, null, 2));
    const redGridDownloadAnchorNode = document.createElement('a');
    redGridDownloadAnchorNode.setAttribute("href", redGridDataStr);
    redGridDownloadAnchorNode.setAttribute("download", "redGridData.json");
    document.body.appendChild(redGridDownloadAnchorNode);
    redGridDownloadAnchorNode.click();
    redGridDownloadAnchorNode.remove();
}

// 셀이 BoundarygeoJsonData에 포함되어 있는지 확인하는 함수
function isCellInBoundarygeoJsonData(cell) {
    if (!BoundarygeoJsonData) {
        console.error("Export GeoJSON not loaded.");
        return false;
    }
    return BoundarygeoJsonData.features.some(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        return cell.lat === lat && cell.lng === lng;
    });
}

// 그리드 좌표를 저장하는 함수
function saveGridCoordinates() {
    if (!fixedTopLeft || !fixedBottomRight) {
        console.error("고정된 좌표가 설정되지 않았습니다.");
        return;
    }

    // 현재 설정된 그리드 크기를 사용
    const adjustedGridSizeLat = gridSize * 0.009;
    const adjustedGridSizeLng = gridSize * 0.009 / Math.cos(fixedTopLeft.lat * Math.PI / 180);

    // 좌표 기반으로 그리드의 행과 열 계산
    const numRows = Math.ceil((fixedTopLeft.lat - fixedBottomRight.lat) / adjustedGridSizeLat);
    const numCols = Math.ceil((fixedBottomRight.lng - fixedTopLeft.lng) / adjustedGridSizeLng);

    let weightMatrix = Array.from({ length: numRows }, () => Array(numCols).fill(0));

    for (let i = 0; i < numRows; i++) {
        for (let j = 0; j < numCols; j++) {
            const lat = fixedTopLeft.lat - i * adjustedGridSizeLat;
            const lng = fixedTopLeft.lng + j * adjustedGridSizeLng;

            const cell = { lat, lng };

            if (!BoundarygeoJsonData) {
                console.warn("Export GeoJSON not loaded, skipping grid cell check.");
            } else if (isCellInBoundarygeoJsonData(cell)) {
                weightMatrix[i][j] = 0;
            }

            const inBounds = (
                lat >= fixedBottomRight.lat &&
                lat <= fixedTopLeft.lat &&
                lng >= fixedTopLeft.lng &&
                lng <= fixedBottomRight.lng
            );

            if (inBounds) {
                const stationExists = existingStations.some(
                    station =>
                        station.Lat >= lat &&
                        station.Lat < lat + adjustedGridSizeLat &&
                        station.Long >= lng &&
                        station.Long < lng + adjustedGridSizeLng
                );
                if (stationExists) {
                    weightMatrix[i][j] = -1;
                }
            }
        }
    }

    // 각 데이터 가중치 추가
    addDataToWeights(weightMatrix, fixedTopLeft.lat, fixedTopLeft.lng, adjustedGridSizeLat, adjustedGridSizeLng);

    console.log(`Total number of grids: ${weightMatrix.flat().length}`);

    // 가중치 데이터를 저장
    saveWeights(weightMatrix, fixedTopLeft, fixedBottomRight);
}

// 각 데이터를 가중치에 추가하는 함수
function addDataToWeights(weightMatrix, topLeftLat, topLeftLng, adjustedGridSizeLat, adjustedGridSizeLng) {
    dataCoords.forEach(coord => {
        const rowIndex = Math.floor((topLeftLat - coord.lat) / adjustedGridSizeLat);
        const colIndex = Math.floor((coord.lng - topLeftLng) / adjustedGridSizeLng);

        if (rowIndex >= 0 && rowIndex < weightMatrix.length && colIndex >= 0 && colIndex < weightMatrix[0].length) {
            if (weightMatrix[rowIndex][colIndex] !== -1) {
                weightMatrix[rowIndex][colIndex] += 1;
            }
        }
    });
}

// 가중치를 처리하고 저장하는 함수 (weightsData.json)
function saveWeights(weightMatrix, adjustedTopLeft, adjustedBottomRight) {
    
    // 숫자를 3자리로 포맷팅하는 함수
    function formatNumber(value) {
        if (typeof value === 'number') {
            const sign = value < 0 ? '-' : '';
            const absStr = Math.abs(value).toString();
            const paddedStr = absStr.padStart(3, ' ');
            return sign + paddedStr.slice(sign.length);
        }
        return value;
    }
  
    // 가중치 행렬의 모든 숫자를 3자리로 포맷팅
    const formattedWeightMatrix = weightMatrix.map(row =>
        row.map(value => formatNumber(value))
    );
  
    const weightsData = {
        topLeft: adjustedTopLeft,
        bottomRight: adjustedBottomRight,
        weights: formattedWeightMatrix
    };
  
    const jsonString = JSON.stringify(weightsData, null, 2)
        .replace(/,\s*(?=[^\s])/g, ', ')
        .replace(/\[\s*(.*?)\s*\]/g, (match, p1) => `[${p1.split(', ').join(', ')}]`)
        .replace(/],\s*\[/g, '],\n    [')  // 배열 요소들 사이에 줄바꿈 추가
        .replace(/},\s*{/g, '},\n    {');  // 객체들 사이에 줄바꿈 추가
  
    fetch('/saveWeights', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: jsonString
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.text();
    })
    .then(data => {
        console.log('Weights and coordinates data saved:', data);
    })
    .catch(err => {
        console.error('Error saving weights data:', err);
    });
}

// 기존 관측소 정보와 함께 마커를 추가하는 함수
function addMarkersWithInfo(stations) {
    stations.forEach(station => {
        const lat = Number(station.Lat);
        const lng = Number(station.Long);
        const marker = L.marker([lat, lng]).addTo(map);

        const infoWindowContent = `<div>
            <strong>Station:</strong> ${station.Station}<br>
            <strong>Description:</strong> ${station.Description}<br>
            <strong>Latitude:</strong> ${station.Lat}<br>
            <strong>Longitude:</strong> ${station.Long}</div>`;

        marker.bindPopup(infoWindowContent);

        console.log("Adding marker at Lat:", lat, "Lng:", lng);
    });
    console.log("All markers with info have been added.");
}

// initMap 함수를 전역에서 사용할 수 있도록 설정
window.initMap = initMap;
