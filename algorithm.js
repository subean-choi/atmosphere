// algorithm.js

// 가중치 데이터를 로드하는 함수
export function loadWeightsData() {
    return fetch('./weightsData.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.text(); // Read as text first to check if it's valid
        })
        .then(text => {
            if (!text || text.trim() === "") {
                throw new Error("weightsData.json is empty or invalid.");
            }
            try {
                return JSON.parse(text); // Try parsing JSON
            } catch (err) {
                throw new Error("Error parsing weightsData.json: " + err.message);
            }
        })
        .then(data => {
            console.log("Parsed JSON data: ", data);
            return data;
        })
        .catch(err => console.error("Failed to load weights data:", err));
}


// 주변 셀의 가중치를 0으로 만드는 함수
// 주변 셀의 가중치를 0으로 만드는 함수 (기존 마커나 새로운 마커 주변도 포함)
export function zeroOutSurroundings(arr, i, j) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];

    // Zero out the surroundings of the (i, j) position
    directions.forEach(([dx, dy]) => {
        const x = i + dx;
        const y = j + dy;
        if (x >= 0 && x < arr.length && y >= 0 && y < arr[0].length && arr[x][y] !== -1 && arr[x][y] !== -2) {
            arr[x][y] = 0;  // Set surrounding cells to 0 (except for existing markers)
        }
    });
}


// 최대 가중치를 찾는 함수
// 최대 가중치를 찾는 함수 (랜덤 선택 대신 일관된 위치 선택)
export function findMaxWeight(arr) {
    let maxVal = -Infinity;
    let maxPositions = [];

    // 최대 가중치를 찾고, 해당 위치를 저장
    for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr[i].length; j++) {
            if (arr[i][j] > maxVal) {
                maxVal = arr[i][j];
                maxPositions = [[i, j]]; // 새로운 최대값이 발견되면 리스트 초기화
            } else if (arr[i][j] === maxVal) {
                maxPositions.push([i, j]); // 같은 최대값 위치 추가
            }
        }
    }

    // 가장 첫 번째 위치를 반환 (일관된 선택)
    return maxPositions[0];  // 항상 첫 번째 위치를 선택
}


// 가중치 데이터를 처리하는 함수
export function processWeights(weightData, targetCount, existingStations = [], fixedTopLeft, fixedBottomRight, gridSize) {
    if (!weightData || !Array.isArray(weightData) || !weightData.length) {
        throw new Error("Invalid weight data provided.");
    }

    const adjustedGridSizeLat = gridSize * 0.009;
    const adjustedGridSizeLng = gridSize * 0.009 / Math.cos(fixedTopLeft.lat * Math.PI / 180);

    // Handle existing station positions
    if (existingStations && Array.isArray(existingStations)) {
        existingStations.forEach(station => {
            const lat = Number(station.Lat);
            const lng = Number(station.Long);
            const rowIndex = Math.floor((fixedTopLeft.lat - lat) / adjustedGridSizeLat);
            const colIndex = Math.floor((lng - fixedTopLeft.lng) / adjustedGridSizeLng);
            if (rowIndex >= 0 && rowIndex < weightData.length && colIndex >= 0 && colIndex < weightData[0].length) {
                weightData[rowIndex][colIndex] = -1;  // Mark existing station positions as -1
            }
        });
    }

    const processedPositions = new Set();
    let negativeTwoCount = 0;
    const negativeTwoCoords = [];

    while (negativeTwoCount < targetCount) {
        // Process existing markers and prevent placing new ones near them
        for (let i = 0; i < weightData.length; i++) {
            for (let j = 0; j < weightData[i].length; j++) {
                if ((weightData[i][j] === -1 || weightData[i][j] === -2) && !processedPositions.has(`${i},${j}`)) {
                    zeroOutSurroundings(weightData, i, j);  // Zero out surrounding cells
                    processedPositions.add(`${i},${j}`);
                }
            }
        }

        // Find max weight location
        const [maxI, maxJ] = findMaxWeight(weightData);
        if (maxI === undefined || maxJ === undefined) break;

        // Skip already processed positions
        if (processedPositions.has(`${maxI},${maxJ}`)) continue;

        // Set max weight position to -2 and zero out its surroundings
        weightData[maxI][maxJ] = -2;
        negativeTwoCoords.push({ lat: maxI, lng: maxJ });
        processedPositions.add(`${maxI},${maxJ}`);
        zeroOutSurroundings(weightData, maxI, maxJ);  // Zero out surroundings for newly placed marker

        negativeTwoCount++;
    }

    return { processedWeights: weightData, negativeTwoCoords };  // Return the final processed data
}




// 처리된 가중치 데이터를 저장하는 함수
export function saveProcessedWeights(data) {
    // 데이터가 정의되었는지, weights가 배열인지 확인
    if (!data || !data.weights || !Array.isArray(data.weights)) {
        console.error("Invalid data or weights not found:", data);
        return;  // 유효하지 않은 데이터인 경우 함수 종료
    }

    // 데이터 저장 전에 모든 값이 정상적인 범위에 있는지 확인
    data.weights.forEach(row => {
        row.forEach(value => {
            if (value > 100 || value < -2) {  // 예시: 값이 너무 크거나 작은지 확인
                console.warn("이상한 값 발견:", value);
            }
        });
    });

    // 데이터를 저장하는 로직
    const formattedData = JSON.stringify(data, null, 2);
    fetch('/saveProcessedWeights', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: formattedData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.text();
    })
    .then(data => {
        console.log('Processed weights data saved:', data);
    })
    .catch(err => {
        console.error('Error saving processed weights data:', err);
    });
}


// processData.json에 가중치 데이터를 저장하는 함수
export function saveToProcessData(processedWeightsData) {
    // 데이터가 정상적으로 전달되었는지 확인
    console.log("Processed weights data to save:", processedWeightsData);

    // Format the data to ensure weights are limited to a certain number of digits
    const formattedWeights = processedWeightsData.weights.map(row => {
        return row.map(value => {
            let formattedValue = Math.min(value, 999);  // Limit values to 3 digits
            return formattedValue.toString().padStart(3, ' ');
        });
    });

    // Structure the data in the same way as weightsData.json
    const dataToSave = {
        topLeft: processedWeightsData.topLeft,
        bottomRight: processedWeightsData.bottomRight,
        weights: formattedWeights
    };

    // Save the formatted weights to processData.json
    fetch('/saveProcessedWeights', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSave, null, 2)  // Save with 2-space indentation for readability
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.text();
    })
    .then(data => {
        console.log('Processed data saved to processData.json:', data);
    })
    .catch(err => {
        console.error('Error saving processed data:', err);
    });
}


// 기존 충전소 위치에 대한 그리드 가중치를 설정하는 함수 (기존 충전소 반영)
export function markStationOnGrid(lat, lng, weights, gridSize, fixedTopLeft) {
    const adjustedGridSizeLat = gridSize * 0.009;
    const adjustedGridSizeLng = gridSize * 0.009 / Math.cos(fixedTopLeft.lat * Math.PI / 180);

    const rowIndex = Math.floor((fixedTopLeft.lat - lat) / adjustedGridSizeLat);
    const colIndex = Math.floor((lng - fixedTopLeft.lng) / adjustedGridSizeLng);

    if (rowIndex >= 0 && rowIndex < weights.length && colIndex >= 0 && colIndex < weights[0].length) {
        weights[rowIndex][colIndex] = -1; // 충전소가 위치한 그리드의 가중치를 -1로 설정

        // 주변 8방향의 셀들의 가중치를 0으로 설정
        zeroOutSurroundings(weights, rowIndex, colIndex);
    } else {
        console.warn(`Station coordinates (${lat}, ${lng}) are out of grid bounds.`);
    }
}

// 데이터 좌표에 가중치를 추가하는 함수
export function applyWeightForData(lat, lng, weights, gridSize, fixedTopLeft, fixedBottomRight) {
    const adjustedGridSizeLat = gridSize * 0.009;
    const adjustedGridSizeLng = gridSize * 0.009 / Math.cos(fixedTopLeft.lat * Math.PI / 180);

    // 좌표가 설정된 경계 내에 있는지 확인
    if (lat >= fixedBottomRight.lat && lat <= fixedTopLeft.lat && lng >= fixedTopLeft.lng && lng <= fixedBottomRight.lng) {
        // 그리드 좌표에 맞는 행(row)과 열(column) 인덱스를 계산
        const rowIndex = Math.floor((fixedTopLeft.lat - lat) / adjustedGridSizeLat);
        const colIndex = Math.floor((lng - fixedTopLeft.lng) / adjustedGridSizeLng);

        // 유효한 인덱스 범위 내에 있는지 확인한 후 가중치를 증가
        if (rowIndex >= 0 && rowIndex < weights.length && colIndex >= 0 && colIndex < weights[0].length) {
            if (weights[rowIndex][colIndex] !== -1) {
                // Apply limits to prevent extremely high values
                weights[rowIndex][colIndex] = Math.min(weights[rowIndex][colIndex] + 1, 999);
            }
        }
    }
}

