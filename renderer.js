const map = L.map('map').setView(
    [22.637605, 120.357825],
    16
);

L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 19
    }
).addTo(map);

// 最大自動縮放層級（避免自動放大到過近）
const MAX_FIT_ZOOM = 17;
const FIT_PADDING = [50, 50];

const points = [];
const markers = [];

let polyline = null;

//const info = document.getElementById("info");
const btnClear = document.getElementById("btnClear");

const btnSearch = document.getElementById("btnSearch");
const searchText = document.getElementById("searchText");

const suggestions =
    document.getElementById("suggestions");

const btnImportCoords =
    document.getElementById("btnImportCoords");

const bulkInput =
    document.getElementById("bulkInput");

const btnExport =
    document.getElementById("btnExport");

const speedInput =
    document.getElementById("speed");

const stepDistanceInput =
    document.getElementById("stepDistance");

const btnCopy =
    document.getElementById("btnCopy");

const pointList =
    document.getElementById("pointList");

map.on('click', function (e) {

    const lat = roundCoord(e.latlng.lat);
    const lng = roundCoord(e.latlng.lng);

    points.push([lat, lng]);

    updatePointList();

    const marker = L.marker([lat, lng]).addTo(map);
    markers.push(marker);

    if (polyline) {
        map.removeLayer(polyline);
    }

    polyline = L.polyline(points).addTo(map);

    //info.textContent = `點數: ${points.length}`;
});

btnClear.addEventListener("click", () => {

    markers.forEach(m => map.removeLayer(m));

    markers.length = 0;
    points.length = 0;

    updatePointList();

    if (polyline) {
        map.removeLayer(polyline);
        polyline = null;
    }

    //info.textContent = "點數: 0";
});

btnSearch.addEventListener("click", async () => {

    const keyword = searchText.value;

    if (!keyword)
        return;

    const url =
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=jsonv2`;

    const response = await fetch(url);

    const result = await response.json();

    if (result.length === 0) {
        alert("找不到地點");
        return;
    }

    const lat = parseFloat(result[0].lat);
    const lon = parseFloat(result[0].lon);

    const rlat = roundCoord(lat);
    const rlon = roundCoord(lon);

    map.setView([rlat, rlon], 17);

    // 加入圖釘並加入座標清單
    points.push([rlat, rlon]);
    const marker = L.marker([rlat, rlon]).addTo(map);
    markers.push(marker);

    if (polyline) {
        map.removeLayer(polyline);
    }

    polyline = L.polyline(points).addTo(map);

    updatePointList();
});

searchText.addEventListener("keydown", function (e) {

    if (e.key === "Enter") {
        btnSearch.click();
    }

});

let searchTimer = null;

searchText.addEventListener("input", () => {

    clearTimeout(searchTimer);

    searchTimer = setTimeout(
        loadSuggestions,
        300
    );

});

btnImportCoords.addEventListener("click", () => {

    const text = bulkInput.value.trim();

    if (!text) {
        alert("請輸入要匯入的座標");
        return;
    }

    const imported = parseBulkCoordinates(text);

    if (imported.length === 0) {
        alert("無有效座標，請確認格式為：緯度, 經度，每行一組。");
        return;
    }

    addPoints(imported);

    bulkInput.value = "";
});

// 快捷鍵：按下 Ctrl+Enter 可快速匯入（textarea 保留單純 Enter 作換行）
bulkInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        btnImportCoords.click();
    }
});

async function loadSuggestions() {

    const keyword =
        searchText.value.trim();

    if (keyword.length < 2) {

        suggestions.style.display =
            "none";

        return;
    }

    const url =
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=jsonv2&limit=10`;

    const response =
        await fetch(url);

    const result =
        await response.json();

    suggestions.innerHTML = "";

    for (const item of result) {

        const div =
            document.createElement("div");

        div.className =
            "suggestion-item";

        div.textContent =
            item.display_name;

        div.addEventListener(
            "click",
            () => {

                searchText.value =
                    item.display_name;

                const latSel = roundCoord(parseFloat(item.lat));
                const lonSel = roundCoord(parseFloat(item.lon));

                map.setView([latSel, lonSel], 17);

                // 加入圖釘並加入座標清單
                points.push([latSel, lonSel]);
                const selMarker = L.marker([latSel, lonSel]).addTo(map);
                markers.push(selMarker);

                if (polyline) {
                    map.removeLayer(polyline);
                }

                polyline = L.polyline(points).addTo(map);

                updatePointList();

                suggestions.style.display = "none";
            }
        );

        suggestions.appendChild(div);
    }

    suggestions.style.display =
        result.length > 0
            ? "block"
            : "none";
}

searchText.focus();

function generateGpx() {

    if (points.length < 2) {
        alert("至少需要兩個點");
        return;
    }

    const speedKmh =
        parseFloat(speedInput.value);

    const stepDistance =
        parseFloat(stepDistanceInput.value);

    const speedMps =
        speedKmh * 1000 / 3600;

    let currentTime = new Date();

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    gpx += `<gpx version="1.1">\n`;

    for (let segment = 0;
         segment < points.length - 1;
         segment++) {

        const p1 = points[segment];
        const p2 = points[segment + 1];

        const path =
            interpolatePoints(
                p1[0],
                p1[1],
                p2[0],
                p2[1],
                stepDistance
            );

        for (let i = 0; i < path.length; i++) {

            const p = path[i];
            const lat = roundCoord(p.lat);
            const lon = roundCoord(p.lon);
            const timeString = currentTime
                .toISOString()
                .replace(/\.\d{3}Z$/, "Z");

            gpx +=
`  <wpt lat="${lat}" lon="${lon}">
    <time>${timeString}</time>
  </wpt>\n`;

            currentTime =
                new Date(
                    currentTime.getTime() +
                    (stepDistance / speedMps) * 1000
                );
        }
    }

    gpx += `</gpx>`;

    return gpx;
}

btnExport.addEventListener("click", () => {

    const gpx = generateGpx();

    if (!gpx)
        return;

    const blob =
        new Blob(
            [gpx],
            { type: "application/gpx+xml" }
        );

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;

    a.download = "route.gpx";

    a.click();

    URL.revokeObjectURL(url);
});

btnCopy.addEventListener("click", async () => {

    const gpx = generateGpx();

    if (!gpx)
        return;

    try {

        await navigator.clipboard.writeText(gpx);

        alert("GPX 已複製到剪貼簿");

    }
    catch (err) {

        console.error(err);

        alert("複製失敗");
    }

});

function addPoints(newPoints) {

    for (const point of newPoints) {

        points.push(point);

        const marker = L.marker(point).addTo(map);
        markers.push(marker);
    }

    redrawPolyline();
    updatePointList();

    // 匯入後自動縮放到包含所有點的邊界
    if (points.length > 0) {
        try {
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
        }
        catch (err) {
            console.warn('fitBounds 失敗：', err);
        }
    }
}

function parseBulkCoordinates(text) {

    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const parsed = [];

    for (const line of lines) {

        const parts = line
            .split(/[,\s]+/)
            .filter(part => part.length > 0);

        if (parts.length < 2)
            continue;

        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            parsed.push([roundCoord(lat), roundCoord(lon)]);
        }
    }

    return parsed;
}

function updatePointList() {

    pointList.innerHTML = "";

    points.forEach((point, index) => {

        const li =
            document.createElement("li");

        li.className =
            "point-item";

        li.textContent =
            `${point[0].toFixed(6)}, ${point[1].toFixed(6)}`;

        const btn =
            document.createElement("button");

        btn.textContent =
            "刪除";

        btn.className =
            "delete-btn";

        btn.addEventListener(
            "click",
            () => removePoint(index)
        );

        li.appendChild(btn);

        pointList.appendChild(li);
    });
}

function interpolatePoints(
    lat1,
    lon1,
    lat2,
    lon2,
    stepMeters
) {

    const distance =
        map.distance(
            [lat1, lon1],
            [lat2, lon2]
        );

    const count =
    Math.max(
        1,
        Math.round(distance / stepMeters)
    );

    const result = [];

    for (let i = 0; i <= count; i++) {

        const t = i / count;

        result.push({
            lat:
                lat1 +
                (lat2 - lat1) * t,

            lon:
                lon1 +
                (lon2 - lon1) * t
        });
    }

    return result;
}

function removePoint(index) {

    map.removeLayer(markers[index]);

    markers.splice(index, 1);

    points.splice(index, 1);

    redrawPolyline();

    updatePointList();
}

function redrawPolyline() {

    if (polyline) {
        map.removeLayer(polyline);
    }

    if (points.length > 1) {

        polyline =
            L.polyline(points)
             .addTo(map);
    }
}

function roundCoord(value) {
    return Number(value.toFixed(6));
}