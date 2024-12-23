// app.js

const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname)));

// JSON 데이터를 처리하기 위한 미들웨어 추가
app.use(bodyParser.json({ limit: '50mb' }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'atmosphere.html'));
});

// weightsData.json 파일 제공을 위한 엔드포인트 추가
app.get('/weightsData.json', (req, res) => {
    const filePath = path.join(__dirname, './weights/weightsData.json');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('weightsData.json not found');
    }
});

// JSON 데이터를 받아서 weightsData.json 파일로 저장하는 엔드포인트
app.post('/saveWeights', (req, res) => {
    const jsonData = JSON.stringify(req.body, null, 2)
        .replace(/,\s*(?=[^\s])/g, ', ')
        .replace(/\[\s*(.*?)\s*\]/g, (match, p1) => `[${p1.split(', ').join(', ')}]`)
        .replace(/],\s*\[/g, '],\n    [')  // 배열 요소들 사이에 줄바꿈 추가
        .replace(/},\s*{/g, '},\n    {');  // 객체들 사이에 줄바꿈 추가

    const filePath = path.join(__dirname, './weights/weightsData.json');

    fs.writeFile(filePath, jsonData, (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return res.status(500).send('Error saving data');
        }
        res.send('Data saved successfully');
    });
});

// JSON 데이터를 받아서 processData.json 파일로 저장하는 엔드포인트
app.post('/saveProcessedWeights', (req, res) => {
    try {
        // JSON 데이터를 읽고 적절하게 문자열로 변환
        const jsonData = JSON.stringify(req.body, null, 2)
            .replace(/,\s*(?=[^\s])/g, ', ')
            .replace(/\[\s*(.*?)\s*\]/g, (match, p1) => `[${p1.split(', ').join(', ')}]`)
            .replace(/],\s*\[/g, '],\n    [')  // 배열 요소들 사이에 줄바꿈 추가
            .replace(/},\s*{/g, '},\n    {');  // 객체들 사이에 줄바꿈 추가

        // 파일 경로 설정
        const filePath = path.join(__dirname, './weights/processData.json');

        // 파일 쓰기
        fs.writeFile(filePath, jsonData, (err) => {
            if (err) {
                console.error('Error writing file:', err);
                return res.status(500).send('Error saving data');
            }
            res.status(201).send('Data saved successfully');
        });
    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).send('Error processing data');
    }
});



app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
